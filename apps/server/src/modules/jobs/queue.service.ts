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
    await this.queue(name).add(name, data, debounceKey ? { jobId: debounceKey } : undefined);
    this.logger.debug(`enqueued ${name}${debounceKey ? ` (${debounceKey})` : ''}`);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit();
  }
}
