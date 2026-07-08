import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AliasEntry {
  blockId: string;
  alias: string;
}

/**
 * The alias index (§8.4 layer 1): known entity names → block ids. Built from tagged blocks'
 * identifying field values (name/title/subject) plus tag names. Used by the deterministic
 * mention linker and by autocomplete.
 *
 * MUST be permission-scoped when serving autocomplete to a user (§15.2) — callers pass the
 * visible space ids. The ingest-time linker scopes to the block's tenant + space.
 */
@Injectable()
export class AliasIndexService {
  constructor(private readonly dataSource: DataSource) {}

  private readonly identifyingFields = ['name', 'title', 'subject'];

  /** Build the alias list for a tenant, optionally restricted to given space ids. */
  async build(tenantId: string, spaceIds?: string[]): Promise<AliasEntry[]> {
    const params: unknown[] = [tenantId, this.identifyingFields];
    let spaceClause = '';
    if (spaceIds) {
      if (spaceIds.length === 0) return [];
      params.push(spaceIds);
      spaceClause = `AND b."spaceId" = ANY($3)`;
    }

    const rows: AliasEntry[] = await this.dataSource.query(
      `
      SELECT DISTINCT fv."blockId" AS "blockId", fv."valueText" AS alias
      FROM field_value fv
      JOIN tag_field tf ON tf.id = fv."fieldId" AND lower(tf.name) = ANY($2)
      JOIN block b ON b.id = fv."blockId"
      WHERE fv."tenantId" = $1 AND fv."valueText" IS NOT NULL AND length(fv."valueText") >= 2
        ${spaceClause}
      `,
      params,
    );
    return rows;
  }

  /** Autocomplete: fuzzy-match visible entities by name for the `[[`/`#`/`@` menus (§8.6). */
  async search(tenantId: string, spaceIds: string[], query: string, limit = 10): Promise<AliasEntry[]> {
    const all = await this.build(tenantId, spaceIds);
    const q = query.toLowerCase();
    return all
      .filter((e) => e.alias.toLowerCase().includes(q))
      .slice(0, limit);
  }
}
