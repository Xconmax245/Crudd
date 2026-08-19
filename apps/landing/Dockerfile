# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRUDD landing (Phase 0 marketing) image.
#
# Same pattern as apps/web and apps/admin: Vite bakes VITE_* config at build
# time, then nginx serves the static bundle. The landing page has no workspace
# dependencies and no backend calls — its only config is VITE_APP_URL, the
# player-app origin its "Start a Challenge" / "Join a Match" CTAs point at.
# ---------------------------------------------------------------------------

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# Build-time public config (baked into the bundle).
ARG VITE_APP_URL=http://localhost:3000
ENV VITE_APP_URL=$VITE_APP_URL

# Workspace manifests first for a cache-friendly install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/landing/package.json ./apps/landing/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Source for the landing app (no workspace deps).
COPY apps/landing ./apps/landing

RUN pnpm --filter @crudd/landing build

# ---- Stage 2: serve ----
FROM nginx:alpine AS runner
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/landing/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
