import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, FieldValue, Reminder, TagField } from '../../entities/index';
import { AuthModule } from '../auth/auth.module';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';

/** Calendar surface (§3): agenda over reminders + date fields, permission-scoped. */
@Module({
  imports: [TypeOrmModule.forFeature([Reminder, FieldValue, TagField, Block]), AuthModule],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService],
})
export class CalendarModule {}
