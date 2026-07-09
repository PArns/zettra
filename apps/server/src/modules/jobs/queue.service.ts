import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectionOptions, Queue } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { loadConfig } from '../../config/configuration';

/** Canonical queue names (§8.1, §8.3, §8.4). Jobs are idempotent and debounced (§12). */
export const QUEUE = {
  Embed: 'embed',
  ProcessCapture: 'process-capture',
  BackfillFields: 'backfill-fields',
  CleanupFields: 'cleanup-fields',
  Curate: 'curate',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/**
 * Make a debounce key safe as a BullMQ custom jobId. BullMQ v5 rejects ':' (its Redis key
 * separator) with "Custom Id cannot contain :", so replace it with '_'. Pure and unit-tested —
 * the mapping must stay stable or debouncing (same key → same job) silently breaks.
 */
export function safeJobId(key: string): string {
  return key.replace(/:/g, '_');
}

/**
 * Thin wrapper over BullMQ. Provides lazily-created queues sharing one Redis connection.
 * Producers enqueue here; workers (later phases) consume. Debounce via a stable jobId so an
 * edit storm collapses to one job (§8.7 embed enqueue is debounced).
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis;
  private readonly queues = new Map<QueueName, Queue>();

  constructor() {
    this.connection = new IORedis(loadConfig().redisUrl, { maxRetriesPerRequest: null });
  }

  private queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      // Cast around ioredis version skew between our direct dep and bullmq's nested copy;
      // the runtime client is identical.
      q = new Queue(name, { connection: this.connection as unknown as ConnectionOptions });
      this.queues.set(name, q);
    }
    return q;
  }

  /**
   * Enqueue a job. When `debounceKey` is given it is used as the jobId so repeated enqueues
   * within the queue's retention collapse to a single job — the debounce discipline (§8.7).
   */
  async enqueue(
    name: QueueName,
    data: Record<string, unknown>,
    debounceKey?: string,
  ): Promise<void> {
    // BullMQ v5 forbids ':' in a custom jobId (it is the Redis key separator). Producers use
    // ':' as a natural separator (e.g. `embed:<blockId>`), so normalize it here — one place
    // covers every call site while keeping the key stable for debouncing.
    const jobId = debounceKey ? safeJobId(debounceKey) : undefined;
    // removeOnComplete is essential for the debounce jobId to work as a *debounce* and not a
    // permanent lock: while a job is pending/active the stable jobId collapses an edit storm, but
    // once it completes it must be removed so the next edit re-enqueues (else a block embeds/
    // materializes exactly once, ever — RAG/embeddings/curation silently stop updating).
    await this.queue(name).add(name, data, {
      ...(jobId ? { jobId } : {}),
      removeOnComplete: true,
      removeOnFail: 100,
    });
    this.logger.debug(`enqueued ${name}${jobId ? ` (${jobId})` : ''}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit();
  }
}
