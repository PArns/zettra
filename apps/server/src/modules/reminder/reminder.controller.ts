import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { RECURRENCE_RULES } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { ReminderService, ReminderView } from './reminder.service';

class CreateReminderBody {
  @IsString() blockId!: string;
  @IsString() @MinLength(8) remindAt!: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsIn(RECURRENCE_RULES as readonly string[]) recurrence?: string;
}

/** Reminders / Wiedervorlage (§3–§4). Permission-scoped in the service. */
@Controller('reminders')
@UseGuards(AuthGuard)
export class ReminderController {
  constructor(private readonly reminders: ReminderService) {}

  @Get('upcoming')
  upcoming(@Ctx() ctx: RequestContext): Promise<ReminderView[]> {
    return this.reminders.listUpcoming(ctx);
  }

  @Get('block/:blockId')
  forBlock(@Ctx() ctx: RequestContext, @Param('blockId') blockId: string): Promise<ReminderView[]> {
    return this.reminders.listForBlock(ctx, blockId);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() body: CreateReminderBody): Promise<ReminderView> {
    return this.reminders.create(ctx, body.blockId, body.remindAt, body.note, body.recurrence);
  }

  @Post(':id/done')
  async done(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.reminders.setStatus(ctx, id, 'done');
    return { ok: true };
  }

  @Post(':id/dismiss')
  async dismiss(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.reminders.setStatus(ctx, id, 'dismissed');
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.reminders.remove(ctx, id);
    return { ok: true };
  }
}
