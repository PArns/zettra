import { Module } from '@nestjs/common';
import { MaterializeService } from './materialize.service';
import { SyncController } from './sync.controller';

@Module({
  providers: [MaterializeService],
  controllers: [SyncController],
  exports: [MaterializeService],
})
export class SyncModule {}
