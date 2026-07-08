import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AuthTokenDto } from '@zettra/shared';
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
  me(@Ctx() ctx: RequestContext): { userId: string | null; tenantId: string; spaces: string[] } {
    return { userId: ctx.userId, tenantId: ctx.tenantId, spaces: ctx.visibleSpaceIds };
  }
}
