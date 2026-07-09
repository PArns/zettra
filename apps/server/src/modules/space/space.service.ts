import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiPrivacyScope, welcomeDoc } from '@zettra/shared';
import { Space } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { MembershipService } from '../membership/membership.service';
import { BlockService } from '../block/block.service';
import { LimitsService } from '../limits/limits.service';

/**
 * Spaces (§5). Creating a space grants the creator an owner membership and seeds a starter
 * welcome note (§8.2). Listing is scoped to the acting user's memberships (§15.2).
 */
@Injectable()
export class SpaceService {
  private readonly logger = new Logger(SpaceService.name);

  constructor(
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    private readonly memberships: MembershipService,
    private readonly blocks: BlockService,
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

    // Seed the starter template. The new space isn't in the request's visibleSpaceIds yet, so
    // scope a context that includes it (the creator owns it). Best-effort: a template failure
    // (e.g. a block-count cap) must never fail space creation.
    try {
      const scoped: RequestContext = {
        ...ctx,
        visibleSpaceIds: [...ctx.visibleSpaceIds, space.id],
      };
      await this.blocks.create(scoped, { spaceId: space.id, content: welcomeDoc(name) });
    } catch (err) {
      this.logger.warn(`Starter template skipped for space ${space.id}: ${(err as Error).message}`);
    }
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
