/**
 * View filter/sort/group DSL (§6.1 `view`, §8.2).
 *
 * A view compiles this JSON into a TypeORM QueryBuilder against the typed `field_value`
 * columns (invariant 2), joined to `block_tag` for the tag scope with `extendsId` resolution.
 * These types are the wire contract between client and the server-side view compiler.
 */

/** Comparison operators supported by the view compiler. */
export type FilterOp =
  'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'in' | 'is_empty' | 'is_not_empty';

/** Scalar values a filter can compare against. `is_empty`/`is_not_empty` take no value. */
export type FilterValue = string | number | boolean | Array<string | number> | null;

export interface ViewFilter {
  /** Target `tag_field.id`. A special sentinel filter (below) may omit this. */
  fieldId: string;
  op: FilterOp;
  value?: FilterValue;
}

export type SortDir = 'asc' | 'desc';

export interface ViewSort {
  fieldId: string;
  dir: SortDir;
}

/**
 * Structural filter clauses that do not target a `field_value` column. The Briefkasten
 * (§8.2) uses `{ kind: 'untagged' }` — "block has no block_tag".
 */
export type StructuralFilter =
  | { kind: 'untagged' }
  | { kind: 'owned_by'; userId: string }
  | { kind: 'in_space'; spaceId: string }
  | { kind: 'needs_review' };

export interface ViewDefinition {
  tagId: string | null;
  filters: ViewFilter[];
  sorts: ViewSort[];
  groupBy: string | null;
  /** Non-field structural constraints (inbox, ownership). */
  structural?: StructuralFilter[];
}
