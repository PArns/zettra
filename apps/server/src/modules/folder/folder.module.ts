import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Block, Folder } from '../../entities/index';
import { FolderService } from './folder.service';
import { FolderController } from './folder.controller';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import { BlockModule } from '../block/block.module';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, Block]), AuthModule, ViewModule, BlockModule],
  providers: [FolderService],
  controllers: [FolderController],
  exports: [FolderService],
})
export class FolderModule {}
