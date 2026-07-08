import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockTag, FieldValue, Tag, TagField } from '../../entities/index';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, TagField, BlockTag, FieldValue]), AuthModule],
  providers: [TagService],
  controllers: [TagController],
  exports: [TagService],
})
export class TagModule {}
