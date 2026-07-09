import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, BlockRelation, FieldValue, TagField } from '../../entities/index';
import { GraphService } from './graph.service';
import { GraphController } from './graph.controller';
import { EntitiesController } from './entities.controller';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuthModule } from '../auth/auth.module';
import { LinkingModule } from '../linking/linking.module';
import { BlockModule } from '../block/block.module';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Block, BlockRelation, FieldValue, TagField]),
    EmbeddingModule,
    ApprovalModule,
    AuthModule,
    LinkingModule,
    BlockModule,
    TagModule,
  ],
  providers: [GraphService],
  controllers: [GraphController, EntitiesController],
})
export class GraphModule {}
