# Multi-stage build for the React client, served by nginx which also reverse-proxies
# /api and /collab (§13.1, §13.2).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# Vite bundles @zettra/shared + @zettra/editor-ext from source via aliases.
RUN pnpm --filter @zettra/client build

# --- runtime: static SPA + reverse proxy ---
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
