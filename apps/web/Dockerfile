# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRUDD web (player) image.
#
# Vite inlines VITE_* env vars at BUILD time, so the API/socket URLs must be
# provided as build args (not runtime env). Stage 1 compiles the SPA; stage 2
# serves the static bundle with nginx, with an SPA history fallback so deep
# links like /challenge/:slug/play resolve to index.html.
# ---------------------------------------------------------------------------

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# Build-time public config (baked into the bundle).
ARG VITE_API_URL=http://localhost:3001
ARG VITE_SOCKET_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Workspace manifests first for a cache-friendly install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Source for the web app + its workspace deps.
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY packages/validation ./packages/validation

RUN pnpm --filter @crudd/web build

# ---- Stage 2: serve ----
FROM nginx:alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
