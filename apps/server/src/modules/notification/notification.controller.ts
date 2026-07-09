import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { NotificationService, NotificationView } from './notification.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<NotificationView[]> {
    return ctx.userId ? this.notifications.list(ctx.tenantId, ctx.userId) : Promise.resolve([]);
  }

  @Post('read-all')
  async readAll(@Ctx() ctx: RequestContext): Promise<{ ok: true }> {
    if (ctx.userId) await this.notifications.markAllRead(ctx.tenantId, ctx.userId);
    return { ok: true };
  }

  @Post(':id/read')
  async read(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    if (ctx.userId) await this.notifications.markRead(ctx.tenantId, ctx.userId, id);
    return { ok: true };
  }
}
