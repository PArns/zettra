import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AiPrivacyScope, MembershipRole } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { SpaceService } from './space.service';
import { MembershipService } from '../membership/membership.service';
import { Membership, Space } from '../../entities/index';

class CreateSpaceBody {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsEnum(AiPrivacyScope) aiPolicy?: AiPrivacyScope;
}

class GrantBody {
  @IsUUID() userId!: string;
  @IsEnum(MembershipRole) role!: MembershipRole;
}

@Controller('spaces')
@UseGuards(AuthGuard)
export class SpaceController {
  constructor(
    private readonly spaces: SpaceService,
    private readonly memberships: MembershipService,
  ) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<Space[]> {
    return this.spaces.listVisible(ctx);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() body: CreateSpaceBody): Promise<Space> {
    return this.spaces.create(ctx, body.name, body.aiPolicy);
  }

  @Put(':id/ai-policy')
  setAiPolicy(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { aiPolicy: AiPrivacyScope },
  ): Promise<Space> {
    return this.spaces.setAiPolicy(ctx, id, body.aiPolicy);
  }

  @Get(':id/members')
  members(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<Membership[]> {
    return this.memberships.listForSpace(ctx.tenantId, id);
  }

  @Post(':id/members')
  grant(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: GrantBody,
  ): Promise<Membership> {
    return this.memberships.grant(ctx.tenantId, {
      spaceId: id,
      userId: body.userId,
      role: body.role,
    });
  }
}
