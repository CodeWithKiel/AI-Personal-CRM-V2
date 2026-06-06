import { useEffect, useMemo, useState } from "react";
import {
  Bell, Cake, CalendarDays, Check, ChevronRight,
  CircleUserRound, Clock3, Mail, Menu, MessageSquareText, Phone,
  Plus, Search, Sparkles, Trash2, UserRound, Users, X
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

function Score({ value = 10 }) {
  const color = value >= 75 ? "#167a61" : value >= 45 ? "#c67936" : "#a8524d";
  return (
    <div className="score" style={{ "--score-color": color }}>
      <span>{value}</span>
      <small>score</small>
    </div>
  );
}

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onLogin();
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
        <p className="eyebrow">Private workspace</p>
        <h1>Welcome back.</h1>
        <p>Your relationships and notes are protected.</p>
        <label>Workspace password<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
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
  const [contacts, setContacts] = useState([]);
  const [dashboard, setDashboard] = useState({ counts: {}, birthdays: [], reminders: [] });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.session()
      .then((result) => setAuthenticated(result.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const notify = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };
  const goTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search, authenticated]);

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

  if (authenticated === null) return <div className="app-loading">Opening HumanLoop...</div>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span /><span /></div><strong>HumanLoop</strong></div>
        <nav>
          <button type="button" className="active" onClick={() => goTo("home")}><CircleUserRound size={19} /> Home</button>
          <button type="button" onClick={() => goTo("people")}><Users size={19} /> People <span>{contacts.length}</span></button>
          <button type="button" onClick={() => goTo("reminders")}><Bell size={19} /> Reminders <span>{dashboard.counts.upcoming || 0}</span></button>
        </nav>
        <div className="sidebar-foot">
          <div className="user-avatar">P</div>
          <div><strong>Your workspace</strong><small>Personal CRM</small></div>
          <button type="button" className="logout-button" onClick={async () => { await api.logout(); setAuthenticated(false); }}>Sign out</button>
        </div>
      </aside>

      <main id="home">
        <header>
          <button type="button" className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu /></button>
          <div>
            <p className="eyebrow">{today}</p>
            <h1>Good morning.</h1>
            <p>Here's who could use a little attention today.</p>
          </div>
          <button type="button" className="button primary add-button" onClick={() => setShowForm(true)}><Plus size={18} /> Add person</button>
        </header>

        {error && <div className="error-banner"><strong>HumanLoop couldn't complete that request.</strong> {error}</div>}

        <section className="stats">
          <div><span className="stat-icon green"><Users /></span><p>People in your loop</p><strong>{dashboard.counts.contacts || 0}</strong><small>Keep the circle meaningful</small></div>
          <div><span className="stat-icon orange"><Bell /></span><p>Due this week</p><strong>{dashboard.counts.upcoming || 0}</strong><small>Thoughtful moments ahead</small></div>
          <div><span className="stat-icon blue"><MessageSquareText /></span><p>Recent interactions</p><strong>{dashboard.counts.interactions || 0}</strong><small>Over the last 30 days</small></div>
          <div><span className="stat-icon rose"><Sparkles /></span><p>Relationship health</p><strong>{averageScore || "—"}</strong><small>{averageScore >= 70 ? "Your network is thriving" : "A few check-ins will help"}</small></div>
        </section>

        <div className="content-grid">
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
              <div className="card-head"><div><p className="eyebrow">Stay thoughtful</p><h2>Upcoming</h2></div><CalendarDays size={20} /></div>
              <div className="reminder-list">
                {dashboard.reminders.map((item) => <div className="reminder" key={item.id}>
                  <button type="button" className="check-button" onClick={() => complete(item.id)} aria-label={`Complete ${item.title}`}><Check size={14} /></button>
                  <button type="button" className="reminder-copy" onClick={() => setSelected(item.contact_id)}><strong>{item.title}</strong><span>{item.contact_name} · {prettyDate(item.due_date)}</span></button>
                </div>)}
                {!dashboard.reminders.length && <div className="empty-small">You're all caught up. Nicely done.</div>}
              </div>
            </section>
            <section className="card birthday-card">
              <div className="card-head"><div><p className="eyebrow">Worth celebrating</p><h2>Birthdays</h2></div><Cake size={20} /></div>
              {dashboard.birthdays.map((person) => <button type="button" key={person.id} onClick={() => setSelected(person.id)}>
                <div className="avatar small">{initials(person.name)}</div>
                <div><strong>{person.name}</strong><span>{prettyDate(person.birthday)}</span></div>
                <em>{daysUntil(person.birthday) === 0 ? "Today" : `${daysUntil(person.birthday)}d`}</em>
              </button>)}
              {!dashboard.birthdays.length && <div className="empty-small">Add birthdays to see them here.</div>}
            </section>
            <section className="nudge-card">
              <Sparkles size={22} />
              <div><p className="eyebrow">A gentle nudge</p><h3>Relationships grow in small moments.</h3><p>A two-minute check-in can mean more than a perfectly timed message.</p></div>
            </section>
          </aside>
        </div>
      </main>

      {showForm && <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}>
        <div className="modal"><button type="button" className="icon-button modal-close" onClick={() => setShowForm(false)} aria-label="Close add contact form"><X /></button><p className="eyebrow">Grow your circle</p><h2>Add someone new</h2><p className="modal-intro">Start with what you know. You can always add more later.</p><ContactForm onSubmit={createContact} onClose={() => setShowForm(false)} saving={saving} /></div>
      </div>}
      {selected && <ContactPanel contactId={selected} onClose={() => setSelected(null)} onChanged={load} notify={notify} />}
      {toast && <div className={`toast ${toast.type === "error" ? "error" : ""}`} role="status">{toast.message}</div>}
    </div>
  );
}
