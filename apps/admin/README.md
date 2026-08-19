# CRUDD Admin

Internal content-management dashboard for CRUDD. Manage question banks, questions,
challenges, participants, analytics, platform settings, and view the audit log.

> **Access is enforced server-side.** The browser only authenticates with Supabase;
> every admin action is authorized by the API against the `admin_users` table.

## Stack

- React 19 + Vite + TypeScript (strict)
- React Router, TanStack Query, Zustand
- Tailwind CSS, lucide-react, sonner
- Supabase JS (auth only)

## Setup

```bash
# From the repo root
pnpm install

# Configure environment
cp apps/admin/.env.example apps/admin/.env.local
```

`.env.local`:

```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Develop

```bash
pnpm --filter @crudd/admin dev        # http://localhost:3002
pnpm --filter @crudd/admin typecheck
pnpm --filter @crudd/admin build
```

## Database migration (admin dashboard)

The admin feature adds tables/columns (content status, `admin_users`,
`audit_logs`, `admin_settings`). Apply the schema, then grant yourself admin.

```bash
# Generate the Prisma client and apply schema
pnpm --filter @crudd/database db:generate
pnpm --filter @crudd/database db:migrate      # dev: creates/apply migration

# (or, against an existing DB without shadow support)
pnpm --filter @crudd/database db:push

# Seed publishes demo content so it is visible to players
pnpm --filter @crudd/database db:seed
```

A hand-written reference migration lives at
`packages/database/prisma/migrations-manual/0001_admin_dashboard/migration.sql`.

### Grant an admin

Insert a row in `admin_users` keyed to the Supabase auth user id:

```sql
insert into admin_users (id, email, display_name, role, is_active)
values ('<supabase-auth-uid>', 'you@example.com', 'You', 'SUPER_ADMIN', true);
```

Roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `MODERATOR`.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Overview: content stats + recent activity |
| `/banks` | List/create/search banks |
| `/banks/:id` | Bank detail: stats, health, publish/unpublish/archive, question CRUD |
| `/banks/:id/import` | CSV/JSON import with validation preview |
| `/questions` | Cross-bank question search + bulk publish/unpublish/archive |
| `/challenges` | List/filter challenges |
| `/challenges/:id` | Challenge detail + leaderboard + cancel |
| `/participants` | All challenge participants |
| `/analytics` | Content and engagement metrics |
| `/settings` | Publication policy + challenge defaults + platform toggles |
| `/audit` | Full administrative audit trail |

## Content lifecycle

Banks and questions have a `DRAFT → PUBLISHED → ARCHIVED` status. Only
`PUBLISHED` content is visible to players via the public API. A bank must pass
its health checks (enough valid questions, no critical issues) before it can be
published.
