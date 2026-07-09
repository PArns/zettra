# Zettra

A self-hosted, web-based, collaborative **second brain**: a universal **Briefkasten** (inbox)
capture layer, **supertag**-driven structure, saved **views**, and AI-assisted **smart
connections** between nodes.

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

Every long-running service has `restart: unless-stopped`, and all state lives in named volumes
(`pgdata`, `redisdata`, `ollama`, `uploads`) so **data persists across redeploys**. Ports are
env-configurable: the API via `PORT`, collab via `COLLAB_PORT`, and the public entrypoint via
`WEB_PORT` (default 8080).

### Deploying to Coolify

The compose file is Coolify-ready. Create a **Docker Compose** resource pointing at
`docker-compose.yml`, set the env vars from `.env.example` in Coolify's UI, and attach your
domain to the **`web`** service (container port 80) — Coolify's Traefik proxy handles TLS and
routing, so you don't need to publish `WEB_PORT`. The named volumes are managed by Coolify and
survive redeploys. To add the local LLM on a GPU host, include `docker-compose.gpu.yml` as a
second compose file.

### Local GPU (NVIDIA / RTX 5080)

Give Ollama the GPU for local embeddings + reasoning:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Needs the NVIDIA driver + Container Toolkit on the host. The RTX 5080 is Blackwell (sm_120), so
use a recent `ollama/ollama` image (CUDA 12.x). `ollama-pull` fetches `EMBEDDING_MODEL` and
`LLM_MODEL` on first boot; verify with `docker compose exec ollama nvidia-smi`.

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
- **Phase 3** — email+password auth, space membership + the `visibleSpaceIds` permission
  predicate (§15.2), RLS migration (defense-in-depth).
- **Phase 4** — BlockNote editor with the custom `reference`/`tag` inline primitive
  (invariant 4), `#`/`@`/`[` suggestion menus with fuzzy search + create-if-not-exists,
  and image/file upload (drag-drop + paste).
- **Phase 5** — Hocuspocus collab server + debounced persistence hook; server-side
  `materializeRefs` (mention-scoped deletes, invariant 5) and field-value materialization.
- **Phase 6** — view compiler (typed columns, extendsId resolution) + view CRUD + the
  table/board/list renderer and the Briefkasten.
- **Phase 7** — Ollama `bge-m3` embed worker + live similarity query + the "Related" rail.
- **Phase 8** — capture pipeline: a generic `/capture` endpoint (text / web-clip /
  IMAP-ready with idempotent `sourceRef`) + upload capture, the `process-capture` worker,
  AiRouter tag/field proposal.
- **Phase 9** — mention linker (layer 1), curation worker (layer 3), approval-policy
  resolution, the review queue with confirm/dismiss.
- **Phase 10** — dismiss-rate-per-confidence-bucket calibration metric; calendar + gallery
  layouts; notifications (@-mention, task assignment, review request) with a topbar bell.
- **Real Yjs↔rows sync** — the collab hook projects settled docs via `ServerBlockNoteEditor`
  with the shared custom schema, so materialize/embed/curation run on correct content.
- **Workers** — in-process BullMQ workers (embed, backfill/cleanup fields, capture,
  curation), gated by `RUN_WORKERS`.
- **Invariant & pure logic (unit-tested)** — view compiler, `resolveProvider` (AI routing),
  `resolveThresholds`/`decideLink` (approval), `extractRefs`, mention linker, trigger
  detection, plus the calendar month grid, agenda grouping/`reconcile`, date extraction, and the
  OCR extraction/cleanup helpers.

- **Capture sources** — a generic `/capture` endpoint plus an env-gated **IMAP poller**
  (idempotent per message-id) and image/file upload capture.
- **Hybrid search** — dense pgvector kNN + Postgres full-text (tsvector/GIN) fused via
  Reciprocal Rank Fusion; topbar search box.
- **Block-level permissions** — a `visibility` override (space/private) enforced at the
  query layer across every read path.
- **Signed uploads** — HMAC-signed, tamper-proof served file URLs.
- **Structured field editing** — an editable field panel that writes `field_value` and
  reflects in table/board/calendar views.
- **Dropbox capture** — a drag-and-drop zone in the Briefkasten: dropped audio/images/files
  land as `source: upload` blocks and text/URLs as captures, both running the auto-tag pipeline.
