# Concepts — AI, calendar & mail on the Zettra stack

How the next wave of features maps onto what already exists (pgvector + `block_embedding`,
the privacy-gated `AiRouter`, local Ollama with Claude escalation, BullMQ jobs, BlockNote custom
blocks, the typed `field_value` columns). Each concept below has three parts: **Visual/UX**, **AI**,
**Data & jobs** — plus what's already in place vs. new.

---

## 1. AI chat over the index (RAG)

**Visual/UX.** A right-side chat panel (toggle in the topbar, ⌘K-style). Messages stream in;
every answer shows **source chips** ("from: Weekly sync · Project Atlas") that open the block.
Scope selector: whole workspace / current space / current supertag. A "＋ add to note" action turns
an answer into a block.

**AI.** Retrieve → rerank → answer, all through `AiRouter` (privacy gate first, §14): embed the
question with bge-m3, `SimilarityService` top-k over `block_embedding` (permission-scoped,
invariant 11), optionally rerank, then compose the answer with the local LLM — escalating to
Claude only when the space `aiPolicy` allows. Answers must cite block ids (reuse invariant 4:
store id, render label).

**Data & jobs.** No new index — reuse `block_embedding`. Add a small `chat_thread` / `chat_message`
pair (tenant + space scoped) for history. Streaming via SSE from a new `/ai/chat` endpoint.
_Already in place:_ embeddings, similarity, AiRouter, privacy gate. _New:_ chat endpoint + panel +
thread tables.

## 2. AI semantic search

**Visual/UX.** The existing search box gains a top "Ask AI" row and richer result snippets with the
matched sentence highlighted. Enter = results; ⇧Enter = ask-AI answer.

**AI.** Hybrid dense+FTS with RRF **already exists** (§11). Add a semantic-answer path (same RAG as
§1, single-shot) and optional query expansion via the local LLM.
_New:_ the "answer" affordance on top of the current results.

## 3. Calendar & date component (tag a date)

**Visual/UX.** A reusable **DatePicker** (month grid, keyboard nav, today/clear) used by `date`
fields and by an inline **`/date`** editor block so any note can carry a tagged date. A dedicated
**Calendar surface** (month/week/agenda) — the `calendar` view layout already renders date-bucketed
rows; promote it to a first-class nav item that unions all date fields across supertags.

**Data & jobs.** The `date` field type + typed `valueDate` column **already exist** (indexed, so a
calendar query is cheap). _New:_ the DatePicker component, the `/date` block, and a calendar nav
surface querying `field_value.valueDate` across the tenant (permission-scoped).

## 4. Reminders / Wiedervorlage on nodes

**Visual/UX.** A reminder affordance on any block (🔔 "remind me / follow up") with quick presets
(tomorrow, in 3 days, in 2 weeks, custom) and a snooze. Due items surface in **Notifications** and
in the **Today** view (§6). A subtle chip on the node shows the next reminder.

**Data & jobs.** New `reminder` table (`tenantId`, `blockId`, `userId`, `remindAt`, `note`,
`status`). A BullMQ **repeatable job** scans `remindAt <= now` and emits a `review_request`-style
notification (the notification plumbing already exists). Idempotent + debounced per the job rules.

## 5. Mail integration → auto due-dates & appointment reconciliation

**Visual/UX.** The IMAP poller already captures mail into blocks (§8.3). Add an **extraction pass**:
captured mail that mentions dates surfaces a suggestion card in **For Review** — _"Detected:
appointment in ~2 weeks (Thu 24 Jul). Add reminder · Add to calendar · Check for conflicts"_.
Important mail (sender/keywords) is flagged and its deadlines auto-detected.

**AI.** On capture of a `source: email` block, run an `AiRouter` **structured-extraction** prompt
(JSON schema: `{ appointments[], deadlines[], importance }`) — local LLM first, Claude escalation
per policy. Resolve relative dates ("in 2 weeks") against the capture date. Then **reconcile**
against the calendar (§3): query existing `valueDate` entries around the target day, report
conflicts / propose free slots. Confident extractions auto-create a reminder (§4); the rest go to
For Review (invariant 10: suggest, never force).

**Data & jobs.** Extends the existing `process-capture` worker with an extraction step; writes
reminders (§4) and/or a `date` field on the block. _Already in place:_ IMAP poller, capture
pipeline, AiRouter JSON mode, For Review bucket. _New:_ the extraction step + reconciliation query

- suggestion card.

## 6. "Today" view — aggregated from all sources (incl. OCR)

**Visual/UX.** A **Today** agenda unifying: due reminders (§4), items whose `date` field is today
(§3), fresh captures (Briefkasten), and flagged mail (§5) — grouped by "Overdue / Today / Upcoming",
each row opening its block. A calm, single-column daily briefing.

**AI & OCR.** Uploaded images run an **OCR pass** (a job step: local `tesseract.js`, or an Ollama
vision model when GPU is available) → extracted text is folded into the block's `searchText` so it
feeds hybrid search. _Built:_ `OcrService` (flag `OCR_ENABLED`, langs `OCR_LANGUAGES`) wired into
the embed worker; `tesseract.js` is an optional dependency the service loads lazily and degrades
gracefully without. Pure extraction/cleanup (`shouldOcr`, `extractImageUrls`, `cleanOcrText`,
`mergeSearchText`) is unit-tested in `@zettra/shared`. SPEC-GAP: feed OCR text into the mail-style
date extraction (§5) so a photographed letter with a due date reminds automatically.

**Data & jobs.** No new store — a union query across `reminder`, `field_value.valueDate`, recent
blocks, all permission-scoped. _Built:_ the Today nav surface (folds in date-field items via the
calendar agenda) + the OCR step in the embed worker.

---

## Suggested build order

1. **DatePicker + calendar surface** (§3) — _done_: DatePicker, calendar agenda endpoint + month
   view, conflict highlighting.
2. **Reminders** (§4) — _done_: table + due-scan job + notification.
3. **Today view** (§6) — _done_: union agenda UI, now folding in today's date-field items.
4. **AI chat + semantic answer** (§1/§2) — _done_ (retrieval + chat + "Ask AI" from search); needs
   Ollama running to verify answers end-to-end.
5. **Mail extraction + reconciliation** (§5) — _done_: deterministic date extraction →
   reminders, reconciled against existing reminders (⚠ on clashes). **OCR** (§6) — _done_: flag-gated
   embed-worker step. Remaining AI-heavy work: full mail parsing via structured `AiRouter` JSON and
   feeding OCR text into date extraction.

Cross-cutting: everything stays behind the `AiRouter` privacy gate (invariant 9/§14), every read
stays permission-scoped (invariant 11), and AI output only ever _suggests_ (invariant 10).
