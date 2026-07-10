import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { AiChatService, ChatAnswer } from './ai-chat.service';
import { BriefingService, DailyBriefing } from './briefing.service';

class ChatBody {
  @IsString() @MinLength(1) question!: string;
  @IsOptional() @IsString() spaceId?: string;
}

/** AI chat + daily briefing over the index (§1, §4). Permission-scoped + privacy-gated in the service. */
@Controller('ai')
@UseGuards(AuthGuard)
export class AiChatController {
  constructor(
    private readonly chat: AiChatService,
    private readonly briefing: BriefingService,
  ) {}

  @Post('chat')
  ask(@Ctx() ctx: RequestContext, @Body() body: ChatBody): Promise<ChatAnswer> {
    return this.chat.answer(ctx, body.question, body.spaceId);
  }

  /** The proactive morning briefing over today's to-dos, reminders, and fresh notes (§4). */
  @Get('briefing')
  daily(@Ctx() ctx: RequestContext): Promise<DailyBriefing> {
    return this.briefing.daily(ctx);
  }
}
