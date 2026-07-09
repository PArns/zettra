import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiPrivacyScope,
  type AgendaItem,
  AiStakes,
  AiTaskType,
  DocBlock,
  extractDueDates,
  extractPlainText,
  reconcile,
} from '@zettra/shared';
import { Block, Reminder, Space, Tag } from '../../entities/index';
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

    // Existing pending reminders for this owner become the "already booked" agenda to reconcile
    // against. SPEC-GAP: date-field values would also count as busy, but that needs the owner's
    // visibleSpaceIds (a RequestContext the capture job doesn't carry) — deferred.
    const existing = block.ownerUserId
      ? await this.reminders.find({
          where: { tenantId: block.tenantId, userId: block.ownerUserId, status: 'pending' },
          take: 500,
        })
      : [];
    const agenda: AgendaItem[] = existing.map((r) => ({
      blockId: r.blockId,
      title: r.note ?? '',
      date: r.remindAt.toISOString().slice(0, 10),
      kind: 'reminder',
    }));
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
      const note = clashing.has(d.iso) ? `⚠ ${d.match.slice(0, 78)}` : d.match.slice(0, 80);
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
