import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Space } from '../../entities/index';
import { CurationService } from './curation.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [TypeOrmModule.forFeature([Block, Space]), EmbeddingModule, ApprovalModule],
  providers: [CurationService],
  exports: [CurationService],
})
export class CurationModule {}
