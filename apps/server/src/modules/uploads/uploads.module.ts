import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { AuthModule } from '../auth/auth.module';
import { BlockModule } from '../block/block.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [AuthModule, BlockModule, LimitsModule],
  providers: [UploadsService],
  controllers: [UploadsController],
  exports: [UploadsService],
})
export class UploadsModule {}
