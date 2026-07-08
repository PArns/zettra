import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldValue, TagField } from '../../entities/index';
import { FieldValueService } from './field-value.service';
import { FieldValueController } from './field-value.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([FieldValue, TagField]), AuthModule],
  providers: [FieldValueService],
  controllers: [FieldValueController],
  exports: [FieldValueService],
})
export class FieldModule {}
