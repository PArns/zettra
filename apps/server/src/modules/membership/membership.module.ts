import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../../entities/index';
import { PermissionsService } from './permissions.service';
import { MembershipService } from './membership.service';

/** Membership + the permission predicate. Global so every read path can scope by it (§15.2). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Membership])],
  providers: [PermissionsService, MembershipService],
  exports: [PermissionsService, MembershipService],
})
export class MembershipModule {}
