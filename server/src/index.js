import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabase, db } from "./db.js";
import { generateFollowUp, getAIConfig, highlightContact, planCRMTask, summarizeNote } from "./ai.js";
import {
  clearSessionCookie, createPasswordResetToken, createSessionCookie, getSessionUserId,
  hashPassword, hashPasswordResetToken, requireAuth, validateAuthConfig, verifyPassword
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = Number(process.env.PORT || 5000);
const loginAttempts = new Map();
app.disable("x-powered-by");
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
}
app.use(express.json({ limit: "1mb" }));

const scoreSql = `
  LEAST(100, GREATEST(10,
    100 - LEAST(70, DATEDIFF(CURDATE(), COALESCE(MAX(n.meeting_date), c.created_at)) * 1.4)
    + LEAST(30, COUNT(n.id) * 6)
    - COALESCE((
      SELECT SUM(GREATEST(0, DATEDIFF(CURDATE(), r.due_date)) * 10)
      FROM reminders r
      WHERE r.contact_id = c.id AND r.status = 'pending'
    ), 0)
  ))
`;

app.get("/api/health", (_req, res) => {
  const ai = getAIConfig();
  res.json({ status: "ok", aiEnabled: ai.provider !== "local", aiProvider: ai.provider, aiModel: ai.model });
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Name and a valid email are required" });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    const passwordHash = await hashPassword(password);
    const [result] = await db().query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash]
    );
    await db().query("UPDATE contacts SET user_id = ? WHERE user_id IS NULL", [result.insertId]);
    res.setHeader("Set-Cookie", createSessionCookie(result.insertId));
    res.status(201).json({ authenticated: true, user: { id: result.insertId, name, email } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "An account with that email already exists" });
    next(error);
  }
});

