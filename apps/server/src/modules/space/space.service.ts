import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiPrivacyScope } from '@zettra/shared';
import { Space } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { MembershipService } from '../membership/membership.service';
import { LimitsService } from '../limits/limits.service';

/**
 * Spaces (§5). Creating a space grants the creator an owner membership. Listing is scoped to
 * the acting user's memberships (§15.2).
 */
@Injectable()
export class SpaceService {
  constructor(
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    private readonly memberships: MembershipService,
    private readonly limits: LimitsService,
  ) {}

  listVisible(ctx: RequestContext): Promise<Space[]> {
    if (ctx.visibleSpaceIds.length === 0) return Promise.resolve([]);
    return this.spaces.find({ where: { tenantId: ctx.tenantId, id: In(ctx.visibleSpaceIds) } });
  }

  async create(ctx: RequestContext, name: string, aiPolicy?: AiPrivacyScope): Promise<Space> {
    await this.limits.assertCanCreate(ctx.tenantId, 'spaces');
    const space = await this.spaces.save(
      this.spaces.create({
        tenantId: ctx.tenantId,
        name,
        aiPolicy: aiPolicy ?? AiPrivacyScope.Default,
      }),
    );
    if (ctx.userId) await this.memberships.ensureOwner(ctx.tenantId, space.id, ctx.userId);
    return space;
  }

  /** Set the shared AI privacy posture; resolves at the space, never per-user (§15.5). */
  async setAiPolicy(
    ctx: RequestContext,
    spaceId: string,
    aiPolicy: AiPrivacyScope,
  ): Promise<Space> {
    await this.spaces.update({ id: spaceId, tenantId: ctx.tenantId }, { aiPolicy });
    return this.spaces.findOneOrFail({ where: { id: spaceId, tenantId: ctx.tenantId } });
  }
}
