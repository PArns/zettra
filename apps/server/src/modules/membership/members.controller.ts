import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { MemberIdentity, MembershipService } from './membership.service';

/**
 * The workspace member directory — the population a `user`-typed field can point at. Scoped to
 * the spaces the caller may read (§15.2), so it never discloses users outside their reach.
 */
@Controller('members')
@UseGuards(AuthGuard)
export class MembersController {
  constructor(private readonly memberships: MembershipService) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<MemberIdentity[]> {
    return this.memberships.listVisibleMembers(ctx.tenantId, ctx.visibleSpaceIds);
  }
}
