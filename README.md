# HumanLoop

HumanLoop v2 is a multi-user AI personal CRM for remembering the details that make relationships meaningful. It includes private accounts, contact management, meeting notes with AI summaries, follow-up suggestions, reminders, birthdays, relationship health scores, a persistent AI agent, account security settings, and portable data tools.

## V2 highlights

- Account profile, password, TOTP two-factor authentication, login history, and account deletion.
- CSV and Excel contact import plus CSV, Excel, and JSON exports.
- Full JSON backup and transactional merge or replace restore.
- Per-user storage usage reporting.
- Settings page with version, about, creator, and credits.
- Calendar weekday labels and corrected event markers.
- Password visibility controls on sign-in, signup, and reset forms.
- Contact profile pictures stored as external image URLs without backend file storage.
- AI meeting recaps with note-grounded next-step suggestions and schedulable follow-up reminders.
- Latest-message chat positioning and responsive tablet/mobile dashboard layouts.

## Performance

- Spreadsheet libraries are downloaded only when import or export is used.
- Backups and dashboard data use parallel, indexed queries.
- Large contact imports are inserted in transactional batches.
- Production responses use compression and immutable caching for hashed assets.
- Hosted builds use lockfile-based `npm ci` installs.

## Stack

- React 19 + Vite
- Node.js + Express
- MySQL
- Groq API with optional xAI and OpenAI fallbacks

## Local setup

1. Install MySQL and make sure the server is running.
2. Copy `.env.example` to `.env` and set your MySQL credentials.
3. Add a valid `GROQ_API_KEY` to `.env`. Without one, HumanLoop uses helpful local fallbacks, so every workflow still functions.
4. Install dependencies:

   ```bash
   npm run install:all
   ```

5. Start both the API and frontend:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:5173`.

The API automatically creates the configured database and tables at startup. The SQL definition is also available at `server/schema.sql`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Express API port |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |
| `APP_URL` | current server URL | Public frontend URL used in password-reset links |
| `SESSION_SECRET` | none | Required random value of at least 32 characters used to sign sessions |
| `COOKIE_SECURE` | `false` locally | Keep `true` on HTTPS production deployments |
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | empty | MySQL password |
| `MYSQL_DATABASE` | `humanloop` | Database name |
| `MYSQL_SSL` | `false` | Set to `true` for managed MySQL providers that require TLS |
| `MYSQL_CA_CERT` | empty | Hosted MySQL CA certificate; paste the full PEM certificate |
| `GROQ_API_KEY` | empty | Enables live Groq-hosted AI features |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model used for CRM assistance |
| `XAI_API_KEY` | empty | Optional xAI Grok provider |
| `XAI_MODEL` | `grok-3-mini` | Optional xAI model |
| `OPENAI_API_KEY` | empty | Optional fallback AI provider |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Optional OpenAI fallback model |
| `RESEND_API_KEY` | empty | Sends forgot-password emails through Resend |
| `RESET_FROM_EMAIL` | Resend test sender | Verified sender used for password-reset emails |

## Free online deployment

HumanLoop is configured for a free native Node deployment on Render with a free
Aiven MySQL database. It remains reachable when your laptop is shut down.

Render's free web service sleeps after 15 minutes without traffic and wakes on
the next request. The first request after sleeping can take about one minute.

### 1. Create the free MySQL database

1. Create an Aiven account and a free MySQL service.
2. Open the service's **Connection information**.
3. Keep these values ready: host, port, user, password, and database name.
4. Download the service CA certificate and open it in a text editor.

### 2. Deploy the web service

[Deploy HumanLoop on Render](https://render.com/deploy?repo=https://github.com/CodeWithKiel/AI-Personal-CRM-V2)

Connect the GitHub repository and enter the requested environment values:

| Render variable | Value |
| --- | --- |
| `APP_URL` | Your Render URL, such as `https://humanloop-v2.onrender.com` |
| `MYSQL_HOST` | Aiven host |
| `MYSQL_PORT` | Aiven port |
| `MYSQL_USER` | Aiven user |
| `MYSQL_PASSWORD` | Aiven password |
| `MYSQL_DATABASE` | Aiven database name, commonly `defaultdb` |
| `MYSQL_CA_CERT` | Full contents of the downloaded Aiven CA certificate |
| `GROQ_API_KEY` | Your Groq API key |
| `RESEND_API_KEY` | Optional, for password-reset email |
| `RESET_FROM_EMAIL` | Optional verified Resend sender |

Render automatically generates the session secret, builds the React app, starts
the Express API, enables HTTPS, and deploys future commits from `main`.

### 3. Verify

Open the Render URL and create an account. The deployment health endpoint is:

```text
https://your-render-url.onrender.com/api/health
```

## Installable app and Android APK

HumanLoop is an installable Progressive Web App. Browser users can select
**Install app** or **Add to Home Screen** without changing how the normal website
works.

To generate an Android package without Expo or Android Studio:

1. Wait for the latest Render deployment to become live.
2. Open [PWABuilder](https://www.pwabuilder.com/).
3. Enter `https://humanloop-v2.onrender.com`.
4. Choose **Package for stores**, then **Android**.
5. Use package ID `ph.vibecoders.humanloop` and app name `HumanLoop`.
6. Download the generated Android package.

The installed app requires internet access for CRM data and AI features. Its
service worker keeps the app shell available and displays a safe offline state;
API responses and private CRM data are never cached.

## Self-hosted production

Build the React app:

```bash
npm run build
```

Set `NODE_ENV=production`, configure the environment variables, and run:

```bash
npm start
```

Express serves the compiled React app from `client/dist`. Any host that supports
a persistent Node process and managed MySQL can run the app.

## API overview

- `GET/POST /api/contacts`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET/PUT/DELETE /api/contacts/:id`
- `POST /api/contacts/:id/notes`
- `POST /api/contacts/:id/ai/follow-up`
- `GET /api/contacts/:id/ai/highlights`
- `POST /api/reminders`
- `PATCH /api/reminders/:id`
- `GET /api/dashboard`
- `POST /api/ai/chat`
- `GET/DELETE /api/ai/chat`