- **"For Review" bucket** — captures the AI can't confidently tag are flagged (`block.needsReview`)
  and surfaced in a triage pane; applying a supertag or marking reviewed resolves them.
- **Tag folder hierarchy** — `tag.parentId` gives an organizational folder tree (distinct from
  `extendsId` inheritance), rendered as a collapsible, drag-to-reparent sidebar tree with
  server-side cycle rejection.
- **Calendar & reminders** — a permission-scoped agenda endpoint unions pending reminders and
  date-typed field values into a month **Calendar** surface with per-day markers and conflict
  highlighting; reminders / Wiedervorlage (table + due-scan job + notification) with a DatePicker.
- **Today briefing** — a single-column agenda gathered from all sources: overdue/today/upcoming
  reminders, entities whose date field lands today (via the calendar agenda), and fresh captures.
- **Mail deadline detection** — deterministic natural-language date extraction (EN/DE: "in 2
  weeks", "am 24.07.", tomorrow/morgen…) turns captured text into reminders, reconciled against
  existing reminders so clashing days are flagged (⚠).
- **AI chat & Ask-AI search** — grounded chat over the index (RAG: query-vector kNN retrieval,
  privacy-gated + permission-scoped) with source chips; the topbar search offers "Ask AI" to hand
  the query straight to the chat.
- **OCR pass** — a flag-gated (`OCR_ENABLED`) embed-worker step recognizes text in uploaded raster
  images (lazy, optional `tesseract.js`) and folds it into `searchText` so scans become findable.

### Design system & UI

- **TailwindCSS v4 + custom theme** — semantic design tokens (`--bg`, `--surface`, `--accent`,
  …) defined once in `apps/client/src/index.css` and exposed to utilities via `@theme inline`.
  Legacy component CSS lives in the `components` cascade layer so the Tailwind kit always wins.
- **Light / dark / system switcher** — `src/lib/theme.ts` persists the mode and stamps
  `data-theme` on `<html>`; "system" tracks the OS live via `matchMedia`. The BlockNote editor
  re-themes reactively. Try `?theme=dark` on any route.
- **Reusable component kit** (`src/ui/`) — `Button`, `Card`, `Badge`, `Input`/`Field`,
  `Spinner`, `EmptyState`, `Avatar`, `Segmented`, `ThemeSwitcher`, `IconButton` — all
  token-driven and theme-aware.
- **Custom editor blocks** — callout/admonition, blockquote, divider, and web-bookmark are
  real BlockNote block types (inserted from the `/` slash menu), registered in **both** the
  client React schema and the collab server DOM schema (`@zettra/shared` holds the shared prop
  schemas) so they survive the Yjs round-trip. BlockNote 0.25 ships none of these.
- **Content blocks** (`src/blocks/`) — richer widgets rendered as reusable components: a
  weather widget, a **kanban board** (drag-and-drop), a **table with live formulas** (a
  hand-written, unit-tested spreadsheet engine — no `eval`), a **cover-image header**, and an
  interactive checklist.
- **Component gallery** — open `/?demo=1` for a standalone showcase of every block and kit
  primitive with sample data (no backend required).

### Scaling to Citus (ops step, §9)

The v1 model is single-Postgres with row-level tenancy + RLS. It migrates to Citus **without
a data-model change** because every table already carries `tenantId`: distribute each table
on `tenant_id` (`SELECT create_distributed_table('block', 'tenantId')`, …) so a tenant's
joins and similarity stay co-located on one node. Never distribute by `spaceId` (invariant 6).
Schema-/DB-per-tenant is only for hard physical-isolation compliance needs.

### Still scheduled (marked `// SPEC-GAP:`)

Inline field nodes **inside the prose editor** (editing fields in the rail + views already
works; embedding an editable field token mid-paragraph is the remaining slice of §11's
bidirectional sync); retyping a field's type migrating existing `field_value` rows; sparse
BGE-M3 vectors in hybrid search (the storage seam is reserved); toggle/collapsible blocks,
LaTeX math (KaTeX) and Mermaid diagrams as editor blocks; promoting the kanban/formula-table
widgets from reusable components to first-class BlockNote block types (callout, quote, divider
and bookmark already are).

See `CLAUDE.md` for the binding invariants. `// SPEC-GAP:` comments mark scheduled work.
