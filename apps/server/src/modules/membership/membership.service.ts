import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateMembershipDto, MembershipRole } from '@zettra/shared';
import { Membership, User } from '../../entities/index';

/** A member's public identity — safe to expose to co-members (never the password hash). */
export interface MemberIdentity {
  id: string;
  displayName: string | null;
  email: string;
}

/**
 * Space membership grants (§15.6 invitations — the grant mechanism, not the full invite UX).
 */
@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async grant(tenantId: string, dto: CreateMembershipDto): Promise<Membership> {
    const existing = await this.memberships.findOne({
      where: { tenantId, spaceId: dto.spaceId, userId: dto.userId },
    });
    if (existing) {
      existing.role = dto.role;
      return this.memberships.save(existing);
    }
    const row = this.memberships.create({
      tenantId,
      spaceId: dto.spaceId,
      userId: dto.userId,
      role: dto.role,
    });
    return this.memberships.save(row);
  }

  async revoke(tenantId: string, spaceId: string, userId: string): Promise<void> {
    await this.memberships.delete({ tenantId, spaceId, userId });
  }

  listForSpace(tenantId: string, spaceId: string): Promise<Membership[]> {
    return this.memberships.find({ where: { tenantId, spaceId } });
  }

  /**
   * Distinct member identities across the spaces the caller may read (§15.2) — the population a
   * `user`-typed field can be assigned to. Permission-scoped: a user the caller shares no visible
   * space with is not disclosed. Never returns the password hash (it is `select: false`).
   */
  async listVisibleMembers(tenantId: string, visibleSpaceIds: string[]): Promise<MemberIdentity[]> {
    if (visibleSpaceIds.length === 0) return [];
    const rows = await this.memberships.find({
      where: { tenantId, spaceId: In(visibleSpaceIds) },
      select: { userId: true },
    });
    const ids = [...new Set(rows.map((r) => r.userId))];
    if (ids.length === 0) return [];
    const users = await this.users.find({ where: { id: In(ids), tenantId } });
    return users
      .map((u) => ({ id: u.id, displayName: u.displayName, email: u.email }))
      .sort((a, b) => (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email));
  }

  /** Create the owner membership for the space creator. */
  ensureOwner(tenantId: string, spaceId: string, userId: string): Promise<Membership> {
    return this.grant(tenantId, { spaceId, userId, role: MembershipRole.Owner });
  }
}
