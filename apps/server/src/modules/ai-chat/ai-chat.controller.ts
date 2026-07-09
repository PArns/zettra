import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { AiChatService, ChatAnswer } from './ai-chat.service';

class ChatBody {
  @IsString() @MinLength(1) question!: string;
  @IsOptional() @IsString() spaceId?: string;
}

/** AI chat over the index (§1). Permission-scoped + privacy-gated in the service. */
@Controller('ai')
@UseGuards(AuthGuard)
export class AiChatController {
  constructor(private readonly chat: AiChatService) {}

  @Post('chat')
  ask(@Ctx() ctx: RequestContext, @Body() body: ChatBody): Promise<ChatAnswer> {
    return this.chat.answer(ctx, body.question, body.spaceId);
  }
}
