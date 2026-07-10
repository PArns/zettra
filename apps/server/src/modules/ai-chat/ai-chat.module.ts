import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Space } from '../../entities/index';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ViewModule } from '../view/view.module';
import { ReminderModule } from '../reminder/reminder.module';
import { AiChatService } from './ai-chat.service';
import { BriefingService } from './briefing.service';
import { AiChatController } from './ai-chat.controller';

/** AI chat + daily briefing over the index (§1, §4). AiRouterService comes from the global AiModule. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Block, Space]),
    AuthModule,
    EmbeddingModule,
    ViewModule,
    ReminderModule,
  ],
  providers: [AiChatService, BriefingService],
  controllers: [AiChatController],
})
export class AiChatModule {}
