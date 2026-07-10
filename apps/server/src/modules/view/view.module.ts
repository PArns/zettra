import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, FieldValue, View } from '../../entities/index';
import { ViewService } from './view.service';
import { ViewController } from './view.controller';
import { TagModule } from '../tag/tag.module';
import { AuthModule } from '../auth/auth.module';
import { BlockModule } from '../block/block.module';
import { FieldModule } from '../field/field.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([View, Block, FieldValue]),
    TagModule,
    AuthModule,
    BlockModule,
    FieldModule,
  ],
  providers: [ViewService],
  controllers: [ViewController],
  exports: [ViewService],
})
export class ViewModule {}
