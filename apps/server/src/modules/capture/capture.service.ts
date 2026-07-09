import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  AiPrivacyScope,
  type AgendaItem,
  AiStakes,
  AiTaskType,
  DocBlock,
  extractDueDates,
  extractPlainText,
  FieldType,
  nearestFreeDay,
  reconcile,
} from '@zettra/shared';
import { Block, FieldValue, Reminder, Space, Tag, TagField } from '../../entities/index';
import { AiRouterService } from '../ai/ai-router.service';
import { clampConfidence, extractJson } from '../ai/ai-json';
import { AliasIndexService } from '../linking/alias-index.service';
import { MentionLinkerService } from '../linking/mention-linker.service';
import { TagService } from '../tag/tag.service';
import { FieldValueService } from '../field/field-value.service';
import { ApprovalService } from '../approval/approval.service';

interface TagProposal {
  tag: string | null;
  confidence: number;
  fields: Record<string, string | number | boolean | null>;
}

/**
 * `process-capture` (§8.3): extract text, deterministically link mentions (layer 1), then ask
 * the AiRouter to propose a supertag + field values. Auto-tag when confident (threshold from
 * the approval policy), else leave the block in the Briefkasten. Cost control: one router
 * call per block; batch upstream at bulk import.
 */
@Injectable()
export class CaptureService {
  private readonly logger = new Logger(CaptureService.name);

  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    @InjectRepository(Reminder) private readonly reminders: Repository<Reminder>,
    @InjectRepository(FieldValue) private readonly fieldValueRows: Repository<FieldValue>,
    @InjectRepository(TagField) private readonly tagFields: Repository<TagField>,
    private readonly ai: AiRouterService,
    private readonly aliasIndex: AliasIndexService,
    private readonly mentionLinker: MentionLinkerService,
    private readonly tagService: TagService,
    private readonly fieldValues: FieldValueService,
    private readonly approval: ApprovalService,
  ) {}

  async process(tenantId: string, blockId: string): Promise<void> {
    const block = await this.blocks.findOne({ where: { id: blockId, tenantId } });
    if (!block) return;

    const doc = toDoc(block.content);
    const text = extractPlainText(doc);

    // Layer 1: deterministic mention linking by annotating content (invariant 5 / 7).
    const aliases = await this.aliasIndex.build(tenantId, [block.spaceId]);
    const annotated = this.mentionLinker.annotate(doc, aliases);
    block.content = annotated;
    await this.blocks.save(block);

    if (!text) return;

    // Detect deadlines / appointments in the captured text and surface them as reminders (§5).
    await this.detectDeadlines(block, text);

    // Ask the router to propose a supertag + fields.
    const tagList = await this.tags.find({ where: { tenantId } });
    const space = await this.spaces.findOne({ where: { id: block.spaceId } });
    const privacyScope = space?.aiPolicy ?? AiPrivacyScope.Default;

    let proposal: TagProposal;
    try {
      const { result } = await this.ai.structured<TagProposal>(
        {
          type: AiTaskType.CaptureTagging,
          privacyScope,
          estimatedTokens: Math.ceil(text.length / 4) + 200,
          stakes: AiStakes.Low,
        },
        {
          schema: TAG_PROPOSAL_SCHEMA,
          parse: parseTagProposal,
          messages: [
            {
              role: 'system',
              content:
                'You classify a captured note. Reply ONLY with JSON ' +
                '{"tag": <one of the tag names or null>, "confidence": 0..1, "fields": {name: value}}.',
            },
            {
              role: 'user',
              content: `Available tags: ${tagList.map((t) => t.name).join(', ')}\n\nNote:\n${text.slice(0, 4000)}`,
            },
          ],
        },
      );
      proposal = result;
    } catch (err) {
      this.logger.warn(`Capture tagging failed for ${blockId}: ${(err as Error).message}`);
      await this.flagForReview(block); // Couldn't classify → send to "For Review".
      return;
    }

    const tag = proposal.tag ? tagList.find((t) => t.name === proposal.tag) : undefined;
    const thresholds = await this.approval.resolveFor(tenantId, block.spaceId, block.ownerUserId);
    if (!tag || proposal.confidence < thresholds.autoApprove) {
      // No confident tag → leave for human triage in the "For Review" bucket (§8.3 step 3).
      await this.flagForReview(block);
      return;
    }

    await this.tagService.applyTag(tenantId, blockId, tag.id, block.ownerUserId ?? null);
    const fields = await this.tagService.resolveEffectiveFields(tenantId, tag.id);
    for (const field of fields) {
      const value = proposal.fields[field.name];
      if (value !== undefined && value !== null) {
        await this.fieldValues.set(tenantId, blockId, field.id, value, null);
      }
    }
    // applyTag() has already cleared any prior review flag (§8.3).
    this.logger.log(`Auto-tagged ${blockId} as #${tag.name} (${proposal.confidence.toFixed(2)})`);
  }

  /** Mark a block as awaiting human triage (idempotent). */
  private async flagForReview(block: Block): Promise<void> {
    if (block.needsReview) return;
    block.needsReview = true;
    await this.blocks.save(block);
  }

  /**
   * Detect deadlines / appointments in captured text (e.g. a mail asking for a meeting "in 2
   * weeks") and create reminders for the block owner (§5). Only future dates; idempotent (skips
   * a date already reminded on this block). Pure extraction is unit-tested in shared.
   *
   * Mail↔calendar reconciliation: each candidate date is checked against the owner's existing
   * pending reminders via the shared `reconcile()`; a date that clashes with a day already booked
   * is marked so the owner sees the potential conflict. Only the owner's own reminders are
   * consulted (no cross-user read), so this stays permission-safe in the background job.
   *
   * Public so the embed worker can run it over OCR-extracted text too (a deadline photographed in
   * a scanned letter also reminds); idempotency keeps the two passes from double-booking a date.
   */
  async detectDeadlines(block: Block, text: string): Promise<void> {
    const refIso = block.createdAt.toISOString().slice(0, 10);
    const dates = extractDueDates(text, refIso).filter((d) => d.iso >= refIso);
    const candidates = dates.slice(0, 5);
    if (candidates.length === 0) return;

    // The owner's "already booked" agenda to reconcile against: pending reminders plus date-typed
    // field values on the owner's own blocks. Scoping the field values to `ownerUserId` keeps this
    // permission-safe without a RequestContext — an owner may always see their own blocks — so a
    // date the owner already committed to on an entity counts as busy, not just reminders.
    const [existing, dateFieldAgenda] = await Promise.all([
      block.ownerUserId
        ? this.reminders.find({
            where: { tenantId: block.tenantId, userId: block.ownerUserId, status: 'pending' },
            take: 500,
          })
        : Promise.resolve([]),
      block.ownerUserId
        ? this.ownerDateFieldAgenda(
            block.tenantId,
            block.ownerUserId,
            block.id,
            candidates.map((c) => c.iso),
          )
        : Promise.resolve([] as AgendaItem[]),
    ]);
    const agenda: AgendaItem[] = [
      ...existing.map((r) => ({
        blockId: r.blockId,
        title: r.note ?? '',
        date: r.remindAt.toISOString().slice(0, 10),
        kind: 'reminder' as const,
      })),
      ...dateFieldAgenda,
    ];
    const clashing = new Set(
      reconcile(
        agenda,
        candidates.map((c) => c.iso),
      ).clashes,
    );

    for (const d of candidates) {
      const remindAt = new Date(`${d.iso}T09:00:00Z`);
      const exists = await this.reminders.findOne({ where: { blockId: block.id, remindAt } });
      if (exists) continue;
      const note = clashing.has(d.iso)
        ? conflictNote(d.match, nearestFreeDay(agenda, d.iso))
        : d.match.slice(0, 80);
      await this.reminders.save(
        this.reminders.create({
          tenantId: block.tenantId,
          blockId: block.id,
          userId: block.ownerUserId,
          remindAt,
          note,
          status: 'pending',
        }),
      );
    }
  }

  /**
   * Date-typed field values on the owner's OWN blocks, as busy agenda days for reconciliation.
   * Scoped to `ownerUserId` (a self-owned block is always visible to its owner, so no
   * RequestContext is needed) over a window spanning the candidate dates plus a forward buffer
   * so {@link nearestFreeDay} has room to look ahead. The source block is excluded so a capture
   * never clashes with its own date field.
   */
  private async ownerDateFieldAgenda(
    tenantId: string,
    ownerUserId: string,
    sourceBlockId: string,
    candidateIsos: string[],
  ): Promise<AgendaItem[]> {
    if (candidateIsos.length === 0) return [];
    const dateFields = await this.tagFields.find({ where: { type: FieldType.Date } });
    if (dateFields.length === 0) return [];
    const sorted = [...candidateIsos].sort();
    const from = new Date(`${sorted[0]}T00:00:00Z`);
    const to = new Date(`${sorted[sorted.length - 1]}T23:59:59Z`);
    to.setUTCDate(to.getUTCDate() + 30); // headroom for nearestFreeDay to suggest an open day
    const rows = await this.fieldValueRows.find({
      where: {
        tenantId,
        fieldId: In(dateFields.map((f) => f.id)),
        valueDate: Between(from, to),
      },
      take: 1000,
    });
    if (rows.length === 0) return [];
    // Keep only rows on blocks the owner owns (permission-safe self-scope), minus the source.
    const owned = await this.blocks.find({
      where: { id: In([...new Set(rows.map((r) => r.blockId))]), tenantId, ownerUserId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((b) => b.id));
    return rows
      .filter((r) => r.valueDate !== null && r.blockId !== sourceBlockId && ownedIds.has(r.blockId))
      .map((r) => ({
        blockId: r.blockId,
        title: '',
        date: r.valueDate!.toISOString().slice(0, 10),
        kind: 'field' as const,
      }));
  }
}

/** A conflict reminder note: the matched phrase, flagged, with the nearest free day if one exists. */
function conflictNote(match: string, freeDay: string | null): string {
  const suffix = freeDay ? ` → free: ${freeDay}` : '';
  return `⚠ ${match.slice(0, 78 - suffix.length)}${suffix}`;
}

const TAG_PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    tag: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    fields: { type: 'object' },
  },
  required: ['tag', 'confidence'],
};

function parseTagProposal(raw: string): TagProposal {
  const json = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  const tag = typeof json.tag === 'string' ? json.tag : null;
  const fields = (
    json.fields && typeof json.fields === 'object' ? json.fields : {}
  ) as TagProposal['fields'];
  // clampConfidence throws on non-finite and clamps to [0,1] so an out-of-range model value
  // can't spuriously clear the auto-tag gate.
  return { tag, confidence: clampConfidence(json.confidence), fields };
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
