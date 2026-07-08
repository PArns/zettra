import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { ViewService } from './view.service';
import { Block } from '../../entities/index';

@Controller('views')
@UseGuards(AuthGuard)
export class ViewController {
  constructor(private readonly views: ViewService) {}

  /** The Briefkasten — untagged blocks owned by the acting user (§8.2). */
  @Get('inbox')
  inbox(@Ctx() ctx: RequestContext): Promise<Block[]> {
    return this.views.inbox(ctx);
  }

  @Get(':id/rows')
  run(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<Block[]> {
    return this.views.run(ctx, id);
  }
}
