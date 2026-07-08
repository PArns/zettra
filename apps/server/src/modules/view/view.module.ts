import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, View } from '../../entities/index';
import { ViewService } from './view.service';
import { ViewController } from './view.controller';
import { TagModule } from '../tag/tag.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([View, Block]), TagModule, AuthModule],
  providers: [ViewService],
  controllers: [ViewController],
  exports: [ViewService],
})
export class ViewModule {}
