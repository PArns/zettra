import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Notification, NotificationKind, User } from '../../entities/index';

/** A notification enriched with the actor's display name for the client (§15.6). */
export interface NotificationView {
  id: string;
  kind: NotificationKind;
  sourceBlockId: string | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

/**
 * Notifications (§15.6): @-mentions resolving to a user, #task assignments, and suggested-link
 * review requests. Producers call `emit` with the actor (who triggered it); the client polls
 * `list`, which resolves actor ids to display names. Deduped per (user, kind, sourceBlock) so
 * repeated edits don't spam.
 */
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async emit(
    tenantId: string,
    userId: string,
    kind: NotificationKind,
    sourceBlockId: string | null,
    actorUserId: string | null = null,
  ): Promise<void> {
    const existing = await this.notifications.findOne({
      where: { tenantId, userId, kind, sourceBlockId: sourceBlockId ?? IsNull(), read: false },
    });
    if (existing) return;
    await this.notifications.save(
      this.notifications.create({
        tenantId,
        userId,
        kind,
        sourceBlockId,
        actorUserId,
        read: false,
      }),
    );
  }

  /** List a user's notifications, resolving actor ids to display names/emails. */
  async list(tenantId: string, userId: string): Promise<NotificationView[]> {
    const rows = await this.notifications.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const actorIds = [
      ...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => !!id)),
    ];
    const actors = actorIds.length
      ? await this.users.find({ where: { tenantId, id: In(actorIds) } })
      : [];
    const nameById = new Map(actors.map((u) => [u.id, u.displayName || u.email]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      sourceBlockId: r.sourceBlockId,
      actorName: r.actorUserId ? (nameById.get(r.actorUserId) ?? null) : null,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<void> {
    await this.notifications.update({ id, tenantId, userId }, { read: true });
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.notifications.update({ tenantId, userId, read: false }, { read: true });
  }
}
