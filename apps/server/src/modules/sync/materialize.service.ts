import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { DocBlock, extractRefs, RelationKind } from '@zettra/shared';
import { Block, BlockRelation, BlockTag } from '../../entities/index';
import { QUEUE, QueueService } from '../jobs/queue.service';
import { NotificationService } from '../notification/notification.service';

interface TagJobs {
  backfill: string[];
  cleanup: string[];
}

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
    private readonly notifications: NotificationService,
  ) {}

  async materialize(tenantId: string, blockId: string, doc: DocBlock[]): Promise<void> {
    const { referenceIds, tagIds } = extractRefs(doc);

    let newMentions: string[] = [];
    let tagJobs: TagJobs = { backfill: [], cleanup: [] };
    await this.dataSource.transaction(async (manager) => {
      const block = await manager
        .getRepository(Block)
        .findOne({ where: { id: blockId, tenantId } });
      if (!block) return;

      // Persist the settled prose as the block's content projection (invariant 1: text-as-json).
      // Without this the rich text lived only in the ephemeral Yjs doc and was lost on reload;
      // onLoadDocument rebuilds the Yjs doc from this on reopen.
      block.content = doc;
      await manager.getRepository(Block).save(block);

      newMentions = await this.syncMentions(manager, tenantId, blockId, referenceIds);
      tagJobs = await this.syncTags(manager, tenantId, blockId, tagIds, block.createdBy);
    });

    // Enqueue jobs only AFTER the transaction commits — Redis enqueues are not transactional,
    // so a rolled-back tx must not leave orphan backfill/cleanup jobs (they would write field
    // values onto a block whose tag insert was rolled back).
    for (const tagId of tagJobs.backfill) {
      await this.queue.enqueue(
        QUEUE.BackfillFields,
        { tenantId, blockId, tagId },
        `backfill:${blockId}:${tagId}`,
      );
    }
    for (const tagId of tagJobs.cleanup) {
      await this.queue.enqueue(
        QUEUE.CleanupFields,
        { tenantId, blockId, tagId },
        `cleanup:${blockId}:${tagId}`,
      );
    }

    // Notify the owner of each newly-mentioned block (§15.6).
    await this.notifyMentions(tenantId, blockId, newMentions);

    // Re-embed after content settles (§8.7 step 4), debounced by blockId.
    await this.queue.enqueue(QUEUE.Embed, { tenantId, blockId }, `embed:${blockId}`);
  }

  /** The block's stored prose (DocBlock[]) for rebuilding its Yjs doc on load; [] if none. */
  async getDoc(tenantId: string, blockId: string): Promise<DocBlock[]> {
    const block = await this.dataSource
      .getRepository(Block)
      .findOne({ where: { id: blockId, tenantId } });
    return Array.isArray(block?.content) ? (block.content as DocBlock[]) : [];
  }

  /** Returns the target ids of newly-created mention edges. */
  private async syncMentions(
    manager: EntityManager,
    tenantId: string,
    blockId: string,
    referenceIds: Set<string>,
  ): Promise<string[]> {
    const repo = manager.getRepository(BlockRelation);
    // ONLY mention edges — never touch suggested/relation (invariant 5).
    const existing = await repo.find({
      where: { sourceId: blockId, kind: RelationKind.Mention },
    });
    const existingTargets = new Set(existing.map((e) => e.targetId));

    // Only link targets that actually exist within this tenant — never trust raw ids from
    // user-controlled doc content (§7.6): a fabricated reference must not create an edge or
    // notify a foreign owner.
    const referenced = [...referenceIds].filter((id) => id !== blockId);
    const validTargets =
      referenced.length === 0
        ? []
        : (
            await manager.getRepository(Block).find({
              where: { tenantId, id: In(referenced) },
              select: { id: true },
            })
          ).map((b) => b.id);
    const validSet = new Set(validTargets);

    const toInsert = validTargets.filter((id) => !existingTargets.has(id));
    // Deletes still cover any mention edge no longer referenced (incl. now-invalid targets).
    const toDelete = existing.filter((e) => !validSet.has(e.targetId));

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
    return toInsert;
  }

  private async notifyMentions(
    tenantId: string,
    sourceId: string,
    targetIds: string[],
  ): Promise<void> {
    if (targetIds.length === 0) return;
    const repo = this.dataSource.getRepository(Block);
    // Tenant-scoped lookups (§7.6) — never resolve blocks across tenants.
    const source = await repo.findOne({ where: { id: sourceId, tenantId } });
    for (const targetId of targetIds) {
      const target = await repo.findOne({ where: { id: targetId, tenantId } });
      const owner = target?.ownerUserId;
      if (owner && owner !== source?.ownerUserId) {
        // Actor = the author of the mentioning block (its owner / most recent editor).
        await this.notifications.emit(
          tenantId,
          owner,
          'mention',
          sourceId,
          source?.updatedBy ?? source?.ownerUserId ?? null,
        );
      }
    }
  }

  /** Diffs tags in one transaction; returns the backfill/cleanup jobs to enqueue post-commit. */
  private async syncTags(
    manager: EntityManager,
    tenantId: string,
    blockId: string,
    tagIds: Set<string>,
    createdBy: string | null,
  ): Promise<TagJobs> {
    const repo = manager.getRepository(BlockTag);
    const existing = await repo.find({ where: { blockId } });
    const existingTagIds = new Set(existing.map((e) => e.tagId));

    const toInsert = [...tagIds].filter((id) => !existingTagIds.has(id));
    const toDelete = existing.filter((e) => !tagIds.has(e.tagId));

    for (const tagId of toInsert) {
      await repo.save(repo.create({ tenantId, blockId, tagId, createdBy }));
    }
    for (const row of toDelete) {
      await repo.delete({ id: row.id });
    }
    return { backfill: toInsert, cleanup: toDelete.map((r) => r.tagId) };
  }
}
