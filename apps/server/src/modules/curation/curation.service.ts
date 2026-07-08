import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPrivacyScope, AiStakes, AiTaskType, DocBlock, extractPlainText } from '@zettra/shared';
import { Block, Space } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { AiRouterService } from '../ai/ai-router.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SimilarityService } from '../embedding/similarity.service';
import { ApprovalService } from '../approval/approval.service';

interface RelationVerdict {
  isRelation: boolean;
  confidence: number;
}

/**
 * LLM curation (§8.4 layer 3): RAG applied to linking. Embeddings retrieve candidates
 * (layer 2); the AiRouter decides which are real typed relations; ApprovalService materializes
 * the decision against the resolved thresholds (invariant 8). Never runs Claude over
 * everything — only the top-N candidates.
 */
@Injectable()
export class CurationService {
  private readonly logger = new Logger(CurationService.name);

  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    private readonly ai: AiRouterService,
    private readonly embeddings: EmbeddingService,
    private readonly similarity: SimilarityService,
    private readonly approval: ApprovalService,
  ) {}

  async curateBlock(tenantId: string, blockId: string, topN = 5): Promise<void> {
    const block = await this.blocks.findOne({ where: { id: blockId, tenantId } });
    if (!block) return;

    const sourceText = extractPlainText(toDoc(block.content));
    if (!sourceText) return;

    const embedding = await this.embeddings.embedText(sourceText);
    if (!embedding) return;

    // Curation candidates MUST be scoped to what the context can see (§15.2); the worker uses
    // the block's own space as the visibility scope.
    const ctx: RequestContext = {
      tenantId,
      userId: null,
      visibleSpaceIds: [block.spaceId],
    };
    const candidates = await this.similarity.related(ctx, blockId, embedding, 0.35, topN);
    if (candidates.length === 0) return;

    const space = await this.spaces.findOne({ where: { id: block.spaceId } });
    const privacyScope = space?.aiPolicy ?? AiPrivacyScope.Default;

    for (const candidate of candidates) {
      const target = await this.blocks.findOne({ where: { id: candidate.blockId, tenantId } });
      if (!target) continue;
      const targetText = extractPlainText(toDoc(target.content));

      let verdict: RelationVerdict;
      try {
        const { result } = await this.ai.structured<RelationVerdict>(
          {
            type: AiTaskType.RelationCuration,
            privacyScope,
            estimatedTokens: Math.ceil((sourceText.length + targetText.length) / 4) + 200,
            stakes: AiStakes.High,
          },
          {
            schema: VERDICT_SCHEMA,
            parse: parseVerdict,
            messages: [
              {
                role: 'system',
                content:
                  'Decide if two notes describe a real, typed relationship (not just topical ' +
                  'similarity). Reply ONLY with JSON {"isRelation": bool, "confidence": 0..1}.',
              },
              {
                role: 'user',
                content: `A:\n${sourceText.slice(0, 2000)}\n\nB:\n${targetText.slice(0, 2000)}`,
              },
            ],
          },
        );
        verdict = result;
      } catch (err) {
        this.logger.warn(`Curation verdict failed: ${(err as Error).message}`);
        continue;
      }

      // Compare curation confidence — NOT cosine distance (invariant 8).
      const confidence = verdict.isRelation ? verdict.confidence : 0;
      await this.approval.applyDecision(tenantId, block.spaceId, block.ownerUserId, {
        sourceId: blockId,
        targetId: candidate.blockId,
        confidence,
      });
    }
  }
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { isRelation: { type: 'boolean' }, confidence: { type: 'number' } },
  required: ['isRelation', 'confidence'],
};

function parseVerdict(raw: string): RelationVerdict {
  const json = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  if (typeof json.isRelation !== 'boolean' || typeof json.confidence !== 'number') {
    throw new Error('verdict schema mismatch');
  }
  return { isRelation: json.isRelation, confidence: json.confidence };
}

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
