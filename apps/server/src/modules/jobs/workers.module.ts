import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, BlockTag } from '../../entities/index';
import { WorkerHost } from './worker-host.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { TagModule } from '../tag/tag.module';
import { FieldModule } from '../field/field.module';
import { CaptureModule } from '../capture/capture.module';
import { CurationModule } from '../curation/curation.module';
import { OcrModule } from '../ocr/ocr.module';
import { UploadsModule } from '../uploads/uploads.module';

/**
 * In-process BullMQ workers (§8). Separate from the producer-side JobsModule so a deployment
 * can run a dedicated worker process (RUN_WORKERS) with only this module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Block, BlockTag]),
    EmbeddingModule,
    TagModule,
    FieldModule,
    CaptureModule,
    CurationModule,
    OcrModule,
    UploadsModule,
  ],
  providers: [WorkerHost],
})
export class WorkersModule {}
