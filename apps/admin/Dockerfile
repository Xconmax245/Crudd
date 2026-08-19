# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# CRUDD admin dashboard image.
#
# Same pattern as apps/web: Vite bakes VITE_* config at build time, then the
# static bundle is served by nginx with an SPA history fallback. Admin auth is
# handled client-side via Supabase, so the anon key/URL are build args.
# ---------------------------------------------------------------------------

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable

# Build-time public config (baked into the bundle).
ARG VITE_API_URL=http://localhost:3001
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Workspace manifests first for a cache-friendly install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
COPY packages/validation/package.json ./packages/validation/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Source for the admin app + its workspace deps.
COPY apps/admin ./apps/admin
COPY packages/shared ./packages/shared
COPY packages/validation ./packages/validation

RUN pnpm --filter @crudd/admin build

# ---- Stage 2: serve ----
FROM nginx:alpine AS runner
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
