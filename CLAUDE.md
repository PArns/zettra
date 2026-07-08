# Zettra — contributor orientation

This file orients an agent or contributor working in this repo. The authoritative build
specification (goals, phases, full data model, subsystem detail) is the design document this
project is built from; this file distills the parts you must not violate.

## Binding invariants (spec §7 — do NOT "simplify" away)

1. **Entity-as-row, text-as-json.** Referenceable/queryable things are their own `block` row;
   rich text stays as BlockNote JSON in `block.content`.
2. **Typed field-value columns, not a JSONB blob.** View filters/sorts hit indexed
   `field_value.value*` columns. `valueJson` only for multi-value/complex cases.
3. **Hard vs soft connections are separate.** Soft (semantic) similarity is computed live and
   **never** inserted into `block_relation`.
4. **A reference stores `blockId`; the label is display-only.** Re-resolve labels on render.
   `#tags` and `[[references]]` are the same inline primitive.
5. **Reference-sync deletes are scoped to `kind='mention'`.** Never delete `suggested`/
   `relation` edges during materialization (`MaterializeService`).
6. **Sharding/tenancy key is `tenantId`, never `spaceId`.** `spaceId` is a filter, not a
   boundary. Every table carries `tenantId`.
7. **The Yjs document is the source of truth.** Rows/fields/refs/embeddings are projections
   materialized by the persistence hook.
8. **Approval thresholds compare curation confidence, not cosine distance.**
9. **In a shared space, the space's policy wins for everyone** (approval + `aiPolicy`).
10. **Auto-detection suggests, never force-replaces** text under the cursor.
11. **Every read path is permission-scoped, not just tenant-scoped.** Use
    `PermissionsService.visibleSpaceIds` at the query layer (`§15.2`). Each miss is a leak.

## Where the invariants live in code

| Invariant                                         | Enforced in                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| Typed columns / view compiler                     | `apps/server/src/modules/view/view-compiler.ts`                     |
| Soft ≠ hard, permission-scoped similarity         | `apps/server/src/modules/embedding/similarity.service.ts`           |
| Reference materialization, mention-scoped deletes | `apps/server/src/modules/sync/materialize.service.ts`               |
| Approval thresholds / decision                    | `packages/shared/src/policy.ts`, `.../approval/approval.service.ts` |
| AI routing (privacy gate first)                   | `packages/shared/src/routing.ts`, `.../ai/ai-router.service.ts`     |
| Permission-scoped reads                           | `apps/server/src/modules/membership/permissions.service.ts`         |
| extractRefs                                       | `packages/shared/src/refs.ts`                                       |

## Conventions (spec §12)

- TypeScript strict everywhere; English code + comments; no secrets in code.
- Every service method touching tenant data takes/enforces `tenantId`.
- One `value*` column populated per `field_value` row.
- Jobs are idempotent and debounced.
- Unit-test the pure logic thoroughly — it encodes the invariants.
- Mark scheduled-later work with `// SPEC-GAP:` at the code site.

## Build plan status

Phases 1–3 built; the invariant logic for phases 4–9 is implemented and unit-tested; the
runtime wiring for phases 4–10 is scaffolded behind clear seams. See `README.md`.
