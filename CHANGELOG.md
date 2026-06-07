# HumanLoop Changelog

## PWA and Android Packaging

### Added

- Added an installable web app manifest with HumanLoop branding and standalone display mode.
- Added 192px, 512px, and Android maskable PNG icons.
- Added a production service worker for the app shell and static assets.
- Added a dedicated offline experience without caching API responses or private CRM data.
- Added mobile and Apple install metadata.
- Added PWABuilder instructions using package ID `ph.vibecoders.humanloop`.

### Deployment

- Service worker, manifest, and offline files use `no-cache` headers so future Render deployments update correctly.
- Existing hashed JavaScript and CSS assets retain long-lived production caching.

### Files Changed

- `client/index.html` - Added PWA, mobile, manifest, icon, and app-description metadata.
- `client/src/main.jsx` - Registers the service worker only in production.
- `client/public/manifest.webmanifest` - Defines installable app identity, theme, display mode, and icons.
- `client/public/sw.js` - Provides update-safe shell caching and excludes all API requests.
- `client/public/offline.html` - Provides the offline fallback experience.
- `client/public/icons/` - Contains standard and maskable Android app icons.
- `server/src/index.js` - Adds update-safe cache headers for PWA control files.
- `README.md` - Documents browser installation and PWABuilder Android packaging.
- `CHANGELOG.md` - Records this PWA release and changed-file inventory.

## Relationship Workflow Update

### Added

- Added contact profile pictures through external image URLs; only the URL is saved in MySQL and no image files are stored by HumanLoop.
- Added a calendar date picker when turning an AI follow-up suggestion into a reminder.
- Added multiple randomized relationship nudges with a control to show another quote.

### Improved

- AI meeting-note recaps now use the contact and recent meeting history and include a specific next step grounded in the submitted note.
- AI follow-up suggestions explicitly prioritize real topics, commitments, and personal details from recent meeting notes.
- Opening the AI assistant now scrolls directly to the newest saved conversation.
- Dashboard, sidebar, cards, contact rows, and header controls switch layouts earlier for tablet and narrow laptop widths.
- Contact image URLs are preserved in CSV/Excel exports, JSON backup and restore, and bulk imports.

### Files Changed

- `client/src/App.jsx` - Added contact-photo rendering/editing, reminder date selection, latest-chat scrolling, randomized nudges, and updated meeting insight labels.
- `client/src/styles.css` - Added photo, reminder popover, meeting insight, and revised responsive layout styles.
- `server/src/ai.js` - Grounded meeting summaries and follow-up prompts in contact and meeting-note context.
- `server/src/db.js` - Added the automatic `contacts.image_url` migration.
- `server/src/index.js` - Added image URL validation and persistence across CRUD, import/export, backup/restore, AI actions, and storage reporting.
- `server/schema.sql` - Added `image_url` to the canonical contacts schema.
- `README.md` - Documented the new relationship workflow capabilities.
- `CHANGELOG.md` - Recorded this release and its changed-file inventory.

## Dashboard Experience

- Added a new HumanLoop loop-mark favicon.
- Added a branded splash screen during session startup.
- Added responsive skeleton loaders while contacts and dashboard data load.
- Changed the home greeting automatically between morning, afternoon, and evening.
- Moved the "A gentle nudge" message beside the home greeting for immediate visibility.

## Online Hosting

- Replaced the Docker-based Render deployment with a free native Node web service.
- Added a one-click Render Blueprint configured for Singapore, automatic deploys, health checks, and generated session secrets.
- Added secure Aiven MySQL CA-certificate support.
- Added step-by-step free hosting instructions for Render and Aiven.

## Startup Fix

- The Express server now serves an existing React production build even when the local `.env` uses development mode.
- Fixed `npm start` returning a 404 for the app while the API remained healthy.

## Workspace Cleanup

- Updated the app creator credit to VibeCodersPH.
- Removed generated QA browser profiles, screenshots, and development logs.

## 2026-06-07 - Version 2.0.0

### Optimized

- Reduced initial JavaScript from about 364 KB to 252 KB by loading CSV and Excel tooling only when requested.
- Replaced per-contact backup queries with four parallel bulk queries.
- Parallelized independent dashboard, contact-detail, and AI-context database reads.
- Changed contact imports to transactional 250-row bulk inserts.
- Added composite indexes for birthdays, meeting dates, reminder status/dates, and password-reset lookups.
- Contact search no longer reloads dashboard data on every keystroke and ignores stale search responses.
- Limited restored chat UI history to the latest 200 messages while retaining full database history.
- Added automatic cleanup for expired in-memory login rate-limit entries.
- Added HTTP compression and long-lived caching for hashed production assets.
- Added MySQL connection keepalive, idle-pool tuning, and graceful shutdown handling.
- Changed Docker dependency installation to deterministic `npm ci`.

### Performance Verification

- Imported 1,000 contacts in approximately 344 ms.
- Exported a 1,000-contact backup in approximately 78 ms.
- Loaded the dashboard for the scale-test account in approximately 26 ms.
- Built the optimized production Docker image successfully.

### Added

- Settings area for profile name, email, and phone.
- Password changes with current-password verification.
- TOTP two-factor authentication with QR setup and login challenges.
- Login activity and access-attempt history.
- Permanent account deletion with password confirmation.
- CSV and Excel contact import.
- CSV and Excel contact export.
- Full JSON backup, merge restore, and replace restore.
- Per-user storage usage counts and estimated size.
- App version, about, creator, and credits information.
- Password visibility toggles for authentication forms.
- Calendar weekday headings.

### Fixed

- Calendar event markers no longer inherit reminder-row sizing and appear as consistent circular dots.
- Login subtitle now uses a short relationship-focused quote.

### Security

- Two-factor secrets are encrypted at rest with AES-256-GCM using the session secret.
- Data restore operations use database transactions.
- Account deletion removes login activity along with all account-owned CRM data.
- Client and server production dependencies pass `npm audit` with zero known vulnerabilities.

### Verification

- Production frontend build completed successfully.
- Profile, import, export, storage, 2FA challenge/login, activity history, backup restore, and account deletion passed end-to-end API testing.

### Files Changed

- `CHANGELOG.md` - Recorded the v2 feature, optimization, security, cleanup, and verification notes.
- `Dockerfile` - Switched production dependency installation to deterministic clean installs.
- `README.md` - Updated setup, configuration, deployment, authentication, settings, and AI documentation.
- `package.json` and `package-lock.json` - Updated root scripts and dependency metadata.
- `client/package.json` and `client/package-lock.json` - Added client import/export dependencies and updated metadata.
- `client/src/App.jsx` - Added settings, 2FA flows, data management, password visibility, calendar fixes, creator details, and frontend performance improvements.
- `client/src/api.js` - Added client methods for account settings, security, activity, import/export, backup/restore, storage, and account deletion.
- `client/src/styles.css` - Added settings, security, data-management, calendar, password, and responsive UI styles.
- `server/package.json` and `server/package-lock.json` - Added server security, compression, QR, and 2FA dependencies.
- `server/schema.sql` - Added account settings, 2FA, login activity, reset, and query-performance schema updates.
- `server/src/auth.js` - Added encrypted 2FA secret handling and authentication security helpers.
- `server/src/db.js` - Added database pool tuning, schema migrations, indexes, and graceful shutdown support.
- `server/src/index.js` - Added settings, 2FA, activity, import/export, backup/restore, storage, deletion, and optimized API behavior.

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
