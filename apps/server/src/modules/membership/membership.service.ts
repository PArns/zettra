import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMembershipDto, MembershipRole } from '@zettra/shared';
import { Membership } from '../../entities/index';

/**
 * Space membership grants (§15.6 invitations — the grant mechanism, not the full invite UX).
 */
@Injectable()
export class MembershipService {
  constructor(@InjectRepository(Membership) private readonly memberships: Repository<Membership>) {}

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

  /** Create the owner membership for the space creator. */
  ensureOwner(tenantId: string, spaceId: string, userId: string): Promise<Membership> {
    return this.grant(tenantId, { spaceId, userId, role: MembershipRole.Owner });
  }
}
