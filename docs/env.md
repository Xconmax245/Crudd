# CRUDD — Environment Variables

Every environment variable the stack needs, where it lives, and an example
value. Source of truth for local `.env` files and the production `.env.prod`
consumed by `docker-compose.prod.yml`.

- Committed templates: each app ships a `.env.example`; the repo root ships
  `.env.prod.example`. Copy → fill in real values → **never commit the filled
  copy** (`.env`, `.env.*` are gitignored except `*.example`).
- `VITE_*` values are **build-time** for the web/admin bundles — they are baked
  into the static build, not read at runtime. In Docker they are passed as
  `build.args` (see `docker-compose.prod.yml`).

---

## API — `apps/api/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string used by the app. Use the **pooled** endpoint (e.g. pgbouncer) if available. | `postgres://user:pass@host:6543/crudd?pgbouncer=true` |
| `DIRECT_URL` | ✅ | Direct (unpooled) Postgres connection for Prisma **migrations**. Falls back to `DATABASE_URL` if unset. | `postgres://user:pass@host:5432/crudd` |
| `REDIS_URL` | ✅ | Redis connection for live match state + the Socket.IO adapter. | `redis://localhost:6379` |
| `FRONTEND_URL` | ✅ | Player app origin — used for CORS **and** the share-link base. | `http://localhost:3000` |
| `ADMIN_URL` | ✅ | Admin app origin — added to the CORS allow-list. | `http://localhost:3002` |
| `LANDING_URL` | – | Landing-page origin — added to the CORS allow-list. | `http://localhost:5173` |
| `PORT` | – | HTTP + Socket.IO port. Defaults to `3001`. | `3001` |
| `NODE_ENV` | – | `production` in deployed environments. | `production` |
| `LOG_LEVEL` | – | Pino level. Defaults to `info` in production, `debug` otherwise; silent under tests. | `info` |
| `SENTRY_DSN` | – | Sentry DSN. **Leave blank to disable** — the SDK becomes a no-op. | `https://…@…ingest.sentry.io/…` |
| `SENTRY_ENVIRONMENT` | – | Sentry environment tag. Defaults to `NODE_ENV`. | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | – | Performance-trace sample rate `0`–`1`. Defaults to `0`. | `0.1` |
| `SUPABASE_URL` | ✅¹ | Supabase project URL — used to verify admin access tokens. | `https://xxxx.supabase.co` |

| `SUPABASE_ANON_KEY` | ✅¹ | Supabase public anon key. | `eyJhbGci...` |
| `ADMIN_BOOTSTRAP_EMAILS` | – | Comma-separated emails auto-provisioned as `SUPER_ADMIN` on first login. | `you@example.com,ops@example.com` |

¹ Required only if the admin dashboard is deployed.

---

## Web (player) — `apps/web/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_URL` | ✅ | Base URL of the API for REST calls. | `http://localhost:3001` |
| `VITE_SOCKET_URL` | – | Socket.IO base URL. Defaults to `VITE_API_URL` if unset. | `http://localhost:3001` |

> The player client currently derives the socket URL from `VITE_API_URL`.
> `VITE_SOCKET_URL` is reserved for deployments that terminate WebSockets on a
> separate host/path; set both to the same value otherwise.

---

## Landing — `apps/landing/.env`

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_APP_URL` | – | Player-app origin the landing CTAs ("Start a Challenge" / "Join a Match") link to. Defaults to `http://localhost:3000`. | `https://play.crudd.app` |

> The landing page is a static marketing artifact — it makes no API calls and
> needs no backend config beyond this link target.

---

## Admin — `apps/admin/.env`

| Variable | Required | Description | Example |

|---|---|---|---|
| `VITE_API_URL` | ✅ | Base URL of the API. | `http://localhost:3001` |
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL (public client, admin auth). | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key. | `eyJhbGci...` |

---

## Production compose — root `.env.prod`

Consumed by `docker-compose.prod.yml`. Superset of the above plus the values
used to provision the bundled Postgres/Redis and to publish container ports.
See `.env.prod.example` for a ready-to-copy template.

| Variable | Required | Description | Example |
|---|---|---|---|
| `POSTGRES_USER` | – | Bundled Postgres user. Default `crudd`. | `crudd` |
| `POSTGRES_PASSWORD` | ✅ | Bundled Postgres password (compose fails fast if unset). | `change-me` |
| `POSTGRES_DB` | – | Bundled Postgres database name. Default `crudd`. | `crudd` |
| `DATABASE_URL` | ✅ | App DB URL. Point at the `postgres` service, e.g. host `postgres`. | `postgres://crudd:change-me@postgres:5432/crudd` |
| `DIRECT_URL` | – | Migration DB URL. Defaults to `DATABASE_URL`. | `postgres://crudd:change-me@postgres:5432/crudd` |
| `REDIS_URL` | – | Defaults to `redis://redis:6379` (the bundled service). | `redis://redis:6379` |
| `FRONTEND_URL` | ✅ | Public player origin (CORS + share links). | `https://play.crudd.app` |
| `ADMIN_URL` | ✅ | Public admin origin (CORS). | `https://admin.crudd.app` |
| `SUPABASE_URL` | ✅¹ | Supabase project URL (API-side token verification). | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅¹ | Supabase anon key (API-side). | `eyJhbGci...` |
| `ADMIN_BOOTSTRAP_EMAILS` | – | Bootstrap super-admin emails. | `you@example.com` |
| `VITE_API_URL` | ✅ | Baked into web + admin builds. Public API URL. | `https://api.crudd.app` |
| `VITE_SOCKET_URL` | – | Baked into web build. Defaults to `VITE_API_URL`. | `https://api.crudd.app` |
| `VITE_SUPABASE_URL` | ✅¹ | Baked into admin build. | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅¹ | Baked into admin build. | `eyJhbGci...` |
| `API_PORT` | – | Host port mapped to the API. Default `3001`. | `3001` |
| `WEB_PORT` | – | Host port mapped to web nginx. Default `3000`. | `3000` |
| `ADMIN_PORT` | – | Host port mapped to admin nginx. Default `3002`. | `3002` |

¹ Required only if the admin dashboard is deployed.

---

## Scaling note (sticky sessions)

The API attaches the `@socket.io/redis-adapter` so real-time broadcasts fan out
across replicas. However, each match's authoritative countdown/question timing
is driven by a Redis-backed sweeper that assumes a match's sockets are handled
by a single process. **For MVP scale, run a single `api` replica** (no extra
config needed). To scale horizontally, front the API with a load balancer using
**sticky sessions** (nginx `ip_hash`, or cookie/affinity-based routing) so a
given client consistently reaches the same process. This is a documented,
accepted MVP limitation.
