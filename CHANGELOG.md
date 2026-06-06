# HumanLoop Changelog

## 2026-06-07

### Added

- Multi-user signup, sign-in, logout, and private user sessions.
- Scrypt password hashing and signed HTTP-only session cookies.
- Password confirmation during account creation.
- Forgot-password and one-time password-reset flows.
- Optional password-reset email delivery through Resend.
- Per-user ownership for contacts, meeting notes, reminders, dashboards, and AI context.
- Persistent AI chat history stored in MySQL and restored after page refresh.
- AI CRM actions for adding, updating, and deleting contacts; adding meeting notes and reminders; and completing reminders.
- Server-side validation and ownership checks for every AI-generated database action.
- A lower-right popup AI assistant with conversation clearing and quick prompts.

### Changed

- Replaced the shared workspace password with individual user accounts.
- The sidebar profile displays only the user's name, not their email.
- Dashboard, calendar, birthday, relationship score, and reminder queries are scoped to the signed-in user.
- Deployment configuration now supports `APP_URL`, `RESEND_API_KEY`, and `RESET_FROM_EMAIL`.
- Documentation now describes the multi-user authentication, AI agent, and password-reset APIs.

### Database

- Added `users`.
- Added `contacts.user_id` with ownership index and foreign key.
- Added `chat_messages` for persistent per-user conversations.
- Added `password_reset_tokens` for expiring one-time reset links.
- Added `reminders.completed_at`.

### Verification

- Production Vite build completed successfully.
- Server syntax checks completed successfully.
- Two-account isolation test confirmed cross-user contact access returns `404`.
- Natural-language agent tests successfully created a contact and reminder.
- Chat history persisted across a fresh API history request.
- Password reset successfully changed the password and allowed login with the new password.
- Groq health check reported the configured AI provider and model as available.

### Files Changed

- `.env.example`: added public app URL and password-reset email variables.
- `README.md`: documented accounts, AI agent behavior, environment variables, and endpoints.
- `render.yaml`: added production variables for app URLs and password-reset email.
- `client/src/App.jsx`: added account recovery, password confirmation, persistent AI chat, agent UI, and username-only profile.
- `client/src/api.js`: added account recovery and persistent chat API methods.
- `client/src/styles.css`: added authentication and popup chat styling.
- `server/schema.sql`: added user ownership, chat history, reset tokens, and reminder completion fields.
- `server/src/auth.js`: added password hashing, user sessions, and reset-token helpers.
- `server/src/ai.js`: added structured CRM action planning.
- `server/src/db.js`: added automatic migrations for users, ownership, chat history, and reset tokens.
- `server/src/index.js`: added account APIs, scoped CRM routes, password recovery, chat persistence, and validated AI actions.
