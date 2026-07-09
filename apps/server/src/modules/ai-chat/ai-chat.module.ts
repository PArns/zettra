import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Space } from '../../entities/index';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';

/** AI chat over the index (§1). AiRouterService comes from the global AiModule. */
@Module({
  imports: [TypeOrmModule.forFeature([Block, Space]), AuthModule, EmbeddingModule],
  providers: [AiChatService],
  controllers: [AiChatController],
})
export class AiChatModule {}
