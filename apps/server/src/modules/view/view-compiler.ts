import { FieldType, FilterOp, StructuralFilter, ViewDefinition, ViewFilter } from '@zettra/shared';

/**
 * View compiler (§8.2). Compiles a view's filters/sorts/groupBy JSON into a database-agnostic
 * intermediate representation against the typed `field_value` columns (invariant 2). A thin
 * adapter (`applyCompiledQuery`) maps the IR onto a TypeORM QueryBuilder.
 *
 * Kept pure so it is unit-testable without a live DB (§12). Field-type metadata is supplied
 * by the caller (resolved by walking `tag.extendsId`, §8.1) so inherited fields are filterable.
 */

/** A LEFT JOIN of `field_value` for one field, aliased. */
export interface CompiledJoin {
  alias: string;
  /** Param name holding the fieldId, e.g. `f0_field`. */
  fieldParam: string;
  fieldId: string;
}

export interface CompiledOrder {
  /** SQL expression, e.g. `f0."valueDate"`. */
  expr: string;
  dir: 'ASC' | 'DESC';
}

export interface CompiledQuery {
  joins: CompiledJoin[];
  /** SQL fragments ANDed together in the WHERE clause; reference `:param` placeholders. */
  wheres: string[];
  params: Record<string, unknown>;
  orderBy: CompiledOrder[];
  /** Value expression to GROUP BY for board/calendar (null when no groupBy). */
  groupByExpr: string | null;
}

export interface CompileContext {
  tenantId: string;
  visibleSpaceIds: string[];
  /** The acting user; private blocks are visible only to their owner (§8.8, §11). */
  actingUserId?: string | null;
}

/** Map a field type to the physical `field_value` column that holds it (invariant 2). */
export function valueColumn(type: FieldType): string {
  switch (type) {
    case FieldType.Number:
      return 'valueNumber';
    case FieldType.Date:
      return 'valueDate';
    case FieldType.Checkbox:
      return 'valueBool';
    case FieldType.MultiSelect:
      return 'valueJson';
    case FieldType.Text:
    case FieldType.Select:
    case FieldType.Relation:
    case FieldType.User:
    case FieldType.Url:
    case FieldType.File:
      return 'valueText';
    default:
      // Exhaustiveness guard; new field types must declare a column.
      throw new Error(`Unmapped field type: ${type as string}`);
  }
}

const BLOCK = 'block';

export function compileView(
  def: ViewDefinition,
  fields: Map<string, FieldType>,
  ctx: CompileContext,
): CompiledQuery {
  const joins: CompiledJoin[] = [];
  const wheres: string[] = [];
  const params: Record<string, unknown> = {};
  const orderBy: CompiledOrder[] = [];

  // --- Mandatory tenant + permission scoping (§7.6, §15.2) ---
  params.tenantId = ctx.tenantId;
  wheres.push(`${BLOCK}."tenantId" = :tenantId`);
  params.visibleSpaceIds = ctx.visibleSpaceIds;
  // An empty visible-space set yields `= ANY('{}')` which matches nothing — correct: a user
  // with no memberships sees nothing (fail-closed, §15.2).
  wheres.push(`${BLOCK}."spaceId" = ANY(:visibleSpaceIds)`);

  // Block-level visibility override (§8.8, §11): private blocks only for their owner.
  params.actingUserId = ctx.actingUserId ?? null;
  wheres.push(`(${BLOCK}."visibility" = 'space' OR ${BLOCK}."ownerUserId" = :actingUserId)`);

  // --- Tag scope (§8.2) ---
  if (def.tagId) {
    params.tagId = def.tagId;
    wheres.push(
      `EXISTS (SELECT 1 FROM "block_tag" bt WHERE bt."blockId" = ${BLOCK}."id" AND bt."tagId" = :tagId)`,
    );
  }

  // --- Structural filters (Briefkasten, ownership, §8.2 / §15.3) ---
  for (const [i, s] of (def.structural ?? []).entries()) {
    compileStructural(s, i, wheres, params);
  }

  // --- One join per distinct filtered/sorted field ---
  const aliasByField = new Map<string, CompiledJoin>();
  const ensureJoin = (fieldId: string): CompiledJoin => {
    const existing = aliasByField.get(fieldId);
    if (existing) return existing;
    const idx = aliasByField.size;
    const join: CompiledJoin = { alias: `f${idx}`, fieldParam: `f${idx}_field`, fieldId };
    params[join.fieldParam] = fieldId;
    aliasByField.set(fieldId, join);
    joins.push(join);
    return join;
  };

  // --- Filters ---
  for (const [i, filter] of def.filters.entries()) {
    const type = fields.get(filter.fieldId);
    if (!type) throw new Error(`Filter references unknown field: ${filter.fieldId}`);
    const join = ensureJoin(filter.fieldId);
    const col = `${join.alias}."${valueColumn(type)}"`;
    wheres.push(compileFilter(filter, col, i, params));
  }

  // --- Sorts ---
  for (const sort of def.sorts) {
    const type = fields.get(sort.fieldId);
    if (!type) throw new Error(`Sort references unknown field: ${sort.fieldId}`);
    const join = ensureJoin(sort.fieldId);
    orderBy.push({
      expr: `${join.alias}."${valueColumn(type)}"`,
      dir: sort.dir === 'desc' ? 'DESC' : 'ASC',
    });
  }

  // --- Group by (board columns / calendar buckets) ---
  let groupByExpr: string | null = null;
  if (def.groupBy) {
    const type = fields.get(def.groupBy);
    if (!type) throw new Error(`groupBy references unknown field: ${def.groupBy}`);
    const join = ensureJoin(def.groupBy);
    groupByExpr = `${join.alias}."${valueColumn(type)}"`;
  }

  return { joins, wheres, params, orderBy, groupByExpr };
}

