#!/bin/sh
# ---------------------------------------------------------------------------
# API container entrypoint.
#
# 1. Apply the database schema before the server accepts traffic.
#    - If a Prisma migrations directory exists, use `migrate deploy` (the
#      production-safe, no-prompt path).
#    - Otherwise fall back to `db push` (this repo currently ships the schema
#      without a generated migration history; see prisma/migrations-manual).
# 2. Exec the server via tsx so SIGTERM/SIGINT reach the Node process directly
#    (PID 1), letting the graceful-shutdown handler in src/index.ts run.
# ---------------------------------------------------------------------------
set -e

cd /app

echo "[entrypoint] Skipping migrations on boot (assumes schema is pushed)..."

echo "[entrypoint] Starting API..."
exec pnpm --filter @crudd/api exec tsx src/index.ts
