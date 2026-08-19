# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRUDD API image (Fastify + Socket.IO match gateway).
#
# The workspace packages (@crudd/shared, @crudd/database, @crudd/scoring,
# @crudd/validation) publish RAW TypeScript via `main: src/index.ts`, so we run
# the API through `tsx` at runtime rather than shipping a compiled dist/. This
# keeps module resolution identical to `pnpm dev` and avoids a fragile
# cross-package tsc build. Prisma Client is still generated at build time.
# ---------------------------------------------------------------------------

# ---- Stage 1: deps + prisma generate ----
FROM node:20-alpine AS build
WORKDIR /app

# pnpm via corepack (version pinned in root package.json#packageManager)
RUN corepack enable

# Copy the workspace manifests first so dependency install is cache-friendly.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/scoring/package.json ./packages/scoring/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/

# Install the full workspace (dev deps included: we need tsx + prisma CLI).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Copy the source needed by the API and its workspace deps.
COPY apps/api ./apps/api
COPY packages ./packages

# Generate the Prisma client into the database package.
RUN pnpm --filter @crudd/database exec prisma generate

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Bring over the fully-installed workspace (incl. node_modules, generated
# Prisma client, and source). tsx is present in node_modules from the install.
COPY --from=build /app ./

# wget is part of busybox on alpine — used by the compose healthcheck.
EXPOSE 3001

# Run the migration deploy + server via the entrypoint script.
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
