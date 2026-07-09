import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, BlockTag } from '../../entities/index';
import { BlockService } from './block.service';
import { BlockController } from './block.controller';
import { AuthModule } from '../auth/auth.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [TypeOrmModule.forFeature([Block, BlockTag]), AuthModule, LimitsModule],
  providers: [BlockService],
  controllers: [BlockController],
  exports: [BlockService],
})
export class BlockModule {}