function compileStructural(
  s: StructuralFilter,
  i: number,
  wheres: string[],
  params: Record<string, unknown>,
): void {
  switch (s.kind) {
    case 'untagged':
      // The Briefkasten: block has no block_tag (§8.2).
      wheres.push(`NOT EXISTS (SELECT 1 FROM "block_tag" bt WHERE bt."blockId" = ${BLOCK}."id")`);
      return;
    case 'owned_by': {
      const p = `struct${i}_owner`;
      params[p] = s.userId;
      wheres.push(`${BLOCK}."ownerUserId" = :${p}`);
      return;
    }
    case 'in_space': {
      const p = `struct${i}_space`;
      params[p] = s.spaceId;
      wheres.push(`${BLOCK}."spaceId" = :${p}`);
      return;
    }
    case 'needs_review':
      // The "For Review" bucket: captures awaiting human triage (§8.3).
      wheres.push(`${BLOCK}."needsReview" = true`);
      return;
    case 'unfiled':
      // The Briefkasten: block not filed into any folder (§8.2).
      wheres.push(`${BLOCK}."folderId" IS NULL`);
      return;
    case 'in_folder': {
      const p = `struct${i}_folder`;
      params[p] = s.folderId;
      wheres.push(`${BLOCK}."folderId" = :${p}`);
      return;
    }
  }
}

function compileFilter(
  filter: ViewFilter,
  col: string,
  i: number,
  params: Record<string, unknown>,
): string {
  const p = `filter${i}`;
  const op: FilterOp = filter.op;
  switch (op) {
    case 'is_empty':
      return `${col} IS NULL`;
    case 'is_not_empty':
      return `${col} IS NOT NULL`;
    case 'contains':
      params[p] = filter.value;
      return `${col} ILIKE '%' || :${p} || '%'`;
    case 'in':
      params[p] = filter.value;
      return `${col} = ANY(:${p})`;
    case 'eq':
      params[p] = filter.value;
      return `${col} = :${p}`;
    case 'neq':
      params[p] = filter.value;
      return `${col} <> :${p}`;
    case 'lt':
      params[p] = filter.value;
      return `${col} < :${p}`;
    case 'lte':
      params[p] = filter.value;
      return `${col} <= :${p}`;
    case 'gt':
      params[p] = filter.value;
      return `${col} > :${p}`;
    case 'gte':
      params[p] = filter.value;
      return `${col} >= :${p}`;
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unsupported filter op: ${String(_exhaustive)}`);
    }
  }
}
