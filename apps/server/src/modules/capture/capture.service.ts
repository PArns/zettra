import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiPrivacyScope,
  AiStakes,
  AiTaskType,
  DocBlock,
  extractPlainText,
} from '@zettra/shared';
import { Block, Space, Tag } from '../../entities/index';
import { AiRouterService } from '../ai/ai-router.service';
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
      return; // Leave untagged in the inbox.
    }

    if (!proposal.tag) return;
    const tag = tagList.find((t) => t.name === proposal.tag);
    if (!tag) return;

    const thresholds = await this.approval.resolveFor(tenantId, block.spaceId, block.ownerUserId);
    if (proposal.confidence < thresholds.autoApprove) {
      // Not confident enough to auto-tag; leave in inbox (§8.3 step 3).
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
    this.logger.log(`Auto-tagged ${blockId} as #${tag.name} (${proposal.confidence.toFixed(2)})`);
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
  if (typeof json.confidence !== 'number') throw new Error('confidence missing/invalid');
  const tag = typeof json.tag === 'string' ? json.tag : null;
  const fields = (json.fields && typeof json.fields === 'object' ? json.fields : {}) as TagProposal['fields'];
  return { tag, confidence: json.confidence, fields };
}

/** Tolerate models that wrap JSON in prose/code fences (§14.5: parse is the schema gate). */
function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced) return fenced[1]!;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw;
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
