import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block } from '../../entities/index';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { EmbeddingModule } from '../embedding/embedding.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Block]), EmbeddingModule, AuthModule],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
