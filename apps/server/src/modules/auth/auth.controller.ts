import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AuthTokenDto, UserSettingsDto } from '@zettra/shared';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';

class RegisterBody {
  @IsString() @MinLength(1) tenantName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() displayName?: string;
}

class LoginBody {
  @IsUUID() tenantId!: string;
  @IsEmail() email!: string;
  @IsString() password!: string;
}

class SettingsBody {
  @IsOptional() @IsIn(['light', 'dark', 'system']) themeMode?: 'light' | 'dark' | 'system';
  @IsOptional() @IsString() accent?: string;
  @IsOptional() @IsIn(['en', 'de', 'es', 'fr']) language?: 'en' | 'de' | 'es' | 'fr';
}

class ProfileBody {
  @IsOptional() @IsString() @MinLength(1) displayName?: string;
  @IsOptional() @IsEmail() email?: string;
}

class PasswordBody {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterBody): Promise<AuthTokenDto> {
    return this.auth.register(body);
  }

  @Post('login')
  login(@Body() body: LoginBody): Promise<AuthTokenDto> {
    return this.auth.login(body.tenantId, body.email, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Ctx() ctx: RequestContext): Promise<{
    userId: string | null;
    tenantId: string;
    spaces: string[];
    email: string | null;
    displayName: string | null;
  }> {
    return this.auth.me(ctx);
  }

  @Get('me/settings')
  @UseGuards(AuthGuard)
  getSettings(@Ctx() ctx: RequestContext): Promise<UserSettingsDto> {
    return this.auth.getSettings(ctx.userId ?? '', ctx.tenantId);
  }

  @Put('me/settings')
  @UseGuards(AuthGuard)
  saveSettings(@Ctx() ctx: RequestContext, @Body() body: SettingsBody): Promise<UserSettingsDto> {
    return this.auth.saveSettings(ctx.userId ?? '', ctx.tenantId, body);
  }

  @Put('me/profile')
  @UseGuards(AuthGuard)
  updateProfile(
    @Ctx() ctx: RequestContext,
    @Body() body: ProfileBody,
  ): Promise<{ email: string; displayName: string | null }> {
    return this.auth.updateProfile(ctx.userId ?? '', ctx.tenantId, body);
  }

  @Put('me/password')
  @UseGuards(AuthGuard)
  async changePassword(
    @Ctx() ctx: RequestContext,
    @Body() body: PasswordBody,
  ): Promise<{ ok: true }> {
    await this.auth.changePassword(
      ctx.userId ?? '',
      ctx.tenantId,
      body.currentPassword,
      body.newPassword,
    );
    return { ok: true };
  }
}
