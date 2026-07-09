import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Reminder } from '../../entities/index';
import { AuthModule } from '../auth/auth.module';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';

/** Reminders / Wiedervorlage (§3–§4). */
@Module({
  imports: [TypeOrmModule.forFeature([Reminder, Block]), AuthModule],
  providers: [ReminderService],
  controllers: [ReminderController],
  exports: [ReminderService],
})
export class ReminderModule {}
