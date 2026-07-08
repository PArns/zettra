import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthTokenDto, UserDto } from '@zettra/shared';
import { User } from '../../entities/index';
import { verifyPassword } from '../../common/password';
import { TenantService } from '../tenant/tenant.service';
import { JwtPayload } from './auth.guard';

export interface RegisterInput {
  tenantName: string;
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Minimal email+password auth (§2: pluggable interface, email+password is enough to gate the
 * API). Registration provisions a whole tenant with seeded supertags via TenantService.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly tenants: TenantService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokenDto> {
    const { tenant, owner } = await this.tenants.provision({
      tenantName: input.tenantName,
      ownerEmail: input.email,
      ownerPassword: input.password,
      ownerDisplayName: input.displayName,
    });
    return this.tokenFor(owner.id, tenant.id, this.toDto(owner, tenant.id));
  }

  async login(tenantId: string, email: string, password: string): Promise<AuthTokenDto> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.tenantId = :tenantId AND u.email = :email', { tenantId, email })
      .getOne();
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.tokenFor(user.id, tenantId, this.toDto(user, tenantId));
  }

  private async tokenFor(userId: string, tenantId: string, user: UserDto): Promise<AuthTokenDto> {
    const payload: JwtPayload = { sub: userId, tid: tenantId };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }

  private toDto(user: User, tenantId: string): UserDto {
    return { id: user.id, tenantId, email: user.email, displayName: user.displayName };
  }
}
