import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, Worker } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { chunkText, DocBlock, extractPlainText } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';
import { Block, BlockTag } from '../../entities/index';
import { QUEUE, QueueName } from './queue.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { TagService } from '../tag/tag.service';
import { FieldValueService } from '../field/field-value.service';
import { CaptureService } from '../capture/capture.service';
import { CurationService } from '../curation/curation.service';

/**
 * In-process BullMQ workers (§8). Runs the queues the producers enqueue: embed, capture,
 * field backfill/cleanup, and curation. Gated by RUN_WORKERS so a deployment can run a
 * dedicated worker process instead. Handlers are idempotent (§12).
 */
@Injectable()
export class WorkerHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHost.name);
  private readonly connection: Redis;
  private readonly workers: Worker[] = [];

  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(BlockTag) private readonly blockTags: Repository<BlockTag>,
    private readonly embeddings: EmbeddingService,
    private readonly tags: TagService,
    private readonly fieldValues: FieldValueService,
    private readonly capture: CaptureService,
    private readonly curation: CurationService,
  ) {
    this.connection = new IORedis(loadConfig().redisUrl, { maxRetriesPerRequest: null });
  }

  onModuleInit(): void {
    if (!loadConfig().runWorkers) {
      this.logger.log('RUN_WORKERS=false — workers disabled in this process');
      return;
    }
    this.spawn(QUEUE.Embed, (job) => this.onEmbed(job));
    this.spawn(QUEUE.BackfillFields, (job) => this.onBackfill(job));
    this.spawn(QUEUE.CleanupFields, (job) => this.onCleanup(job));
    this.spawn(QUEUE.ProcessCapture, (job) => this.onCapture(job));
    this.spawn(QUEUE.Curate, (job) => this.onCurate(job));
    this.logger.log('Workers started: embed, backfill, cleanup, capture, curate');
  }

  private spawn(name: QueueName, handler: (job: Job) => Promise<void>): void {
    const worker = new Worker(name, handler, { connection: this.connection, concurrency: 4 });
    worker.on('failed', (job, err) =>
      this.logger.warn(`${name} job ${job?.id} failed: ${err.message}`),
    );
    this.workers.push(worker);
  }

  // --- Handlers ---

  private async onEmbed(job: Job): Promise<void> {
    const { tenantId, blockId } = job.data as { tenantId: string; blockId: string };
    const block = await this.blocks.findOne({ where: { id: blockId, tenantId } });
    if (!block) return;
    const text = extractPlainText(toDoc(block.content));
    // Maintain the full-text column for hybrid search (§11); the tsvector is generated.
    await this.blocks.update({ id: blockId }, { searchText: text });
    const chunks = chunkText(text);
    const vectors: number[][] = [];
    for (const chunk of chunks) {
      const vec = await this.embeddings.embedText(chunk);
      if (vec) vectors.push(vec);
    }
    if (vectors.length) await this.embeddings.replaceForBlock(tenantId, blockId, vectors);
    // Kick curation once the block is embedded (§8.4 cascade).
    await this.curation.curateBlock(tenantId, blockId).catch(() => undefined);
  }

  private async onBackfill(job: Job): Promise<void> {
    const { tenantId, blockId, tagId } = job.data as {
      tenantId: string;
      blockId: string;
      tagId: string;
    };
    const fields = await this.tags.resolveEffectiveFields(tenantId, tagId);
    await this.fieldValues.backfillDefaults(
      tenantId,
      blockId,
      fields.map((f) => ({ id: f.id, type: f.type, config: f.config })),
    );
  }

  private async onCleanup(job: Job): Promise<void> {
    const { tenantId, blockId, tagId } = job.data as {
      tenantId: string;
      blockId: string;
      tagId: string;
    };
    // Fields orphaned = the removed tag's fields not provided by any remaining tag on the block.
    const removed = await this.tags.resolveEffectiveFields(tenantId, tagId);
    const remainingTags = await this.blockTags.find({ where: { blockId } });
    const keep = new Set<string>();
    for (const bt of remainingTags) {
      const fields = await this.tags.resolveEffectiveFields(tenantId, bt.tagId);
      fields.forEach((f) => keep.add(f.id));
    }
    const orphaned = removed.map((f) => f.id).filter((id) => !keep.has(id));
    await this.fieldValues.cleanupOrphaned(blockId, orphaned);
  }

  private async onCapture(job: Job): Promise<void> {
    const { tenantId, blockId } = job.data as { tenantId: string; blockId: string };
    await this.capture.process(tenantId, blockId);
  }

  private async onCurate(job: Job): Promise<void> {
    const { tenantId, blockId } = job.data as { tenantId: string; blockId: string };
    await this.curation.curateBlock(tenantId, blockId);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.connection.quit();
  }
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
