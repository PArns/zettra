import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space, User } from '../../entities/index';
import { AuthModule } from '../auth/auth.module';
import { SpaceModule } from '../space/space.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

/** Admin console (§2): tenant user + space management, gated by AdminGuard. */
@Module({
  imports: [TypeOrmModule.forFeature([User, Space]), AuthModule, SpaceModule],
  providers: [AdminService, AdminGuard],
  controllers: [AdminController],
})
export class AdminModule {}
