import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabase, db } from "./db.js";
import { generateFollowUp, getAIConfig, highlightContact, summarizeNote } from "./ai.js";
import {
  clearSessionCookie, createSessionCookie, isAuthenticated,
  requireAuth, validateAuthConfig, verifyPassword
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

app.post("/api/auth/login", (req, res) => {
  const key = req.ip;
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (attempt?.blockedUntil > now) {
    return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
  }
  if (!verifyPassword(req.body.password)) {
    const failures = (attempt?.failures || 0) + 1;
    loginAttempts.set(key, {
      failures,
      blockedUntil: failures >= 5 ? now + 15 * 60 * 1000 : 0
    });
    return res.status(401).json({ message: "Incorrect password" });
  }
  loginAttempts.delete(key);
  res.setHeader("Set-Cookie", createSessionCookie());
  res.json({ authenticated: true });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ authenticated: false });
});

app.get("/api/auth/session", (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

app.use("/api", requireAuth);

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const [[counts]] = await db().query(`
      SELECT
        (SELECT COUNT(*) FROM contacts) contacts,
        (SELECT COUNT(*) FROM reminders WHERE status = 'pending' AND due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) upcoming,
        (SELECT COUNT(*) FROM reminders WHERE status = 'pending' AND due_date < CURDATE()) overdue,
        (SELECT COUNT(*) FROM meeting_notes WHERE meeting_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) interactions
    `);
    const [birthdays] = await db().query(`
      SELECT id, name, birthday, company
      FROM contacts
      WHERE birthday IS NOT NULL
      ORDER BY MOD(DAYOFYEAR(birthday) - DAYOFYEAR(CURDATE()) + 366, 366)
      LIMIT 4
    `);
    const [reminders] = await db().query(`
      SELECT r.*, c.name contact_name, c.company
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE r.status = 'pending'
      ORDER BY r.due_date ASC LIMIT 8
    `);
    const [reminderHistory] = await db().query(`
      SELECT r.*, c.name contact_name, c.company
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE r.status = 'completed'
      ORDER BY COALESCE(r.completed_at, r.created_at) DESC LIMIT 10
    `);
    const [calendarEvents] = await db().query(`
      SELECT 'reminder' type, r.id, r.contact_id, r.title, r.due_date event_date, c.name contact_name
      FROM reminders r JOIN contacts c ON c.id = r.contact_id
      WHERE r.status = 'pending'
      UNION ALL
      SELECT 'birthday' type, c.id, c.id contact_id, CONCAT(c.name, "'s birthday") title, c.birthday event_date, c.name contact_name
      FROM contacts c
      WHERE c.birthday IS NOT NULL
      UNION ALL
      SELECT 'meeting' type, n.id, n.contact_id, 'Meeting notes' title, DATE(n.meeting_date) event_date, c.name contact_name
      FROM meeting_notes n JOIN contacts c ON c.id = n.contact_id
      WHERE n.meeting_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      ORDER BY event_date ASC
      LIMIT 80
    `);
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
      WHERE c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?
      GROUP BY c.id ORDER BY c.name
    `, [search, search, search]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.get("/api/contacts/:id", async (req, res, next) => {
  try {
    const [[contact]] = await db().query(`
      SELECT c.*, ROUND(${scoreSql}) relationship_score,
             MAX(n.meeting_date) last_interaction, COUNT(n.id) interaction_count
      FROM contacts c LEFT JOIN meeting_notes n ON n.contact_id = c.id
      WHERE c.id = ? GROUP BY c.id
    `, [req.params.id]);
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
      "INSERT INTO contacts (name, email, phone, birthday, company, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [name.trim(), email || null, phone || null, birthday || null, company || null, notes || null]
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
      "UPDATE contacts SET name=?, email=?, phone=?, birthday=?, company=?, notes=? WHERE id=?",
      [name.trim(), email || null, phone || null, birthday || null, company || null, notes || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: "Contact not found" });
    res.json({ message: "Contact updated" });
  } catch (error) { next(error); }
});

app.delete("/api/contacts/:id", async (req, res, next) => {
  try {
    await db().query("DELETE FROM contacts WHERE id = ?", [req.params.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/contacts/:id/notes", async (req, res, next) => {
  try {
    const { content, meeting_date } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Meeting notes are required" });
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
    const [[contact]] = await db().query("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const [notes] = await db().query("SELECT * FROM meeting_notes WHERE contact_id = ? ORDER BY meeting_date DESC LIMIT 5", [req.params.id]);
    const suggestion = await generateFollowUp(contact, notes);
    res.json({ suggestion });
  } catch (error) { next(error); }
});

app.get("/api/contacts/:id/ai/highlights", async (req, res, next) => {
  try {
    const [[contact]] = await db().query("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
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
    const [result] = await db().query(`UPDATE reminders SET status = ?, completed_at = ${completedAtSql} WHERE id = ?`, [req.body.status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: "Reminder not found" });
    res.json({ message: "Reminder updated" });
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
