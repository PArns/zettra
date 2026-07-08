import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { BacklinkResult, GraphService, RelatedResult } from './graph.service';
import { ApprovalService } from '../approval/approval.service';
import { BlockRelation } from '../../entities/index';

@Controller()
@UseGuards(AuthGuard)
export class GraphController {
  constructor(
    private readonly graph: GraphService,
    private readonly approval: ApprovalService,
  ) {}

  @Get('blocks/:id/related')
  related(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<RelatedResult[]> {
    return this.graph.related(ctx, id);
  }

  @Get('blocks/:id/backlinks')
  backlinks(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BacklinkResult[]> {
    return this.graph.backlinks(ctx, id);
  }

  @Get('review')
  review(@Ctx() ctx: RequestContext): Promise<BlockRelation[]> {
    return this.graph.reviewQueue(ctx);
  }

  /** Auto-link calibration signal: dismiss-rate per confidence bucket (§8.5, §11). */
  @Get('metrics/link-quality')
  linkQuality(@Ctx() ctx: RequestContext) {
    return this.graph.linkQualityBuckets(ctx);
  }

  @Post('review/:id/confirm')
  async confirm(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.approval.confirm(ctx.tenantId, id, ctx.userId ?? 'system');
    return { ok: true };
  }

  @Post('review/:id/dismiss')
  async dismiss(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.approval.dismiss(ctx.tenantId, id, ctx.userId ?? 'system');
    return { ok: true };
  }
}
