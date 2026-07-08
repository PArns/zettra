import { Module } from '@nestjs/common';
import { AliasIndexService } from './alias-index.service';
import { MentionLinkerService } from './mention-linker.service';

@Module({
  providers: [AliasIndexService, MentionLinkerService],
  exports: [AliasIndexService, MentionLinkerService],
})
export class LinkingModule {}
