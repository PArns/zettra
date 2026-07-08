import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership, Space, Tenant, User } from '../../entities/index';
import { TenantService } from './tenant.service';
import { SeederService } from './seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, User, Space, Membership])],
  providers: [TenantService, SeederService],
  exports: [TenantService],
})
export class TenantModule {}
