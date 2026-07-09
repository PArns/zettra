import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from '../../entities/index';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { AuthModule } from '../auth/auth.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [TypeOrmModule.forFeature([Space]), AuthModule, LimitsModule],
  providers: [SpaceService],
  controllers: [SpaceController],
  exports: [SpaceService],
})
export class SpaceModule {}
