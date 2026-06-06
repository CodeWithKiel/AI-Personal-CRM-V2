async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  session: () => request("/api/auth/session"),
  login: (password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  dashboard: () => request("/api/dashboard"),
  contacts: (search = "") => request(`/api/contacts?search=${encodeURIComponent(search)}`),
  contact: (id) => request(`/api/contacts/${id}`),
  createContact: (data) => request("/api/contacts", { method: "POST", body: JSON.stringify(data) }),
  updateContact: (id, data) => request(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/api/contacts/${id}`, { method: "DELETE" }),
  addNote: (id, data) => request(`/api/contacts/${id}/notes`, { method: "POST", body: JSON.stringify(data) }),
  followUp: (id) => request(`/api/contacts/${id}/ai/follow-up`, { method: "POST" }),
  highlights: (id) => request(`/api/contacts/${id}/ai/highlights`),
  createReminder: (data) => request("/api/reminders", { method: "POST", body: JSON.stringify(data) }),
  completeReminder: (id) => request(`/api/reminders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) })
};