async function sendPasswordResetEmail(email, name, token, req) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
  const resetUrl = `${appUrl}/?reset=${encodeURIComponent(token)}`;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESET_FROM_EMAIL || "HumanLoop <onboarding@resend.dev>",
      to: [email],
      subject: "Reset your HumanLoop password",
      html: `<p>Hi ${escapeHtml(name)},</p><p>Use this secure link to reset your HumanLoop password. It expires in one hour.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
    })
  });
  if (!response.ok) throw new Error(`Reset email provider returned ${response.status}`);
  return true;
}

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const [[user]] = await db().query("SELECT id, name, email FROM users WHERE email = ?", [email]);
    if (!user) return res.json({ message: "If that account exists, password reset instructions are available." });
    const { token, hash } = createPasswordResetToken();
    await db().query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [user.id]);
    await db().query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
      [user.id, hash]
    );
    let emailSent = false;
    try { emailSent = await sendPasswordResetEmail(user.email, user.name, token, req); }
    catch (error) { console.error("Password reset email failed:", error.message); }
    res.json({
      message: process.env.NODE_ENV === "production"
        ? "If that account exists, password reset instructions are available."
        : emailSent
          ? "Check your email for a password reset link."
          : "A reset code was created. Email delivery is not configured on this server.",
      resetToken: process.env.NODE_ENV === "production" ? undefined : token
    });
  } catch (error) { next(error); }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  try {
    const tokenHash = hashPasswordResetToken(req.body.token);
    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";
    if (!req.body.token) return res.status(400).json({ message: "Reset token is required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    const [[reset]] = await db().query(`
      SELECT id, user_id FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
    `, [tokenHash]);
    if (!reset) return res.status(400).json({ message: "This reset link is invalid or has expired" });
    const passwordHash = await hashPassword(password);
    await db().query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, reset.user_id]);
    await db().query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", [reset.user_id]);
    res.json({ message: "Password updated. You can now sign in." });
  } catch (error) { next(error); }
});

app.post("/api/auth/login", async (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (attempt?.blockedUntil > now) {
    return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
  }
  try {
    const email = req.body.email?.trim().toLowerCase();
    const [[user]] = await db().query("SELECT id, name, email, password_hash FROM users WHERE email = ?", [email]);
    if (!user || !(await verifyPassword(req.body.password || "", user.password_hash))) {
      const failures = (attempt?.failures || 0) + 1;
      loginAttempts.set(key, {
        failures,
        blockedUntil: failures >= 5 ? now + 15 * 60 * 1000 : 0
      });
      return res.status(401).json({ message: "Incorrect email or password" });
    }
    loginAttempts.delete(key);
    res.setHeader("Set-Cookie", createSessionCookie(user.id));
    res.json({ authenticated: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ authenticated: false });
});

app.get("/api/auth/session", async (req, res, next) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) return res.json({ authenticated: false, user: null });
    const [[user]] = await db().query("SELECT id, name, email FROM users WHERE id = ?", [userId]);
    if (!user) return res.json({ authenticated: false, user: null });
    res.json({ authenticated: true, user });
  } catch (error) { next(error); }
});

app.use("/api", requireAuth);

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const [[counts]] = await db().query(`
      SELECT
        (SELECT COUNT(*) FROM contacts WHERE user_id = ?) contacts,
        (SELECT COUNT(*) FROM reminders r JOIN contacts c ON c.id = r.contact_id WHERE c.user_id = ? AND r.status = 'pending' AND r.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) upcoming,
        (SELECT COUNT(*) FROM reminders r JOIN contacts c ON c.id = r.contact_id WHERE c.user_id = ? AND r.status = 'pending' AND r.due_date < CURDATE()) overdue,
        (SELECT COUNT(*) FROM meeting_notes n JOIN contacts c ON c.id = n.contact_id WHERE c.user_id = ? AND n.meeting_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) interactions
    `, [req.userId, req.userId, req.userId, req.userId]);
    const [birthdays] = await db().query(`
      SELECT id, name, birthday, company
      FROM contacts
      WHERE user_id = ? AND birthday IS NOT NULL
      ORDER BY MOD(DAYOFYEAR(birthday) - DAYOFYEAR(CURDATE()) + 366, 366)
      LIMIT 4
    `, [req.userId]);
    const [reminders] = await db().query(`
      SELECT r.*, c.name contact_name, c.company
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE c.user_id = ? AND r.status = 'pending'
      ORDER BY r.due_date ASC LIMIT 8
    `, [req.userId]);
    const [reminderHistory] = await db().query(`
      SELECT r.*, c.name contact_name, c.company
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE c.user_id = ? AND r.status = 'completed'
      ORDER BY COALESCE(r.completed_at, r.created_at) DESC LIMIT 10
    `, [req.userId]);
    const [calendarEvents] = await db().query(`
      SELECT 'reminder' type, r.id, r.contact_id, r.title, r.due_date event_date, c.name contact_name
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE c.user_id = ? AND r.status = 'pending'
      UNION ALL
      SELECT 'birthday' type, c.id, c.id contact_id, CONCAT(c.name, ' birthday') title, c.birthday event_date, c.name contact_name
      FROM contacts c
      WHERE c.user_id = ? AND c.birthday IS NOT NULL
      UNION ALL
      SELECT 'meeting' type, n.id, n.contact_id, 'Meeting notes' title, DATE(n.meeting_date) event_date, c.name contact_name
      FROM meeting_notes n JOIN contacts c ON c.id = n.contact_id
      WHERE c.user_id = ? AND n.meeting_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY event_date ASC
      LIMIT 80
    `, [req.userId, req.userId, req.userId]);
    res.json({ counts, birthdays, reminders, reminderHistory, calendarEvents });
  } catch (error) { next(error); }
});

app.get("/api/contacts", async (req, res, next) => {
  try {
    const search = `%${req.query.search || ""}%`;
    const [rows] = await db().query(`
      SELECT c.*, ROUND(${scoreSql}) relationship_score,
             MAX(n.meeting_date) last_interaction, COUNT(n.id) interaction_count
      FROM contacts c
      LEFT JOIN meeting_notes n ON n.contact_id = c.id
      WHERE c.user_id = ? AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)
      GROUP BY c.id ORDER BY c.name
    `, [req.userId, search, search, search]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get("/api/contacts/:id", async (req, res, next) => {
  try {
    const [[contact]] = await db().query(`
      SELECT c.*, ROUND(${scoreSql}) relationship_score,
             MAX(n.meeting_date) last_interaction, COUNT(n.id) interaction_count
      FROM contacts c LEFT JOIN meeting_notes n ON n.contact_id = c.id
      WHERE c.id = ? AND c.user_id = ? GROUP BY c.id
    `, [req.params.id, req.userId]);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const [notes] = await db().query("SELECT * FROM meeting_notes WHERE contact_id = ? ORDER BY meeting_date DESC", [req.params.id]);
    const [reminders] = await db().query("SELECT * FROM reminders WHERE contact_id = ? ORDER BY due_date", [req.params.id]);
    res.json({ ...contact, meeting_notes: notes, reminders });
  } catch (error) { next(error); }
});

app.post("/api/contacts", async (req, res, next) => {
  try {
    const { name, email, phone, birthday, company, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    const [result] = await db().query(
      "INSERT INTO contacts (user_id, name, email, phone, birthday, company, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.userId, name.trim(), email || null, phone || null, birthday || null, company || null, notes || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});

app.put("/api/contacts/:id", async (req, res, next) => {
  try {
    const { name, email, phone, birthday, company, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    const [result] = await db().query(
      "UPDATE contacts SET name=?, email=?, phone=?, birthday=?, company=?, notes=? WHERE id=? AND user_id=?",
      [name.trim(), email || null, phone || null, birthday || null, company || null, notes || null, req.params.id, req.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Contact not found" });
    res.json({ message: "Contact updated" });
  } catch (error) { next(error); }
});

app.delete("/api/contacts/:id", async (req, res, next) => {
  try {
    const [result] = await db().query("DELETE FROM contacts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Contact not found" });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/contacts/:id/notes", async (req, res, next) => {
  try {
    const { content, meeting_date } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Meeting notes are required" });
    const [[ownedContact]] = await db().query("SELECT id FROM contacts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    if (!ownedContact) return res.status(404).json({ message: "Contact not found" });
    const summary = await summarizeNote(content);
    const [result] = await db().query(
      "INSERT INTO meeting_notes (contact_id, content, summary, meeting_date) VALUES (?, ?, ?, ?)",
      [req.params.id, content.trim(), summary, meeting_date || new Date()]
    );
    res.status(201).json({ id: result.insertId, summary });
  } catch (error) { next(error); }
});

app.post("/api/contacts/:id/ai/follow-up", async (req, res, next) => {
  try {
    const [[contact]] = await db().query("SELECT * FROM contacts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const [notes] = await db().query("SELECT * FROM meeting_notes WHERE contact_id = ? ORDER BY meeting_date DESC LIMIT 5", [req.params.id]);
    const suggestion = await generateFollowUp(contact, notes);
    res.json({ suggestion });
  } catch (error) { next(error); }
});

app.get("/api/contacts/:id/ai/highlights", async (req, res, next) => {
  try {
    const [[contact]] = await db().query("SELECT * FROM contacts WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const [notes] = await db().query("SELECT * FROM meeting_notes WHERE contact_id = ? ORDER BY meeting_date DESC LIMIT 5", [req.params.id]);
    res.json({ highlights: await highlightContact(contact, notes) });
  } catch (error) { next(error); }
});

app.post("/api/reminders", async (req, res, next) => {
  try {
    const { contact_id, title, due_date, reason } = req.body;
    if (!Number.isInteger(Number(contact_id)) || !title?.trim() || !due_date) {
      return res.status(400).json({ message: "Contact, reminder title, and due date are required" });
    }
    const [[ownedContact]] = await db().query("SELECT id FROM contacts WHERE id = ? AND user_id = ?", [contact_id, req.userId]);
    if (!ownedContact) return res.status(404).json({ message: "Contact not found" });
    const [result] = await db().query(
      "INSERT INTO reminders (contact_id, title, due_date, reason) VALUES (?, ?, ?, ?)",
      [contact_id, title.trim(), due_date, reason || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
});

app.patch("/api/reminders/:id", async (req, res, next) => {
  try {
    if (!["pending", "completed"].includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid reminder status" });
    }
    const completedAtSql = req.body.status === "completed" ? "NOW()" : "NULL";
    const [result] = await db().query(`
      UPDATE reminders r
      JOIN contacts c ON c.id = r.contact_id
      SET r.status = ?, r.completed_at = ${completedAtSql}
      WHERE r.id = ? AND c.user_id = ?
    `, [req.body.status, req.params.id, req.userId]);
    if (!result.affectedRows) return res.status(404).json({ message: "Reminder not found" });
    res.json({ message: "Reminder updated" });
  } catch (error) { next(error); }
});

app.get("/api/ai/chat", async (req, res, next) => {
  try {
    const [messages] = await db().query(`
      SELECT id, role, content, created_at
      FROM chat_messages WHERE user_id = ? ORDER BY id ASC
    `, [req.userId]);
    res.json(messages);
  } catch (error) { next(error); }
});

app.delete("/api/ai/chat", async (req, res, next) => {
  try {
    await db().query("DELETE FROM chat_messages WHERE user_id = ?", [req.userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

async function executeAgentAction(userId, action) {
  const type = action?.type;
  const data = action?.data || {};
  if (!type || type === "none") return { changed: false };

  if (type === "add_contact") {
    const name = String(data.name || "").trim();
    if (!name) throw new Error("I need the person's name before I can add them.");
    const email = String(data.email || "").trim() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("The contact email is not valid.");
    const [result] = await db().query(
      "INSERT INTO contacts (user_id, name, email, phone, birthday, company, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, name, email, data.phone || null, data.birthday || null, data.company || null, data.notes || null]
    );
    return { changed: true, action: "contact_added", contactId: result.insertId };
  }

  const contactId = Number(data.contact_id);
  if (["update_contact", "delete_contact", "add_reminder", "add_note"].includes(type)) {
    const [[contact]] = await db().query("SELECT * FROM contacts WHERE id = ? AND user_id = ?", [contactId, userId]);
    if (!contact) throw new Error("I could not find that contact in your account.");

    if (type === "delete_contact") {
      await db().query("DELETE FROM contacts WHERE id = ? AND user_id = ?", [contactId, userId]);
      return { changed: true, action: "contact_deleted" };
    }
    if (type === "update_contact") {
      const next = {
        name: data.name ?? contact.name,
        email: data.email ?? contact.email,
        phone: data.phone ?? contact.phone,
        birthday: data.birthday ?? contact.birthday,
        company: data.company ?? contact.company,
        notes: data.notes ?? contact.notes
      };
      if (!String(next.name || "").trim()) throw new Error("A contact must have a name.");
      if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) throw new Error("The contact email is not valid.");
      await db().query(`
        UPDATE contacts SET name = ?, email = ?, phone = ?, birthday = ?, company = ?, notes = ?
        WHERE id = ? AND user_id = ?
      `, [next.name, next.email || null, next.phone || null, next.birthday || null, next.company || null, next.notes || null, contactId, userId]);
      return { changed: true, action: "contact_updated", contactId };
    }
    if (type === "add_reminder") {
      const title = String(data.title || "").trim();
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.due_date || ""))) {
        throw new Error("I need a reminder title and a specific due date.");
      }
      const [result] = await db().query(
        "INSERT INTO reminders (contact_id, title, due_date, reason) VALUES (?, ?, ?, ?)",
        [contactId, title, data.due_date, data.reason || "Created by HumanLoop AI"]
      );
      return { changed: true, action: "reminder_added", reminderId: result.insertId };
    }
    if (type === "add_note") {
      const content = String(data.content || "").trim();
      if (!content) throw new Error("I need the meeting note content.");
      const summary = await summarizeNote(content);
      const [result] = await db().query(
        "INSERT INTO meeting_notes (contact_id, content, summary, meeting_date) VALUES (?, ?, ?, ?)",
        [contactId, content, summary, data.meeting_date || new Date()]
      );
      return { changed: true, action: "note_added", noteId: result.insertId };
    }
  }

  if (type === "complete_reminder") {
    const reminderId = Number(data.reminder_id);
    const [result] = await db().query(`
      UPDATE reminders r JOIN contacts c ON c.id = r.contact_id
      SET r.status = 'completed', r.completed_at = NOW()
      WHERE r.id = ? AND c.user_id = ?
    `, [reminderId, userId]);
    if (!result.affectedRows) throw new Error("I could not find that reminder in your account.");
    return { changed: true, action: "reminder_completed", reminderId };
  }

  throw new Error("That CRM action is not supported yet.");
}

app.post("/api/ai/chat", async (req, res, next) => {
  try {
    const message = req.body.message?.trim();
    if (!message) return res.status(400).json({ message: "Message is required" });
    await db().query("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'user', ?)", [req.userId, message]);
    const [contacts] = await db().query(`
      SELECT id, name, email, phone, birthday, company, notes, created_at, updated_at
      FROM contacts WHERE user_id = ? ORDER BY name
    `, [req.userId]);
    const [recentNotes] = await db().query(`
      SELECT n.id, n.contact_id, c.name contact_name, n.summary, n.content, n.meeting_date
      FROM meeting_notes n JOIN contacts c ON c.id = n.contact_id
      WHERE c.user_id = ? ORDER BY n.meeting_date DESC
    `, [req.userId]);
    const [reminders] = await db().query(`
      SELECT r.id, r.contact_id, c.name contact_name, r.title, r.due_date, r.reason, r.status
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE c.user_id = ? ORDER BY r.due_date
    `, [req.userId]);
    const [history] = await db().query(`
      SELECT role, content FROM chat_messages
      WHERE user_id = ? ORDER BY id DESC LIMIT 14
    `, [req.userId]);
    const plan = await planCRMTask(message, history.reverse().slice(0, -1), { contacts, meetingNotes: recentNotes, reminders });
    let result = { changed: false };
    let reply = plan.reply;
    try {
      result = await executeAgentAction(req.userId, plan.action);
    } catch (error) {
      reply = `${plan.reply}\n\nI did not make that change: ${error.message}`;
    }
    await db().query("INSERT INTO chat_messages (user_id, role, content) VALUES (?, 'assistant', ?)", [req.userId, reply]);
    res.json({ reply, ...result });
  } catch (error) { next(error); }
});

app.use("/api", (_req, res) => res.status(404).json({ message: "API route not found" }));

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.use((_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Something went wrong" });
});

Promise.resolve()
  .then(validateAuthConfig)
  .then(initializeDatabase)
  .then(() => app.listen(port, () => console.log(`HumanLoop API running on port ${port}`)))
  .catch((error) => {
    console.error("Could not connect to MySQL:", error.message);
    process.exit(1);
  });
