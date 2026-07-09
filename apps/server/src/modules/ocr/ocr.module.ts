import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { OcrService } from './ocr.service';

/** OCR pass (§5/§6): recognize text in uploaded images. tesseract.js is an optional dependency. */
@Module({
  imports: [UploadsModule],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
