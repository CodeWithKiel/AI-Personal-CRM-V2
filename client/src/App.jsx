import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, Cake, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleUserRound, Clock3, Mail, Menu, MessageSquareText, Phone,
  Bot, Database, Download, Eye, EyeOff, FileUp, LockKeyhole, Moon, Plus,
  Search, Send, Settings, ShieldCheck, Sparkles, Sun, Trash2, UserRound,
  Users, X
} from "lucide-react";
import { api } from "./api";

const emptyContact = { name: "", email: "", phone: "", birthday: "", company: "", notes: "" };

function initials(name = "") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function prettyDate(value, options = {}) {
  if (!value) return "Not yet";
  const normalized = value.length === 10 ? `${value}T00:00:00` : value.replace(" ", "T");
  return new Date(normalized).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: options.year ? "numeric" : undefined
  });
}

function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  const birthday = new Date(`${date}T00:00:00`);
  birthday.setFullYear(today.getFullYear());
  if (birthday < new Date(today.toDateString())) birthday.setFullYear(today.getFullYear() + 1);
  return Math.ceil((birthday - new Date(today.toDateString())) / 86400000);
}

function dateKey(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function Score({ value = 10 }) {
  const color = value >= 75 ? "#167a61" : value >= 45 ? "#c67936" : "#a8524d";
  return (
    <div className="score" style={{ "--score-color": color }}>
      <span>{value}</span>
      <small>score</small>
    </div>
  );
}

function Login({ onAuthenticated }) {
  const initialResetToken = new URLSearchParams(window.location.search).get("reset") || "";
  const [mode, setMode] = useState(initialResetToken ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        const result = await api.forgotPassword(email);
        setMessage(result.message);
        if (result.resetToken) {
          setResetToken(result.resetToken);
          setMode("reset");
        }
      } else if (mode === "reset") {
        const result = await api.resetPassword({ token: resetToken, password, confirmPassword });
        setMessage(result.message);
        window.history.replaceState({}, "", window.location.pathname);
        setPassword("");
        setConfirmPassword("");
        setMode("login");
      } else {
        const result = mode === "signup"
          ? await api.signup({ name, email, password, confirmPassword })
          : await api.login({ email, password, twoFactorToken });
        if (result.requiresTwoFactor) {
          setMode("twoFactor");
          return;
        }
        onAuthenticated(result.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand"><div className="brand-mark"><span /><span /></div><strong>HumanLoop</strong></div>
        {["login", "signup"].includes(mode) && <div className="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button>
        </div>}
        <p className="eyebrow">{mode === "signup" ? "Start your private CRM" : mode === "forgot" ? "Account recovery" : mode === "reset" ? "Choose a new password" : mode === "twoFactor" ? "Security check" : "Welcome back"}</p>
        <h1>{mode === "signup" ? "Create your account." : mode === "forgot" ? "Forgot password?" : mode === "reset" ? "Reset your password." : mode === "twoFactor" ? "Enter your code." : "Good to see you."}</h1>
        <p>{mode === "forgot" ? "Enter your account email and we'll prepare a secure reset link." : mode === "reset" ? "Enter the reset code and your new password." : mode === "twoFactor" ? "Enter the six-digit code from your authenticator app." : "\"Remember the people who matter.\""}</p>
        {mode === "signup" && <label>Your name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label>}
        {!["reset", "twoFactor"].includes(mode) && <label>Email<input autoFocus={mode === "login" || mode === "forgot"} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        {mode === "reset" && <label>Reset code<input autoFocus value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></label>}
        {!["forgot", "twoFactor"].includes(mode) && <label>{mode === "reset" ? "New password" : "Password"}<span className="password-field"><input type={showPassword ? "text" : "password"} minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
        {["signup", "reset"].includes(mode) && <label>Re-enter password<span className="password-field"><input type={showConfirmPassword ? "text" : "password"} minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
        {mode === "twoFactor" && <label>Authentication code<input autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={twoFactorToken} onChange={(event) => setTwoFactorToken(event.target.value.replace(/\D/g, ""))} required /></label>}
        {error && <div className="login-error">{error}</div>}
        {message && <div className="login-message">{message}</div>}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Continue" : mode === "reset" ? "Reset password" : mode === "twoFactor" ? "Verify and sign in" : "Sign in"}
        </button>
        {mode === "login" && <button type="button" className="auth-link" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot password?</button>}
        {["forgot", "reset", "twoFactor"].includes(mode) && <button type="button" className="auth-link" onClick={() => { setMode("login"); setTwoFactorToken(""); setError(""); setMessage(""); }}>Back to sign in</button>}
      </form>
    </main>
  );
}

function AIChat({ user, onChanged }) {
  const [open, setOpen] = useState(() => localStorage.getItem("humanloop-chat-open") === "true");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const greeting = { role: "assistant", content: `Hi ${user?.name?.split(" ")[0] || "there"}. I can answer questions and manage contacts, notes, and reminders for you.` };
  const [messages, setMessages] = useState([greeting]);

  useEffect(() => {
    localStorage.setItem("humanloop-chat-open", String(open));
  }, [open]);
  useEffect(() => {
    api.chatHistory()
      .then((history) => setMessages(history.length ? history : [greeting]))
      .catch(() => setMessages([greeting]));
  }, [user?.id]);

  const send = async (event, suggestedMessage) => {
    event?.preventDefault();
    const message = (suggestedMessage || input).trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const result = await api.chat(message);
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
      if (result.changed) onChanged();
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: `I couldn't answer that: ${error.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Clear your saved AI conversation?")) return;
    await api.clearChat();
    setMessages([greeting]);
  };

  return (
    <div className={`ai-chat ${open ? "open" : ""}`}>
      {open && <section className="ai-chat-panel" aria-label="HumanLoop AI assistant">
        <header className="ai-chat-head">
          <div className="ai-chat-avatar"><Bot size={20} /></div>
          <div><strong>HumanLoop AI</strong><small>Your personal CRM assistant</small></div>
          <div className="ai-chat-controls">
            <button type="button" className="icon-button" onClick={clearChat} aria-label="Clear AI chat" title="Clear conversation"><Trash2 size={16} /></button>
            <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close AI chat"><X size={18} /></button>
          </div>
        </header>
        <div className="ai-chat-messages">
          {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.content}</div>)}
          {busy && <div className="chat-message assistant thinking">Thinking...</div>}
        </div>
        {messages.length === 1 && <div className="chat-prompts">
          {["Add Jordan Lee at Acme", "Remind me to call Jordan next Friday", "Who should I follow up with?"].map((prompt) =>
            <button type="button" key={prompt} onClick={(event) => send(event, prompt)}>{prompt}</button>
          )}
        </div>}
        <form className="ai-chat-form" onSubmit={send}>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your relationships..." aria-label="Message HumanLoop AI" />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message"><Send size={17} /></button>
        </form>
      </section>}
      <button type="button" className="ai-chat-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Close AI assistant" : "Open AI assistant"}>
        {open ? <X size={22} /> : <><Bot size={22} /><span>Ask AI</span></>}
      </button>
    </div>
  );
}

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function SettingsPage({ user, onUserChanged, onDataChanged, onDeleted, notify }) {
  const [settings, setSettings] = useState({ name: user.name, email: user.email, phone: user.phone || "", version: "2.0.0" });
  const [activity, setActivity] = useState([]);
  const [storage, setStorage] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [twoFactor, setTwoFactor] = useState(null);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [disableForm, setDisableForm] = useState({ password: "", token: "" });
  const [busy, setBusy] = useState(false);

  const loadSettings = async () => {
    const [account, loginActivity, storageUsage] = await Promise.all([api.settings(), api.loginActivity(), api.storage()]);
    setSettings(account);
    setActivity(loginActivity);
    setStorage(storageUsage);
  };
  useEffect(() => { loadSettings().catch((error) => notify(error.message, "error")); }, []);

  const run = async (work, success) => {
    setBusy(true);
    try {
      await work();
      if (success) notify(success);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await api.updateProfile(settings);
      onUserChanged({ ...user, ...result.user });
      await loadSettings();
    }, "Profile updated.");
  };

  const changePassword = (event) => {
    event.preventDefault();
    run(async () => {
      await api.changePassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }, "Password changed.");
  };

  const setupTwoFactor = () => run(async () => setTwoFactor(await api.setupTwoFactor()));
  const enableTwoFactor = () => run(async () => {
    await api.enableTwoFactor(twoFactorToken);
    setTwoFactor(null);
    setTwoFactorToken("");
    await loadSettings();
  }, "Two-factor authentication enabled.");
  const disableTwoFactor = () => run(async () => {
    await api.disableTwoFactor(disableForm);
    setDisableForm({ password: "", token: "" });
    await loadSettings();
  }, "Two-factor authentication disabled.");

  const importFile = async (file) => {
    if (!file) return;
    let contacts;
    if (file.name.toLowerCase().endsWith(".csv")) {
      const { default: Papa } = await import("papaparse");
      const parsed = await new Promise((resolve, reject) => Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: reject
      }));
      contacts = parsed;
    } else {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const rows = await readXlsxFile(file);
      const headers = (rows[0] || []).map((value) => String(value || ""));
      contacts = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
    }
    await run(async () => {
      const result = await api.importContacts(contacts);
      await Promise.all([loadSettings(), onDataChanged()]);
      notify(`Imported ${result.imported} contacts${result.skipped ? `; skipped ${result.skipped}` : ""}.`);
    });
  };

  const exportBackup = () => run(async () => {
    const backup = await api.exportData();
    downloadFile(`humanloop-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
  }, "Backup downloaded.");

  const exportContacts = (format) => run(async () => {
    const backup = await api.exportData();
    const contacts = backup.contacts.map(({ name, email, phone, birthday, company, notes }) => ({ name, email, phone, birthday, company, notes }));
    if (format === "csv") {
      const { default: Papa } = await import("papaparse");
      downloadFile("humanloop-contacts.csv", Papa.unparse(contacts), "text/csv;charset=utf-8");
    } else {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const schema = [
        { column: "Name", type: String, value: (row) => row.name || "" },
        { column: "Email", type: String, value: (row) => row.email || "" },
        { column: "Phone", type: String, value: (row) => row.phone || "" },
        { column: "Birthday", type: String, value: (row) => row.birthday || "" },
        { column: "Company", type: String, value: (row) => row.company || "" },
        { column: "Notes", type: String, value: (row) => row.notes || "" }
      ];
      await writeXlsxFile(contacts, { schema, fileName: "humanloop-contacts.xlsx" });
    }
  }, `Contacts exported as ${format.toUpperCase()}.`);

  const restoreBackup = async (file) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const replace = window.confirm("Replace existing CRM data? Choose Cancel to merge this backup instead.");
      await run(async () => {
        await api.restoreData(backup, replace ? "replace" : "merge");
        await Promise.all([loadSettings(), onDataChanged()]);
      }, "Backup restored.");
    } catch (error) {
      notify(error.message === "Unexpected token" ? "That is not a valid HumanLoop backup." : error.message, "error");
    }
  };

  const deleteAccount = () => {
    const password = window.prompt("Enter your password to permanently delete your account:");
    if (!password || !window.confirm("This permanently deletes your account and all CRM data. Continue?")) return;
    run(async () => {
      await api.deleteAccount(password);
      onDeleted();
    });
  };

  return (
    <section className="settings-page">
      <div className="settings-section-head"><p className="eyebrow">Personalize and protect</p><h2>Account Settings</h2></div>
      <div className="settings-grid">
        <form className="settings-card" onSubmit={saveProfile}>
          <div className="settings-card-title"><CircleUserRound /><div><h3>Profile information</h3><p>Update the details associated with your account.</p></div></div>
          <label>Name<input value={settings.name || ""} onChange={(event) => setSettings({ ...settings, name: event.target.value })} required /></label>
          <label>Email<input type="email" value={settings.email || ""} onChange={(event) => setSettings({ ...settings, email: event.target.value })} required /></label>
          <label>Phone<input value={settings.phone || ""} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} /></label>
          <button className="button primary" disabled={busy}>Save profile</button>
        </form>

        <form className="settings-card" onSubmit={changePassword}>
          <div className="settings-card-title"><LockKeyhole /><div><h3>Change password</h3><p>Use at least eight characters.</p></div></div>
          <label>Current password<input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></label>
          <label>New password<input type="password" minLength="8" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></label>
          <label>Re-enter new password<input type="password" minLength="8" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></label>
          <button className="button primary" disabled={busy}>Change password</button>
        </form>

        <div className="settings-card">
          <div className="settings-card-title"><ShieldCheck /><div><h3>Two-factor authentication</h3><p>Add an authenticator app code to every login.</p></div></div>
          <span className={`status-pill ${settings.twoFactorEnabled ? "enabled" : ""}`}>{settings.twoFactorEnabled ? "Enabled" : "Disabled"}</span>
          {!settings.twoFactorEnabled && !twoFactor && <button type="button" className="button primary" disabled={busy} onClick={setupTwoFactor}>Set up 2FA</button>}
          {twoFactor && <div className="two-factor-setup">
            <img src={twoFactor.qrCode} alt="Two-factor authentication QR code" />
            <p>Scan this code with your authenticator app, or enter:</p><code>{twoFactor.secret}</code>
            <input inputMode="numeric" placeholder="6-digit code" value={twoFactorToken} onChange={(event) => setTwoFactorToken(event.target.value.replace(/\D/g, ""))} />
            <button type="button" className="button primary" onClick={enableTwoFactor}>Verify and enable</button>
          </div>}
          {settings.twoFactorEnabled && <div className="disable-2fa">
            <input type="password" placeholder="Current password" value={disableForm.password} onChange={(event) => setDisableForm({ ...disableForm, password: event.target.value })} />
            <input inputMode="numeric" placeholder="6-digit code" value={disableForm.token} onChange={(event) => setDisableForm({ ...disableForm, token: event.target.value.replace(/\D/g, "") })} />
            <button type="button" className="button ghost danger" onClick={disableTwoFactor}>Disable 2FA</button>
          </div>}
        </div>

        <div className="settings-card activity-card">
          <div className="settings-card-title"><Clock3 /><div><h3>Login activity</h3><p>Your latest account access attempts.</p></div></div>
          <div className="activity-list">{activity.map((item) => <div key={item.id}>
            <span className={`activity-status ${item.status}`} />
            <div><strong>{item.status.replace("_", " ")}</strong><small>{prettyDate(item.created_at, { year: true })} · {item.ip_address || "Unknown IP"}</small></div>
          </div>)}{!activity.length && <p className="muted-copy">No login activity recorded yet.</p>}</div>
        </div>
      </div>

      <div className="settings-section-head"><p className="eyebrow">Your information</p><h2>Data Management</h2></div>
      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-title"><FileUp /><div><h3>Import contacts</h3><p>Upload CSV or Excel with name, email, phone, birthday, company, and notes columns.</p></div></div>
          <label className="file-button button ghost">Choose CSV or Excel<input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => importFile(event.target.files[0])} /></label>
        </div>
        <div className="settings-card">
          <div className="settings-card-title"><Download /><div><h3>Export data</h3><p>Download a portable contact list.</p></div></div>
          <div className="button-row"><button type="button" className="button ghost" onClick={() => exportContacts("csv")}>CSV</button><button type="button" className="button ghost" onClick={() => exportContacts("xlsx")}>Excel</button></div>
        </div>
        <div className="settings-card">
          <div className="settings-card-title"><Database /><div><h3>Backup & restore</h3><p>JSON backups preserve contacts, notes, reminders, and chat history.</p></div></div>
          <div className="button-row"><button type="button" className="button ghost" onClick={exportBackup}>Download backup</button><label className="file-button button ghost">Restore backup<input type="file" accept=".json" onChange={(event) => restoreBackup(event.target.files[0])} /></label></div>
        </div>
        <div className="settings-card storage-card">
          <div className="settings-card-title"><Database /><div><h3>Storage usage</h3><p>Approximate text stored in your CRM.</p></div></div>
          <strong className="storage-total">{formatBytes(Number(storage.bytes || 0))}</strong>
          <div className="storage-breakdown"><span>{storage.contacts || 0} contacts</span><span>{storage.notes || 0} notes</span><span>{storage.reminders || 0} reminders</span><span>{storage.messages || 0} chat messages</span></div>
        </div>
      </div>

      <div className="settings-section-head"><p className="eyebrow">Product details</p><h2>About App</h2></div>
      <div className="settings-grid about-grid">
        <div className="settings-card"><h3>Version</h3><p>HumanLoop v{settings.version || "2.0.0"}</p></div>
        <div className="settings-card"><h3>About</h3><p>A private AI personal CRM for remembering details and nurturing relationships.</p></div>
        <div className="settings-card"><h3>Created by</h3><p>VibeCodersPH</p></div>
        <div className="settings-card"><h3>Credits</h3><p>React, Express, MySQL, Lucide, Groq, OpenAI-compatible APIs, and the open-source community.</p></div>
      </div>

      <div className="danger-zone"><div><h3>Delete account</h3><p>Permanently remove your account and all associated data.</p></div><button type="button" className="button danger" onClick={deleteAccount}>Delete account</button></div>
    </section>
  );
}

