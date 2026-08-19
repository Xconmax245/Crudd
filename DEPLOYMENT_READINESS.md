# CRUDD — Deployment Readiness Checklist

Status of the build against `BUILD_DIRECTIVE.md`, grounded in the current code.
Legend: ✅ done · 🟡 partial · ❌ missing

---

## ✅ What's already done

- **Phase 0 – Landing** (`apps/landing`): built & audited.
- **Phase 1 – Core app shell** (`apps/web`): Browse → Configure → Challenge create + share link; challenge creation locks a randomized question set/order and per-challenge shuffled options (`apps/api/src/routes.ts`).
- **Phase 2 – Real-time match** (`apps/api/src/match/*`, `apps/web` match UI):
  - Server-authoritative engine, Socket.IO gateway, Redis live state.
  - §8 rules honored: server owns timing; correct answer never sent pre-reveal; one answer/player/question; late/duplicate/invalid answers rejected; server-received timestamps used.
  - Web `MatchRoom` with lobby, synced timer, reveal, final leaderboard.
- **Admin app** (`apps/admin`): banks/questions/challenges/participants/analytics/settings/audit pages exist.
- API hardening basics: `helmet`, `cors` (env-driven), `rate-limit`, Zod validation.
- Both `@crudd/web` and `@crudd/api` typecheck and build cleanly.

---

## ✅ P0 — Blockers before any real deployment (RESOLVED)

- [x] **Socket.IO scale-out via Redis adapter.** `@socket.io/redis-adapter` is wired in `apps/api/src/index.ts` so broadcasts fan out across replicas. Authoritative question deadlines moved off in-process `setTimeout` to a Redis-backed `questionEndsAt` + a single sweeper loop. **Documented MVP constraint:** run one `api` replica, or front with sticky sessions to scale (see `docs/env.md`).
- [x] **Crash recovery mid-match (re-hydration).** On boot the engine scans Redis for matches in `QUESTION`/`REVEAL`, reloads questions from the DB, and re-arms the sweeper against stored deadlines — no replay, minimal re-broadcast (clients rejoin to current state).
- [x] **Graceful shutdown.** `apps/api/src/index.ts` handles `SIGTERM`/`SIGINT`: stops accepting connections, closes Socket.IO, quits Redis, disconnects Prisma, then exits.
- [x] **Container/deploy manifests.** Multi-stage `Dockerfile`s for `api` (Node) and `web`/`admin` (nginx static), plus root `docker-compose.prod.yml` (postgres + redis + api + web + admin, named volumes, `api` health check on `/api/health`, migrations via `docker-entrypoint.sh` running `prisma migrate deploy`).
- [x] **Env/secrets documented + wired.** `docs/env.md` enumerates every var; committed `.env.example` per app + root `.env.prod.example`; compose reads all values from `.env.prod`.


---

## ✅ P1 — MVP spec gaps (RESOLVED)

- [x] **`STARTING` countdown phase (§7.8, §9).** Added `STARTING` to `MatchPhase` between `LOBBY` and `QUESTION`. `lobby:start` transitions to `STARTING`, broadcasts `match:countdown` with `{ startsAt }`, and the server drives the advance to Q0 after 3s. Client renders 3‑2‑1‑Go from the timestamp (no client-side transition timer).
- [x] **Host-leave handling (§6).** Host disconnect pre-start promotes the next connected participant (DB + Redis + `lobby:state` with new host flagged); if none remain the challenge goes `CANCELLED` with `lobby:cancelled`. Host disconnect during a live match is a no-op (match continues).
- [x] **Final-results stats (§7.10, §15).** `MatchEndPayload` now includes per-player `correctCount`, `totalQuestions`, `avgResponseMs` (correct answers only), and `accuracy`, computed from `match_answers` at end. Results screen adds a Scores/Stats toggle plus "Rematch" (host) and "Back to Browse".
- [x] **Rejoin across all phases.** Last broadcast payload per phase is stored in Redis; rejoin now returns `match:question_results` during REVEAL and `match:finished` after END (LOBBY already handled). Reveal payload carries its own `options` so reconnecting clients render correctly.
- [x] **Scoring formula locked (§10).** `calculateScore` bracket curve is locked per §16; comment updated, tuning is post-launch only.
- [x] **Reduced-motion honored in match UI (§13.1/§13.4).** All `MatchRoom` views (`Countdown`, `Lobby`, `Question`, `Reveal`, `Results`, `Leaderboard`) and `LoadingBlob` gate transforms behind `useReducedMotion()`, falling back to opacity-only.


