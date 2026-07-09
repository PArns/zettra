import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Reminder, Space, Tag } from '../../entities/index';
import { CaptureService } from './capture.service';
import { CaptureController } from './capture.controller';
import { ImapPollerService } from './imap-poller.service';
import { LinkingModule } from '../linking/linking.module';
import { TagModule } from '../tag/tag.module';
import { FieldModule } from '../field/field.module';
import { ApprovalModule } from '../approval/approval.module';
import { BlockModule } from '../block/block.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Block, Tag, Space, Reminder]),
    LinkingModule,
    TagModule,
    FieldModule,
    ApprovalModule,
    BlockModule,
    AuthModule,
  ],
  providers: [CaptureService, ImapPollerService],
  controllers: [CaptureController],
  exports: [CaptureService],
})
export class CaptureModule {}
