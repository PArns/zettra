import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/** Global BullMQ producer layer (§8.1/§8.3/§8.4). */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class JobsModule {}
