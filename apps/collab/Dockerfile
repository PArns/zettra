# Multi-stage build for the Hocuspocus collab server (§13.2).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zettra/shared build \
 && pnpm --filter @zettra/collab build
# --legacy: pnpm v10 refuses to deploy non-injected workspaces without it.
RUN pnpm --filter @zettra/collab deploy --prod --legacy /app/out

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/out ./
CMD ["node", "dist/main.js"]
