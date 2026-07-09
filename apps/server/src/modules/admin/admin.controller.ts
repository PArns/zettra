import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AiPrivacyScope, UserRole } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { Space } from '../../entities/index';
import { AdminGuard } from './admin.guard';
import { AdminService, AdminUser } from './admin.service';

class CreateUserBody {
  @IsString() @MinLength(3) email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsIn([UserRole.Admin, UserRole.Member]) role?: string;
}

class RoleBody {
  @IsIn([UserRole.Admin, UserRole.Member]) role!: string;
}

class CreateSpaceBody {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsEnum(AiPrivacyScope) aiPolicy?: AiPrivacyScope;
}

/** Admin console API (§2). Admin-only: AuthGuard proves identity, AdminGuard proves the role. */
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Ctx() ctx: RequestContext): Promise<AdminUser[]> {
    return this.admin.listUsers(ctx.tenantId);
  }

  @Post('users')
  createUser(@Ctx() ctx: RequestContext, @Body() body: CreateUserBody): Promise<AdminUser> {
    return this.admin.createUser(ctx.tenantId, body);
  }

  @Patch('users/:id/role')
  async setRole(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: RoleBody,
  ): Promise<{ ok: true }> {
    await this.admin.setUserRole(ctx.tenantId, id, body.role);
    return { ok: true };
  }

  @Delete('users/:id')
  async deleteUser(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.admin.deleteUser(ctx, id);
    return { ok: true };
  }

  @Post('users/:id/impersonate')
  impersonate(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<{ accessToken: string }> {
    return this.admin.impersonate(ctx.tenantId, id);
  }

  @Get('spaces')
  spaces(@Ctx() ctx: RequestContext): Promise<Space[]> {
    return this.admin.listSpaces(ctx.tenantId);
  }

  @Post('spaces')
  createSpace(@Ctx() ctx: RequestContext, @Body() body: CreateSpaceBody): Promise<Space> {
    return this.admin.createSpace(ctx, body.name, body.aiPolicy);
  }

  @Delete('spaces/:id')
  async deleteSpace(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.admin.deleteSpace(ctx.tenantId, id);
    return { ok: true };
  }
}
