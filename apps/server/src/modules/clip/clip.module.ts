import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockModule } from '../block/block.module';
import { ClipService } from './clip.service';
import { ClipController } from './clip.controller';

/** Web clipper (§8.3): fetch + extract a URL into a web_clip block. */
@Module({
  imports: [AuthModule, BlockModule],
  providers: [ClipService],
  controllers: [ClipController],
})
export class ClipModule {}
