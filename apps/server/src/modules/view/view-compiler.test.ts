import { describe, expect, it } from 'vitest';
import { FieldType, ViewDefinition } from '@zettra/shared';
import { compileView, valueColumn } from './view-compiler';

const ctx = { tenantId: 't1', visibleSpaceIds: ['s1', 's2'] };

describe('valueColumn', () => {
  it('maps types to the typed columns (invariant 2)', () => {
    expect(valueColumn(FieldType.Number)).toBe('valueNumber');
    expect(valueColumn(FieldType.Date)).toBe('valueDate');
    expect(valueColumn(FieldType.Checkbox)).toBe('valueBool');
    expect(valueColumn(FieldType.MultiSelect)).toBe('valueJson');
    expect(valueColumn(FieldType.Select)).toBe('valueText');
    expect(valueColumn(FieldType.Relation)).toBe('valueText');
  });
});

describe('compileView', () => {
  it('always scopes by tenant and visible spaces (fail-closed, §15.2)', () => {
    const def: ViewDefinition = { tagId: null, filters: [], sorts: [], groupBy: null };
    const c = compileView(def, new Map(), ctx);
    expect(c.wheres).toContain('block."tenantId" = :tenantId');
    expect(c.wheres).toContain('block."spaceId" = ANY(:visibleSpaceIds)');
    expect(c.params.tenantId).toBe('t1');
    expect(c.params.visibleSpaceIds).toEqual(['s1', 's2']);
  });

  it('enforces block-level visibility (private → owner only, §8.8)', () => {
    const def: ViewDefinition = { tagId: null, filters: [], sorts: [], groupBy: null };
    const c = compileView(def, new Map(), { ...ctx, actingUserId: 'u1' });
    expect(c.wheres).toContain(
      '(block."visibility" = \'space\' OR block."ownerUserId" = :actingUserId)',
    );
    expect(c.params.actingUserId).toBe('u1');
  });

  it('adds a tag-scope EXISTS clause when tagId is set', () => {
    const def: ViewDefinition = { tagId: 'tag-task', filters: [], sorts: [], groupBy: null };
    const c = compileView(def, new Map(), ctx);
    expect(c.params.tagId).toBe('tag-task');
    expect(c.wheres.some((w) => w.includes('block_tag') && w.includes(':tagId'))).toBe(true);
  });

  it('compiles the Briefkasten untagged structural filter', () => {
    const def: ViewDefinition = {
      tagId: null,
      filters: [],
      sorts: [],
      groupBy: null,
      structural: [{ kind: 'untagged' }, { kind: 'owned_by', userId: 'u1' }],
    };
    const c = compileView(def, new Map(), ctx);
    expect(c.wheres.some((w) => w.startsWith('NOT EXISTS'))).toBe(true);
    expect(c.wheres).toContain('block."ownerUserId" = :struct1_owner');
    expect(c.params.struct1_owner).toBe('u1');
  });

  it('joins field_value once per field and compiles operators to the right column', () => {
    const fields = new Map<string, FieldType>([
      ['fld-status', FieldType.Select],
      ['fld-due', FieldType.Date],
    ]);
    const def: ViewDefinition = {
      tagId: 'tag-task',
      filters: [
        { fieldId: 'fld-status', op: 'eq', value: 'open' },
        { fieldId: 'fld-due', op: 'lte', value: '2026-08-01' },
        { fieldId: 'fld-status', op: 'neq', value: 'done' },
      ],
      sorts: [{ fieldId: 'fld-due', dir: 'asc' }],
      groupBy: 'fld-status',
    };
    const c = compileView(def, fields, ctx);

    // fld-status and fld-due share one join each (3 filters, but 2 distinct fields).
    expect(c.joins).toHaveLength(2);
    const statusJoin = c.joins.find((j) => j.fieldId === 'fld-status')!;
    const dueJoin = c.joins.find((j) => j.fieldId === 'fld-due')!;

    expect(c.wheres).toContain(`${statusJoin.alias}."valueText" = :filter0`);
    expect(c.wheres).toContain(`${dueJoin.alias}."valueDate" <= :filter1`);
    expect(c.wheres).toContain(`${statusJoin.alias}."valueText" <> :filter2`);
    expect(c.params.filter0).toBe('open');
    expect(c.params.filter1).toBe('2026-08-01');

    expect(c.orderBy).toEqual([{ expr: `${dueJoin.alias}."valueDate"`, dir: 'ASC' }]);
    expect(c.groupByExpr).toBe(`${statusJoin.alias}."valueText"`);
  });

  it('compiles empty / contains / in operators', () => {
    const fields = new Map<string, FieldType>([['fld-title', FieldType.Text]]);
    const def: ViewDefinition = {
      tagId: null,
      filters: [
        { fieldId: 'fld-title', op: 'contains', value: 'zettel' },
        { fieldId: 'fld-title', op: 'is_not_empty' },
      ],
      sorts: [],
      groupBy: null,
    };
    const c = compileView(def, fields, ctx);
    const a = c.joins[0]!.alias;
    expect(c.wheres).toContain(`${a}."valueText" ILIKE '%' || :filter0 || '%'`);
    expect(c.wheres).toContain(`${a}."valueText" IS NOT NULL`);
  });

  it('throws when a filter references an unknown field', () => {
    const def: ViewDefinition = {
      tagId: null,
      filters: [{ fieldId: 'ghost', op: 'eq', value: 1 }],
      sorts: [],
      groupBy: null,
    };
    expect(() => compileView(def, new Map(), ctx)).toThrow(/unknown field/);
  });
});
