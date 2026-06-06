# HumanLoop

HumanLoop is a simple AI-ready personal CRM for remembering the details that make relationships meaningful. It includes contact management, meeting notes with AI summaries, follow-up suggestions, reminders, birthdays, and relationship health scores.

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
| `APP_PASSWORD` | none | Required private workspace password, minimum 12 characters |
| `SESSION_SECRET` | none | Required random value of at least 32 characters used to sign sessions |
| `COOKIE_SECURE` | `false` locally | Keep `true` on HTTPS production deployments |
| `MYSQL_HOST` | `localhost` | MySQL host |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | empty | MySQL password |
| `MYSQL_DATABASE` | `humanloop` | Database name |
| `MYSQL_SSL` | `false` | Set to `true` for managed MySQL providers that require TLS |
| `GROQ_API_KEY` | empty | Enables live Groq-hosted AI features |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model used for CRM assistance |
| `XAI_API_KEY` | empty | Optional xAI Grok provider |
| `XAI_MODEL` | `grok-3-mini` | Optional xAI model |
| `OPENAI_API_KEY` | empty | Optional fallback AI provider |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Optional OpenAI fallback model |

## Production

Build the React app:

```bash
npm run build
```

Set `NODE_ENV=production`, configure the environment variables, and run:

```bash
npm start
```

Express serves the compiled React app from `client/dist`. Any host that supports a persistent Node process and managed MySQL works, including Railway, Render, Fly.io, or a VPS.

### Render deployment

1. Push the project to a Git repository.
2. Create a managed MySQL database and copy its connection values.
3. In Render, create a Blueprint from the included `render.yaml`.
4. Enter the requested MySQL and Groq environment variables.
5. Set `MYSQL_SSL=true` when required by the database provider.

HumanLoop uses a single private workspace login. Set a strong `APP_PASSWORD`; Render generates `SESSION_SECRET` automatically from `render.yaml`.

The included `Dockerfile` builds the React frontend and runs the production Express server as one web service. The deployment health check is `/api/health`.

## API overview

- `GET/POST /api/contacts`
- `GET/PUT/DELETE /api/contacts/:id`
- `POST /api/contacts/:id/notes`
- `POST /api/contacts/:id/ai/follow-up`
- `GET /api/contacts/:id/ai/highlights`
- `POST /api/reminders`
- `PATCH /api/reminders/:id`
- `GET /api/dashboard`