function ContactForm({ initial = emptyContact, onSubmit, onClose, saving }) {
  const [form, setForm] = useState({ ...emptyContact, ...initial, birthday: initial.birthday?.slice(0, 10) || "" });
  return (
    <form className="contact-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <div className="form-grid">
        <label className="wide">Full name <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maya Chen" /></label>
        <label>Email <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="maya@example.com" /></label>
        <label>Phone <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 0123" /></label>
        <label>Company <input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" /></label>
        <label>Birthday <input type="date" value={form.birthday || ""} onChange={(e) => setForm({ ...form, birthday: e.target.value })} /></label>
        <label className="wide">What should you remember? <textarea rows="4" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Interests, family, preferences, context..." /></label>
      </div>
      <div className="form-actions">
        <button type="button" className="button ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={saving}>{saving ? "Saving..." : "Save contact"}</button>
      </div>
    </form>
  );
}

function ContactPanel({ contactId, onClose, onChanged, notify }) {
  const [contact, setContact] = useState(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [suggestion, setSuggestion] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api.contact(contactId);
      setContact(data);
      api.highlights(contactId).then((result) => setHighlights(result.highlights)).catch(() => setHighlights([]));
    } catch (error) {
      notify(error.message, "error");
      onClose();
    }
  };
  useEffect(() => { load(); }, [contactId]);

  const save = async (data) => {
    setBusy(true);
    try {
      await api.updateContact(contactId, data);
      setEditing(false);
      await load();
      onChanged();
      notify("Contact updated.");
    } catch (error) {
      notify(error.message, "error");
    }
    finally { setBusy(false); }
  };
  const addNote = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.addNote(contactId, { content: note, meeting_date: `${meetingDate} 12:00:00` });
      setNote("");
      await load();
      onChanged();
      notify("Meeting note summarized and saved.");
    } catch (error) {
      notify(error.message, "error");
    } finally { setBusy(false); }
  };
  const getSuggestion = async () => {
    setBusy(true);
    try {
      setSuggestion((await api.followUp(contactId)).suggestion);
    } catch (error) {
      notify(error.message, "error");
    }
    finally { setBusy(false); }
  };
  const makeReminder = async () => {
    setBusy(true);
    try {
      const due = new Date();
      due.setDate(due.getDate() + 3);
      await api.createReminder({
        contact_id: contactId,
        title: suggestion,
        due_date: due.toISOString().slice(0, 10),
        reason: "AI follow-up suggestion"
      });
      setSuggestion("");
      onChanged();
      notify("Reminder added for three days from now.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!contact) return <div className="panel"><div className="loading">Loading relationship...</div></div>;
  return (
    <div className="panel-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel">
        <button type="button" className="icon-button panel-close" onClick={onClose} aria-label="Close contact details"><X size={20} /></button>
        <div className="panel-profile">
          <div className="avatar large">{initials(contact.name)}</div>
          <div>
            <p className="eyebrow">Contact profile</p>
            <h2>{contact.name}</h2>
            <p>{contact.company || "Independent"}</p>
          </div>
          <Score value={contact.relationship_score} />
        </div>

        {editing ? <ContactForm initial={contact} onSubmit={save} onClose={() => setEditing(false)} saving={busy} /> : (
          <>
            <div className="profile-actions">
              <button type="button" className="button primary" disabled={busy} onClick={getSuggestion}><Sparkles size={16} /> {busy ? "Thinking..." : "Suggest follow-up"}</button>
              <button type="button" className="button ghost" onClick={() => setEditing(true)}>Edit profile</button>
            </div>
            {suggestion && <div className="ai-card">
              <div><Sparkles size={18} /><strong>HumanLoop suggests</strong></div>
              <p>{suggestion}</p>
              <button type="button" className="text-button" disabled={busy} onClick={makeReminder}>Add reminder for 3 days <ChevronRight size={15} /></button>
            </div>}
            <div className="contact-meta">
              {contact.email ? <a href={`mailto:${contact.email}`}><Mail size={17} /><span>{contact.email}</span></a> : <div><Mail size={17} /><span>No email added</span></div>}
              {contact.phone ? <a href={`tel:${contact.phone}`}><Phone size={17} /><span>{contact.phone}</span></a> : <div><Phone size={17} /><span>No phone added</span></div>}
              <div><Cake size={17} /><span>{contact.birthday ? prettyDate(contact.birthday) : "No birthday added"}</span></div>
              <div><Clock3 size={17} /><span>Last connected {prettyDate(contact.last_interaction)}</span></div>
            </div>
            {(highlights.length > 0 || contact.notes) && <section>
              <div className="section-title"><h3>Things to remember</h3><span className="ai-pill"><Sparkles size={12} /> AI highlights</span></div>
              <div className="highlights">
                {highlights.map((item, index) => <div key={index}><span>{index + 1}</span><p>{item}</p></div>)}
                {!highlights.length && <p>{contact.notes}</p>}
              </div>
            </section>}
            <section>
              <div className="section-title"><h3>Meeting notes</h3><span>{contact.meeting_notes.length} interactions</span></div>
              <form className="note-form" onSubmit={addNote}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What happened when you met ${contact.name.split(" ")[0]}?`} rows="3" />
                <div><input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /><button type="submit" disabled={busy} className="button dark">Add & summarize</button></div>
              </form>
              <div className="timeline">
                {contact.meeting_notes.map((item) => <article key={item.id}>
                  <span className="timeline-dot" />
                  <div className="note-head"><strong>{prettyDate(item.meeting_date, { year: true })}</strong><span>Meeting</span></div>
                  <p>{item.content}</p>
                  {item.summary && <div className="summary"><Sparkles size={14} /><span>{item.summary}</span></div>}
                </article>)}
                {!contact.meeting_notes.length && <div className="empty-small">No meetings logged yet. Add the first note above.</div>}
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [dashboard, setDashboard] = useState({ counts: {}, birthdays: [], reminders: [], reminderHistory: [], calendarEvents: [] });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeView, setActiveView] = useState("home");
  const [theme, setTheme] = useState(() => localStorage.getItem("humanloop-theme") || "light");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showScheduleHighlights, setShowScheduleHighlights] = useState(false);
  const searchRequest = useRef(0);

  useEffect(() => {
    api.session()
      .then((result) => {
        setAuthenticated(result.authenticated);
        setCurrentUser(result.user || null);
      })
      .catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => {
    localStorage.setItem("humanloop-theme", theme);
  }, [theme]);

  const notify = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };
  const goTo = (view) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileNav(false);
  };

  const load = async () => {
    try {
      const [contactData, dashboardData] = await Promise.all([api.contacts(search), api.dashboard()]);
      setContacts(contactData); setDashboard(dashboardData); setError("");
    } catch (err) { setError(err.message); }
  };
  useEffect(() => {
    if (!authenticated) return undefined;
    const requestId = ++searchRequest.current;
    const timer = setTimeout(() => {
      api.contacts(search)
        .then((contactData) => {
          if (requestId !== searchRequest.current) return;
          setContacts(contactData);
          setError("");
        })
        .catch((err) => setError(err.message));
    }, 180);
    return () => {
      clearTimeout(timer);
      if (requestId === searchRequest.current) searchRequest.current += 1;
    };
  }, [search, authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    api.dashboard()
      .then((dashboardData) => { setDashboard(dashboardData); setError(""); })
      .catch((err) => setError(err.message));
  }, [authenticated]);

  const createContact = async (data) => {
    setSaving(true);
    try {
      const result = await api.createContact(data);
      setShowForm(false);
      await load();
      setSelected(result.id);
      setError("");
      notify("Contact added to your loop.");
    } catch (err) {
      setError(err.message);
      notify(err.message, "error");
    }
    finally { setSaving(false); }
  };
  const removeContact = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Delete this contact and their history?")) return;
    try {
      await api.deleteContact(id);
      await load();
      notify("Contact deleted.");
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const complete = async (id) => {
    try {
      await api.completeReminder(id);
      await load();
      notify("Reminder completed.");
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const averageScore = useMemo(() => contacts.length ? Math.round(contacts.reduce((sum, c) => sum + Number(c.relationship_score), 0) / contacts.length) : 0, [contacts]);
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const viewTitles = {
    home: ["Good morning.", "Here's who could use a little attention today."],
    people: ["Your Circle", "Browse and update the people in your loop."],
    reminders: ["Stay Thoughtful", "Keep track of the moments that need a follow-up."],
    birthdays: ["Worth Celebrating", "See upcoming birthdays at a glance."],
    settings: ["Settings", "Manage your account, security, data, and app details."]
  };
  const [title, subtitle] = viewTitles[activeView];
  const calendarEvents = useMemo(() => {
    const events = dashboard.calendarEvents || [];
    const currentMonth = monthKey(calendarMonth);
    return events
      .map((event) => {
        const rawDate = dateKey(event.event_date);
        const eventDate = event.type === "birthday" && rawDate
          ? `${calendarMonth.getFullYear()}-${rawDate.slice(5)}`
          : rawDate;
        return { ...event, eventDate };
      })
      .filter((event) => event.eventDate.startsWith(currentMonth));
  }, [dashboard.calendarEvents, calendarMonth]);
  const calendarEventsByDay = useMemo(() => calendarEvents.reduce((groups, event) => {
    groups[event.eventDate] = [...(groups[event.eventDate] || []), event];
    return groups;
  }, {}), [calendarEvents]);
  const calendarDays = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const leading = start.getDay();
    return Array.from({ length: leading + end.getDate() }, (_, index) => {
      const day = index - leading + 1;
      if (day < 1) return null;
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { day, key, events: calendarEventsByDay[key] || [] };
    });
  }, [calendarMonth, calendarEventsByDay]);
  const changeMonth = (offset) => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + offset, 1));

  if (authenticated === null) return <div className="app-loading">Opening HumanLoop...</div>;
  if (!authenticated) return <Login onAuthenticated={(user) => { setCurrentUser(user); setAuthenticated(true); }} />;

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span /><span /></div><strong>HumanLoop</strong></div>
        <nav>
          <button type="button" className={activeView === "home" ? "active" : ""} onClick={() => goTo("home")}><CircleUserRound size={19} /> Home</button>
          <button type="button" className={activeView === "people" ? "active" : ""} onClick={() => goTo("people")}><Users size={19} /> People <span>{contacts.length}</span></button>
          <button type="button" className={activeView === "reminders" ? "active" : ""} onClick={() => goTo("reminders")}><Bell size={19} /> Reminders <span>{dashboard.counts.upcoming || 0}</span></button>
          <button type="button" className={activeView === "birthdays" ? "active" : ""} onClick={() => goTo("birthdays")}><Cake size={19} /> Birthdays <span>{dashboard.birthdays.length}</span></button>
          <button type="button" className={activeView === "settings" ? "active" : ""} onClick={() => goTo("settings")}><Settings size={19} /> Settings</button>
        </nav>
        <div className="sidebar-foot">
          <div className="user-avatar">{initials(currentUser?.name)}</div>
          <div><strong>{currentUser?.name || "Your workspace"}</strong></div>
          <button type="button" className="logout-button" onClick={async () => { await api.logout(); setCurrentUser(null); setAuthenticated(false); }}>Sign out</button>
        </div>
      </aside>

      <main id="home">
        <header>
          <button type="button" className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div>
            <p className="eyebrow">{today}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button type="button" className="button primary add-button" onClick={() => setShowForm(true)}><Plus size={18} /> Add person</button>
          </div>
        </header>

        {error && <div className="error-banner"><strong>HumanLoop couldn't complete that request.</strong> {error}</div>}

        {activeView === "settings" ? <SettingsPage
          user={currentUser}
          onUserChanged={setCurrentUser}
          onDataChanged={load}
          onDeleted={() => { setCurrentUser(null); setAuthenticated(false); }}
          notify={notify}
        /> : <>
        {activeView === "home" && <section className="stats">
          <div><span className="stat-icon green"><Users /></span><p>People in your loop</p><strong>{dashboard.counts.contacts || 0}</strong><small>Keep the circle meaningful</small></div>
          <div><span className="stat-icon orange"><Bell /></span><p>Due this week</p><strong>{dashboard.counts.upcoming || 0}</strong><small>Thoughtful moments ahead</small></div>
          <div><span className="stat-icon blue"><MessageSquareText /></span><p>Recent interactions</p><strong>{dashboard.counts.interactions || 0}</strong><small>Over the last 30 days</small></div>
          <div><span className="stat-icon rose"><Sparkles /></span><p>Relationship health</p><strong>{averageScore || "-"}</strong><small>{dashboard.counts.overdue ? `${dashboard.counts.overdue} missed item${dashboard.counts.overdue === 1 ? "" : "s"}: -10/day` : averageScore >= 70 ? "Your network is thriving" : "A few check-ins will help"}</small></div>
        </section>}

        <div className={`content-grid dashboard-view ${activeView}-view`}>
          <section className="card people-card" id="people">
            <div className="card-head">
              <div><p className="eyebrow">Your circle</p><h2>People</h2></div>
              <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." /></div>
            </div>
            <div className="contact-list">
              {contacts.map((contact) => <div className="contact-row" role="button" tabIndex="0" key={contact.id} onClick={() => setSelected(contact.id)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setSelected(contact.id);
              }}>
                <div className="avatar">{initials(contact.name)}</div>
                <div className="contact-name"><strong>{contact.name}</strong><span>{contact.company || contact.email || "Personal contact"}</span></div>
                <div className="last-seen"><span>Last connected</span><strong>{prettyDate(contact.last_interaction)}</strong></div>
                <Score value={contact.relationship_score} />
                <button type="button" className="delete-button" onClick={(e) => removeContact(contact.id, e)} aria-label={`Delete ${contact.name}`}><Trash2 size={16} /></button>
                <ChevronRight className="row-arrow" size={18} />
              </div>)}
              {!contacts.length && <div className="empty-state"><UserRound size={30} /><h3>Your loop starts here</h3><p>Add someone you care about, then log the moments that matter.</p><button type="button" className="button primary" onClick={() => setShowForm(true)}>Add your first person</button></div>}
            </div>
          </section>

          <aside className="right-column">
            <section className="card reminders-card" id="reminders">
              <div className="card-head">
                <div><p className="eyebrow">Stay thoughtful</p><h2>Upcoming</h2></div>
                <button
                  type="button"
                  className={`icon-button card-icon-button ${showScheduleHighlights ? "active" : ""}`}
                  onClick={() => setShowScheduleHighlights(!showScheduleHighlights)}
                  aria-label="Toggle schedule highlights"
                  title="Toggle schedule highlights"
                >
                  <CalendarDays size={20} />
                </button>
              </div>
              <div className="reminder-list">
                {dashboard.reminders.map((item) => <div className="reminder" key={item.id}>
                  <button type="button" className="check-button" onClick={() => complete(item.id)} aria-label={`Complete ${item.title}`}><Check size={14} /></button>
                  <button type="button" className="reminder-copy" onClick={() => setSelected(item.contact_id)}><strong>{item.title}</strong><span>{item.contact_name} - {prettyDate(item.due_date)}</span></button>
                </div>)}
                {!dashboard.reminders.length && <div className="empty-small">You're all caught up. Nicely done.</div>}
              </div>
              {showScheduleHighlights && <div className="card-schedule">
                <div className="card-schedule-head">
                  <button type="button" className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
                  <strong>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
                  <button type="button" className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
                </div>
                <div className="mini-calendar">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => <span className="weekday" key={label}>{label}</span>)}
                  {calendarDays.map((day, index) => day ? <button type="button" className={`mini-day ${day.events.length ? "has-events" : ""}`} key={day.key}>
                    <span>{day.day}</span>
                    {!!day.events.length && <em>{day.events.length}</em>}
                  </button> : <div className="mini-day empty" key={`card-empty-${index}`} />)}
                </div>
                <div className="schedule-list">
                  {calendarEvents.slice(0, 5).map((event) => <button type="button" key={`${event.type}-${event.id}-${event.eventDate}`} onClick={() => setSelected(event.contact_id)}>
                    <span className={`event-dot event-${event.type}`} />
                    <div><strong>{event.type === "meeting" ? "Meetup" : event.type}</strong><small>{event.title} - {prettyDate(event.eventDate)}</small></div>
                  </button>)}
                  {!calendarEvents.length && <div className="empty-small">Scheduled meetings, meetups, reminders, and birthdays will highlight here.</div>}
                </div>
              </div>}
              <div className="reminder-history">
                <div className="history-title"><Clock3 size={14} /><strong>History</strong></div>
                {dashboard.reminderHistory.map((item) => <button type="button" className="history-row" key={item.id} onClick={() => setSelected(item.contact_id)}>
                  <span>{item.title}</span>
                  <small>{item.contact_name} - completed {prettyDate(item.completed_at || item.created_at)}</small>
                </button>)}
                {!dashboard.reminderHistory.length && <div className="empty-small">Completed reminders will show here.</div>}
              </div>
            </section>
            <section className="card birthday-card">
              <div className="card-head"><div><p className="eyebrow">Worth celebrating</p><h2>Birthdays</h2></div><Cake size={20} /></div>
              {dashboard.birthdays.map((person) => <button type="button" key={person.id} onClick={() => setSelected(person.id)}>
                <div className="avatar small">{initials(person.name)}</div>
                <div><strong>{person.name}</strong><span>{prettyDate(person.birthday)}</span></div>
                <em>{daysUntil(person.birthday) === 0 ? "Today" : `${daysUntil(person.birthday)}d`}</em>
              </button>)}
              {!dashboard.birthdays.length && <div className="empty-small birthday-empty">No birthdays yet. Add one to a contact profile to see it here.</div>}
            </section>
            <section className="nudge-card">
              <Sparkles size={22} />
              <div><p className="eyebrow">A gentle nudge</p><h3>Relationships grow in small moments.</h3><p>A two-minute check-in can mean more than a perfectly timed message.</p></div>
            </section>
          </aside>
        </div>
        </>}

      </main>

      {showForm && <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}>
        <div className="modal"><button type="button" className="icon-button modal-close" onClick={() => setShowForm(false)} aria-label="Close add contact form"><X /></button><p className="eyebrow">Grow your circle</p><h2>Add someone new</h2><p className="modal-intro">Start with what you know. You can always add more later.</p><ContactForm onSubmit={createContact} onClose={() => setShowForm(false)} saving={saving} /></div>
      </div>}
      {selected && <ContactPanel contactId={selected} onClose={() => setSelected(null)} onChanged={load} notify={notify} />}
      <AIChat user={currentUser} onChanged={load} />
      {toast && <div className={`toast ${toast.type === "error" ? "error" : ""}`} role="status">{toast.message}</div>}
    </div>
  );
}
