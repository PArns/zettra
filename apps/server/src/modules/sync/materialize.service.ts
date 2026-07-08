import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DocBlock, extractRefs, RelationKind } from '@zettra/shared';
import { Block, BlockRelation, BlockTag } from '../../entities/index';
import { QUEUE, QueueService } from '../jobs/queue.service';

/**
 * Materializes editor references/tags into rows (§8.7 steps 2-3). The Yjs document is the
 * source of truth (invariant 7); these rows are projections. Runs in one transaction and
 * diffs extracted sets against stored rows.
 *
 * INVARIANT 5: reference deletes are scoped to `kind='mention'`. Materialization must never
 * delete `suggested` or `relation` edges, or it destroys the curation pipeline's work.
 */
@Injectable()
export class MaterializeService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: QueueService,
  ) {}

  async materialize(tenantId: string, blockId: string, doc: DocBlock[]): Promise<void> {
    const { referenceIds, tagIds } = extractRefs(doc);

    await this.dataSource.transaction(async (manager) => {
      const block = await manager
        .getRepository(Block)
        .findOne({ where: { id: blockId, tenantId } });
      if (!block) return;

      await this.syncMentions(manager, tenantId, blockId, referenceIds);
      await this.syncTags(manager, tenantId, blockId, tagIds, block.createdBy);
    });

    // Re-embed after content settles (§8.7 step 4), debounced by blockId.
    await this.queue.enqueue(QUEUE.Embed, { tenantId, blockId }, `embed:${blockId}`);
  }

  private async syncMentions(
    manager: EntityManager,
    tenantId: string,
    blockId: string,
    referenceIds: Set<string>,
  ): Promise<void> {
    const repo = manager.getRepository(BlockRelation);
    // ONLY mention edges — never touch suggested/relation (invariant 5).
    const existing = await repo.find({
      where: { sourceId: blockId, kind: RelationKind.Mention },
    });
    const existingTargets = new Set(existing.map((e) => e.targetId));

    const toInsert = [...referenceIds].filter((id) => id !== blockId && !existingTargets.has(id));
    const toDelete = existing.filter((e) => !referenceIds.has(e.targetId));

    for (const targetId of toInsert) {
      await repo.save(
        repo.create({
          tenantId,
          sourceId: blockId,
          targetId,
          fieldId: null,
          kind: RelationKind.Mention,
        }),
      );
    }
    if (toDelete.length) {
      await repo.remove(toDelete);
    }
  }

  private async syncTags(
    manager: EntityManager,
    tenantId: string,
    blockId: string,
    tagIds: Set<string>,
    createdBy: string | null,
  ): Promise<void> {
    const repo = manager.getRepository(BlockTag);
    const existing = await repo.find({ where: { blockId } });
    const existingTagIds = new Set(existing.map((e) => e.tagId));

    const toInsert = [...tagIds].filter((id) => !existingTagIds.has(id));
    const toDelete = existing.filter((e) => !tagIds.has(e.tagId));

    for (const tagId of toInsert) {
      await repo.save(repo.create({ tenantId, blockId, tagId, createdBy }));
      // Backfill default field values for the newly applied tag (§8.1) — never inline.
      await this.queue.enqueue(
        QUEUE.BackfillFields,
        { tenantId, blockId, tagId },
        `backfill:${blockId}:${tagId}`,
      );
    }
    for (const row of toDelete) {
      await repo.delete({ id: row.id });
      await this.queue.enqueue(
        QUEUE.CleanupFields,
        { tenantId, blockId, tagId: row.tagId },
        `cleanup:${blockId}:${row.tagId}`,
      );
    }
  }
}
