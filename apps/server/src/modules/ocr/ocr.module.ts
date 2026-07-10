import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { OcrService } from './ocr.service';
import { PdfService } from './pdf.service';

/**
 * Text extraction from uploads (§5/§6): OCR for raster images (tesseract.js, optional) and PDF
 * text-layer extraction (unpdf). Both feed the block's searchText + deadline detection.
 */
@Module({
  imports: [UploadsModule],
  providers: [OcrService, PdfService],
  exports: [OcrService, PdfService],
})
export class OcrModule {}
