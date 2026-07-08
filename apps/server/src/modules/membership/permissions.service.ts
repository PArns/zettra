import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipRole } from '@zettra/shared';
import { Membership } from '../../entities/index';

/**
 * The reusable permission predicate (§15.2). `visibleSpaceIds` is applied AT THE QUERY LAYER
 * on every read path — views, inbox, similarity, backlinks, alias index, curation candidates
 * — so tenant scoping alone never leaks cross-space data (§7.11). Each miss is a data leak,
 * so route reads through this helper rather than re-deriving membership ad hoc.
 */
@Injectable()
export class PermissionsService {
  constructor(@InjectRepository(Membership) private readonly memberships: Repository<Membership>) {}

  /** All space ids the user may read within a tenant. Fail-closed: no memberships → []. */
  async visibleSpaceIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.memberships.find({
      where: { tenantId, userId },
      select: { spaceId: true },
    });
    return rows.map((r) => r.spaceId);
  }

  /** The user's role in a space, or null if not a member. */
  async roleInSpace(
    tenantId: string,
    userId: string,
    spaceId: string,
  ): Promise<MembershipRole | null> {
    const row = await this.memberships.findOne({ where: { tenantId, userId, spaceId } });
    return row?.role ?? null;
  }

  /** Whether the user's role meets or exceeds a required role (ordered viewer→owner). */
  async hasAtLeast(
    tenantId: string,
    userId: string,
    spaceId: string,
    required: MembershipRole,
  ): Promise<boolean> {
    const role = await this.roleInSpace(tenantId, userId, spaceId);
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[required];
  }
}

/** Least → most privileged. Keep in sync with MembershipRole. */
const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.Viewer]: 0,
  [MembershipRole.Commenter]: 1,
  [MembershipRole.Editor]: 2,
  [MembershipRole.Owner]: 3,
};
