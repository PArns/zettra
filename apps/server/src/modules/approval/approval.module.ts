import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalPolicy, BlockRelation } from '../../entities/index';
import { ApprovalService } from './approval.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalPolicy, BlockRelation])],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
