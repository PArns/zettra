import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification, NotificationKind } from '../../entities/index';

/**
 * Notifications (§15.6): @-mentions resolving to a user, #task assignments, and suggested-link
 * review requests. Producers call `emit`; the client polls `list`. Deduped per
 * (user, kind, sourceBlock) so repeated edits don't spam.
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  async emit(
    tenantId: string,
    userId: string,
    kind: NotificationKind,
    sourceBlockId: string | null,
  ): Promise<void> {
    const existing = await this.notifications.findOne({
      where: { tenantId, userId, kind, sourceBlockId: sourceBlockId ?? IsNull(), read: false },
    });
    if (existing) return;
    await this.notifications.save(
      this.notifications.create({ tenantId, userId, kind, sourceBlockId, read: false }),
    );
  }

  list(tenantId: string, userId: string): Promise<Notification[]> {
    return this.notifications.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<void> {
    await this.notifications.update({ id, tenantId, userId }, { read: true });
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.notifications.update({ tenantId, userId, read: false }, { read: true });
  }
}
