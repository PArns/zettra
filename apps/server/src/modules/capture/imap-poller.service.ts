import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { BlockSource } from '@zettra/shared';
import { ImapConfig, loadConfig } from '../../config/configuration';
import { RequestContext } from '../../common/request-context';
import { BlockService } from '../block/block.service';

/**
 * IMAP capture source (§8.3). Polls a mailbox for unseen messages and turns each into an
 * `email`-source block in the configured tenant/space/owner, idempotent per RFC message-id
 * (unique `tenantId` + `sourceRef`). Creating the block enqueues `process-capture`.
 *
 * Stays idle unless `IMAP_HOST` is configured, so it is a no-op in default deployments. Only
 * the workers process runs it (RUN_WORKERS) to avoid duplicate polling across API replicas.
 */
@Injectable()
export class ImapPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapPollerService.name);
  private readonly config: ImapConfig | null;
  private readonly runWorkers: boolean;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(private readonly blocks: BlockService) {
    const cfg = loadConfig();
    this.config = cfg.imap;
    this.runWorkers = cfg.runWorkers;
  }

  onModuleInit(): void {
    if (!this.config || !this.runWorkers) return;
    this.logger.log(
      `IMAP poller enabled for ${this.config.host} (${this.config.pollIntervalMs}ms)`,
    );
    // Fire once, then on an interval. Guarded so slow polls don't overlap.
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.config.pollIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (!this.config || this.polling) return;
    this.polling = true;
    const cfg = this.config;
    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Only unseen messages; idempotency also protects against re-capture.
        for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true })) {
          await this.ingest(cfg, msg.source, msg.envelope?.messageId ?? String(msg.uid));
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      this.logger.warn(`IMAP poll failed: ${(err as Error).message}`);
    } finally {
      await client.logout().catch(() => undefined);
      this.polling = false;
    }
  }

  private async ingest(
    cfg: ImapConfig,
    source: Buffer | undefined,
    messageId: string,
  ): Promise<void> {
    if (!source) return;
    const parsed = await simpleParser(source);
    const subject = parsed.subject ?? '(no subject)';
    const text = parsed.text ?? '';

    const ctx: RequestContext = {
      tenantId: cfg.tenantId,
      userId: cfg.ownerUserId,
      visibleSpaceIds: [cfg.spaceId],
    };
    await this.blocks.create(ctx, {
      spaceId: cfg.spaceId,
      source: BlockSource.Email,
      sourceRef: messageId,
      content: [
        { type: 'heading', content: [{ type: 'text', text: subject, styles: {} }] },
        ...text
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((p) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: p.trim(), styles: {} }],
          })),
      ],
    });
    this.logger.debug(`Captured email ${messageId}`);
  }
}
