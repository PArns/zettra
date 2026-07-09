# Multi-stage build for the NestJS API against the pnpm monorepo (§13.2).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- builder: install workspace, build shared + server ---
FROM base AS builder
# Copy the whole workspace so --frozen-lockfile can resolve all workspace packages.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zettra/shared build \
 && pnpm --filter @zettra/server build
# Produce a self-contained prod bundle (dist + prod deps, workspace deps inlined).
RUN pnpm --filter @zettra/server deploy --prod /app/out

# --- runtime: slim image running the built output ---
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/out ./
# main.ts runs idempotent migrations (incl. CREATE EXTENSION vector + HNSW) before boot (§13.3).
CMD ["node", "dist/main.js"]