---

## 🟡 P2 — Hardening, quality & polish

Addendum-scoped items — done:

- [x] **Redis cleanup no longer relies solely on TTL.** `clearMatch(challengeId, questionCount)` is called explicitly in `endMatch` and on `CANCELLED`; keys are cleared immediately (6h TTL remains a backstop).
- [x] **Auto-close edge case guarded.** `endQuestion` triggers only when `connected.length > 0 && answerCount >= connected.length`, so a fully-disconnected room won't spuriously auto-close.
- [x] **Socket-layer abuse controls.** Per-socket sliding-window rate limit (≤5 events/sec) enforced on `join`/`start`/`submit`/`next` in `gateway.ts`; over-budget events rejected with `RATE_LIMITED`.
- [x] **Web bundle under threshold.** Route-level `React.lazy` + `Suspense` in `apps/web/src/App.tsx`; each page is its own chunk (`MatchRoom` ~64 kB) and the initial chunk (~412 kB) builds with **no >500 kB warning**.

Remaining (broader hardening, not blocking MVP launch):

- [x] **Automated tests.** Validated core authoritative engine, host guards, state transitions, and socket flow. `engine.test.ts` and `gateway.test.ts` fully pass.
- [x] **CI pipeline.** `ci.yml` added for lint, typecheck, and test gates on main/PRs.
- [x] **Observability.** Match layer logs to `logger` (Pino) and Sentry tracks 5xx API errors. Node process exceptions and unhandled rejections are gracefully handled and sent to Sentry.


---

## Deployment infra checklist

- [x] Dockerfiles for `api`, `web`, `admin` (+ prod `docker-compose.prod.yml`).
- [x] Bundled **Postgres** + **Redis** in prod compose; `prisma migrate deploy` runs from the api entrypoint on release.
- [x] DB story confirmed: pooled `DATABASE_URL` + unpooled `DIRECT_URL` for migrations; Supabase powers admin auth (documented in `docs/env.md`).
- [x] Prod CORS/socket origins (`FRONTEND_URL`, `ADMIN_URL`) and web/admin `VITE_*` build vars documented + passed as compose build args.
- [x] Redis adapter added for multi-replica broadcast; sticky-session requirement documented as the MVP scaling path.
- [x] Health check wired to `/api/health` (compose healthcheck on the `api` service).
- [x] Provision managed Postgres/Redis in the target environment (or use the bundled services) and set real secrets in `.env.prod`.
- [x] TLS/WSS termination at the proxy/load balancer in front of compose. (nginx added)
- [x] Seed/publish at least one PUBLISHED bank (public play requires `status: PUBLISHED`).

---

## Open product decisions (§16 — now locked per the Readiness Addendum)

- [x] **Scoring curve** — locked as-is (the existing bracket); tune post-launch.
- [x] **Accounts** — post-MVP; guest-only (username) at launch. No auth flows built.
- [x] **Question import** — DB seeding + admin JSON upload only; no end-user import UI.
- [x] **Tagline / wordmark** — updated to "CRUDD — Prove You Know It", generic texts removed.

---

### Quick local-test note
Ports **3000–3002** are freed automatically: a cross-platform `predev` hook
(`scripts/free-ports.mjs`, also runnable via `pnpm free-ports`) kills any stale
listener before `pnpm dev`, so web no longer falls back to **:3003** and breaks
CORS (which is locked to :3000/:3002).


