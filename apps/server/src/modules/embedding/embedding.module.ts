import { Module } from '@nestjs/common';
import { SimilarityService } from './similarity.service';
import { EmbeddingService } from './embedding.service';

@Module({
  providers: [SimilarityService, EmbeddingService],
  exports: [SimilarityService, EmbeddingService],
})
export class EmbeddingModule {}
