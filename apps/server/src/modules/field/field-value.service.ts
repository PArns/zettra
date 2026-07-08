import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldType } from '@zettra/shared';
import { FieldValue, TagField } from '../../entities/index';
import { NotificationService } from '../notification/notification.service';

/**
 * Field-value read/write (§8.7 step 5, invariant 2). Exactly one `value*` column is populated
 * per row, selected by the field's type — enforced here in the write path (§12). Concurrent
 * structured edits use last-write-wins keyed on updatedAt + updatedBy (§15.4).
 */
@Injectable()
export class FieldValueService {
  constructor(
    @InjectRepository(FieldValue) private readonly values: Repository<FieldValue>,
    @InjectRepository(TagField) private readonly fields: Repository<TagField>,
    private readonly notifications: NotificationService,
  ) {}

  listForBlock(tenantId: string, blockId: string): Promise<FieldValue[]> {
    return this.values.find({ where: { tenantId, blockId } });
  }

  /** Upsert a single field value, routing to the correct typed column. */
  async set(
    tenantId: string,
    blockId: string,
    fieldId: string,
    raw: unknown,
    userId: string | null,
  ): Promise<FieldValue> {
    const field = await this.fields.findOne({ where: { id: fieldId } });
    if (!field) throw new Error(`Unknown field ${fieldId}`);

    const existing = await this.values.findOne({ where: { blockId, fieldId } });
    const row = existing ?? this.values.create({ tenantId, blockId, fieldId });
    this.clear(row);
    this.assign(row, field.type, raw);
    row.updatedBy = userId;
    const saved = await this.values.save(row);

    // Assigning a `user` field (e.g. #task assignee) notifies the assignee (§15.6).
    if (field.type === FieldType.User && typeof raw === 'string' && raw && raw !== userId) {
      await this.notifications.emit(tenantId, raw, 'task_assignment', blockId);
    }
    return saved;
  }

  /** Backfill default values for a tag's fields on a block (§8.1). Idempotent. */
  async backfillDefaults(
    tenantId: string,
    blockId: string,
    fields: Array<{ id: string; type: FieldType; config: Record<string, unknown> }>,
  ): Promise<void> {
    for (const field of fields) {
      const existing = await this.values.findOne({ where: { blockId, fieldId: field.id } });
      if (existing) continue;
      const row = this.values.create({ tenantId, blockId, fieldId: field.id });
      this.clear(row);
      this.assign(row, field.type, defaultFor(field.type, field.config));
      await this.values.save(row);
    }
  }

  /** Remove field values orphaned by a tag removal (§8.1). */
  async cleanupOrphaned(blockId: string, fieldIds: string[]): Promise<void> {
    if (fieldIds.length === 0) return;
    await this.values
      .createQueryBuilder()
      .delete()
      .where('"blockId" = :blockId AND "fieldId" IN (:...fieldIds)', { blockId, fieldIds })
      .execute();
  }

  private clear(row: FieldValue): void {
    row.valueText = null;
    row.valueNumber = null;
    row.valueDate = null;
    row.valueBool = null;
    row.valueJson = null;
  }

  private assign(row: FieldValue, type: FieldType, raw: unknown): void {
    if (raw === null || raw === undefined) return;
    switch (type) {
      case FieldType.Number:
        row.valueNumber = String(Number(raw));
        return;
      case FieldType.Date:
        row.valueDate = raw instanceof Date ? raw : new Date(String(raw));
        return;
      case FieldType.Checkbox:
        row.valueBool = Boolean(raw);
        return;
      case FieldType.MultiSelect:
        row.valueJson = Array.isArray(raw) ? raw : [raw];
        return;
      case FieldType.Text:
      case FieldType.Select:
      case FieldType.Relation:
      case FieldType.User:
      case FieldType.Url:
      case FieldType.File:
        row.valueText = String(raw);
        return;
    }
  }
}

function defaultFor(type: FieldType, config: Record<string, unknown>): unknown {
  switch (type) {
    case FieldType.Checkbox:
      return false;
    case FieldType.Select: {
      const options = config.options;
      return Array.isArray(options) && options.length ? options[0] : null;
    }
    default:
      return null;
  }
}
