import { Controller, Get, UseGuards } from '@nestjs/common';
import type { TenantTier, TierLimits, TierUsage } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { LimitsService } from './limits.service';

/** Read the tenant's plan + current usage (§5) — powers the "Plan" section in settings. */
@Controller('tenant')
@UseGuards(AuthGuard)
export class LimitsController {
  constructor(private readonly limits: LimitsService) {}

  @Get('limits')
  summary(
    @Ctx() ctx: RequestContext,
  ): Promise<{ tier: TenantTier; limits: TierLimits; usage: TierUsage }> {
    return this.limits.summary(ctx.tenantId);
  }
}
