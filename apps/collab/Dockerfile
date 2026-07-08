# Multi-stage build for the Hocuspocus collab server (§13.2).
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zettra/shared build \
 && pnpm --filter @zettra/collab build
RUN pnpm --filter @zettra/collab deploy --prod /app/out

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/out ./
CMD ["node", "dist/main.js"]
