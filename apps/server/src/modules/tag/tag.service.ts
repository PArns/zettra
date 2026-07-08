import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagFieldDto, CreateTagDto, FieldType } from '@zettra/shared';
import { BlockTag, FieldValue, Tag, TagField } from '../../entities/index';
import { QUEUE, QueueService } from '../jobs/queue.service';

export interface EffectiveField {
  id: string;
  tagId: string;
  name: string;
  type: FieldType;
  config: Record<string, unknown>;
  position: number;
}

/**
 * Supertags & fields (§8.1). Effective-field resolution walks the `tag.extendsId` chain so
 * inherited fields are available (and thus filterable in views). Tag apply/remove enqueue
 * field backfill/cleanup jobs — never inline in the persist path (§8.1).
 */
@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(TagField) private readonly fields: Repository<TagField>,
    @InjectRepository(BlockTag) private readonly blockTags: Repository<BlockTag>,
    @InjectRepository(FieldValue) private readonly fieldValues: Repository<FieldValue>,
    private readonly queue: QueueService,
  ) {}

  list(tenantId: string): Promise<Tag[]> {
    return this.tags.find({ where: { tenantId } });
  }

  async create(tenantId: string, dto: CreateTagDto): Promise<Tag> {
    const tag = await this.tags.save(
      this.tags.create({
        tenantId,
        name: dto.name,
        icon: dto.icon ?? null,
        color: dto.color ?? null,
        extendsId: dto.extendsId ?? null,
      }),
    );
    for (const [position, f] of (dto.fields ?? []).entries()) {
      await this.fields.save(
        this.fields.create({
          tagId: tag.id,
          name: f.name,
          type: f.type,
          config: f.config ?? {},
          position: f.position ?? position,
        }),
      );
    }
    return tag;
  }

  /**
   * Resolve the effective field schema by walking `extendsId` from the tag toward its root.
   * Nearer definitions win on name collision (a child overriding an inherited field).
   */
  async resolveEffectiveFields(tenantId: string, tagId: string): Promise<EffectiveField[]> {
    const byName = new Map<string, EffectiveField>();
    const seen = new Set<string>();
    let current: string | null = tagId;

    while (current && !seen.has(current)) {
      seen.add(current);
      const tag: Tag | null = await this.tags.findOne({ where: { id: current, tenantId } });
      if (!tag) break;
      const fields = await this.fields.find({
        where: { tagId: tag.id },
        order: { position: 'ASC' },
      });
      for (const f of fields) {
        // Do not overwrite: the first (nearest) definition of a name wins.
        if (!byName.has(f.name)) {
          byName.set(f.name, {
            id: f.id,
            tagId: f.tagId,
            name: f.name,
            type: f.type,
            config: f.config,
            position: f.position,
          });
        }
      }
      current = tag.extendsId;
    }

    return [...byName.values()].sort((a, b) => a.position - b.position);
  }

  /** Apply a supertag to a block and enqueue default-value backfill (§8.1). */
  async applyTag(
    tenantId: string,
    blockId: string,
    tagId: string,
    userId: string | null,
  ): Promise<BlockTag> {
    const existing = await this.blockTags.findOne({ where: { blockId, tagId } });
    if (existing) return existing;
    const row = await this.blockTags.save(
      this.blockTags.create({ tenantId, blockId, tagId, createdBy: userId }),
    );
    await this.queue.enqueue(
      QUEUE.BackfillFields,
      { tenantId, blockId, tagId },
      `backfill:${blockId}:${tagId}`,
    );
    return row;
  }

  /** Remove a supertag and enqueue cleanup of now-orphaned field values (§8.1). */
  async removeTag(tenantId: string, blockId: string, tagId: string): Promise<void> {
    const existing = await this.blockTags.findOne({ where: { blockId, tagId } });
    if (!existing) throw new NotFoundException('Tag not applied to block');
    await this.blockTags.delete({ id: existing.id });
    await this.queue.enqueue(
      QUEUE.CleanupFields,
      { tenantId, blockId, tagId },
      `cleanup:${blockId}:${tagId}`,
    );
  }

  // --- Schema evolution (§8.1, §11) ---

  /** Add a field to a supertag and backfill its default across every tagged block. */
  async addField(tenantId: string, tagId: string, dto: CreateTagFieldDto): Promise<TagField> {
    const tag = await this.tags.findOne({ where: { id: tagId, tenantId } });
    if (!tag) throw new NotFoundException('Tag not found');
    const count = await this.fields.count({ where: { tagId } });
    const field = await this.fields.save(
      this.fields.create({
        tagId,
        name: dto.name,
        type: dto.type,
        config: dto.config ?? {},
        position: dto.position ?? count,
      }),
    );
    await this.backfillTaggedBlocks(tenantId, tagId);
    return field;
  }

  /**
   * Rename/retype/reconfigure a field. SPEC-GAP: retyping does not migrate existing
   * `field_value` rows to the new typed column — a follow-up backfill/reconciliation job
   * owns that. Renames are safe (values key on fieldId, not name).
   */
  async updateField(
    tenantId: string,
    fieldId: string,
    patch: Partial<CreateTagFieldDto>,
  ): Promise<TagField> {
    const field = await this.fields.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    const tag = await this.tags.findOne({ where: { id: field.tagId, tenantId } });
    if (!tag) throw new NotFoundException('Field not in this tenant');
    Object.assign(field, {
      name: patch.name ?? field.name,
      type: patch.type ?? field.type,
      config: patch.config ?? field.config,
      position: patch.position ?? field.position,
    });
    return this.fields.save(field);
  }

  /** Remove a field from a supertag and delete its orphaned values across all blocks. */
  async removeField(tenantId: string, fieldId: string): Promise<void> {
    const field = await this.fields.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    const tag = await this.tags.findOne({ where: { id: field.tagId, tenantId } });
    if (!tag) throw new NotFoundException('Field not in this tenant');
    await this.fieldValues.delete({ tenantId, fieldId });
    await this.fields.delete({ id: fieldId });
  }

  /** Enqueue a backfill job for every block currently carrying the tag. */
  private async backfillTaggedBlocks(tenantId: string, tagId: string): Promise<void> {
    const rows = await this.blockTags.find({
      where: { tenantId, tagId },
      select: { blockId: true },
    });
    for (const row of rows) {
      await this.queue.enqueue(
        QUEUE.BackfillFields,
        { tenantId, blockId: row.blockId, tagId },
        `backfill:${row.blockId}:${tagId}`,
      );
    }
  }
}
