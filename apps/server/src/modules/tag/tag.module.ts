import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockTag, Tag, TagField } from '../../entities/index';
import { TagService } from './tag.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, TagField, BlockTag])],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
