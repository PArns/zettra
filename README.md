# Zettra

A self-hosted, web-based, Notion/Tana-style collaborative **second brain**: a universal
**Briefkasten** (inbox) capture layer, **supertag**-driven structure, saved **views**, and
AI-assisted **smart connections** between nodes.

> This repository implements the Zettra build specification phase by phase. This branch
> establishes the **data + service foundation** (spec §1): the monorepo, the full data model,
> the invariant-encoding pure logic, and the seams for every later phase.

## Architecture

```
apps/
  server    NestJS 11 (Fastify) API — entities, migrations, tenant/space scoping, view
            compiler, AI router, approval policy, embeddings, sync materialization
  collab    Hocuspocus + Yjs realtime server (separate deployable, Redis-coordinated)
  client    React 19 + Vite + BlockNote editor
packages/
  shared    TS types, enums, DTOs + the pure invariant logic (routing, policy, extractRefs)
  editor-ext  BlockNote inline reference primitive + suggestion-trigger detection
```

| Layer              | Choice                                                 |
| ------------------ | ------------------------------------------------------ |
| Runtime            | Node.js 22                                             |
| API                | NestJS 11 + Fastify, TypeORM                           |
| DB                 | PostgreSQL 16 + `pgvector` (HNSW)                      |
| Cache/queue/pubsub | Redis 7 — BullMQ + Hocuspocus                          |
| Realtime           | Hocuspocus + Yjs                                       |
| Frontend           | React 19 + Vite + BlockNote                            |
| Embeddings         | Ollama `bge-m3` (1024-dim)                             |
| Reasoning LLM      | AiRouter: local Ollama → remote Claude (privacy-gated) |

## Core model (spec §5–6)

- **Tenant** — isolation + sharding boundary; every table carries `tenantId`.
- **Space** — org unit / permission scope / view filter; **never** a sharding boundary.
- **Block** — the universal primitive; behaviour comes from attached **supertags**.
- **Supertag** — a tag carrying a typed field schema (with `extends` inheritance).
- **View** — a saved query over blocks; the **Briefkasten** is the view over untagged blocks.
- **Hard connections** — stored `block_relation` edges (the real graph).
- **Soft connections** — live `pgvector` cosine similarity, **never stored**.

## Getting started (Docker)

```bash
cp .env.example .env      # then edit secrets (APP_SECRET, POSTGRES_PASSWORD, ANTHROPIC_API_KEY)

# Dev (source-mounted, watch/HMR):
docker compose up --build

# Prod-style (built images, single public entrypoint on :8080):
docker compose -f docker-compose.yml up --build
```

`web` (nginx) is the only public entrypoint: it serves the SPA and reverse-proxies
`/api` → `server` and `/collab` (WebSocket) → `collab`. The API entrypoint runs idempotent
migrations — including `CREATE EXTENSION vector` and the HNSW index — before boot.

## Local development (without Docker)

```bash
pnpm install
pnpm build           # builds @zettra/shared first (workspace dep)
pnpm typecheck       # strict TS across all packages
pnpm test            # unit tests for the invariant logic
pnpm dev             # runs server + collab + client in watch mode
```

You still need Postgres (pgvector), Redis and Ollama reachable per `.env`.

## What's implemented on this branch

- **Phase 1** — monorepo, tooling, Docker topology, health check.
- **Phase 2** — all entities (§6), pgvector + HNSW migration, seed supertags on tenant
  creation, tenant-scoped services.
- **Phase 3** — minimal email+password auth, space membership + the `visibleSpaceIds`
  permission predicate (§15.2), RLS migration (defense-in-depth).
- **Invariant logic (tested)** — the view compiler, `resolveProvider` (AI routing),
  `resolveThresholds`/`decideLink` (approval), `extractRefs`, `#`/`[[`/`@` trigger detection.
- **Seams for later phases** — the editor client + reference primitive (4), the sync
  materialization + collab persistence hook (5), the view runner + Briefkasten (6), the
  similarity query + embedding worker (7), BullMQ queues for capture/curation (8–9).

See `CLAUDE.md` for the binding invariants and the phase map. `// SPEC-GAP:` comments mark
scheduled-later work (spec §11).
