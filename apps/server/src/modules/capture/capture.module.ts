import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Space, Tag } from '../../entities/index';
import { CaptureService } from './capture.service';
import { LinkingModule } from '../linking/linking.module';
import { TagModule } from '../tag/tag.module';
import { FieldModule } from '../field/field.module';
import { ApprovalModule } from '../approval/approval.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Block, Tag, Space]),
    LinkingModule,
    TagModule,
    FieldModule,
    ApprovalModule,
  ],
  providers: [CaptureService],
  exports: [CaptureService],
})
export class CaptureModule {}
