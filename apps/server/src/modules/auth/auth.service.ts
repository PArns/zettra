import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthTokenDto, UserDto, UserSettingsDto } from '@zettra/shared';
import { User } from '../../entities/index';
import { hashPassword, verifyPassword } from '../../common/password';
import { TenantService } from '../tenant/tenant.service';
import { JwtPayload } from './auth.guard';
import { RequestContext } from '../../common/request-context';

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

  /** Current user's identity + visible spaces (§2, §15.2). */
  async me(ctx: RequestContext): Promise<{
    userId: string | null;
    tenantId: string;
    spaces: string[];
    email: string | null;
    displayName: string | null;
  }> {
    const user = ctx.userId
      ? await this.users.findOne({ where: { id: ctx.userId, tenantId: ctx.tenantId } })
      : null;
    return {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      spaces: ctx.visibleSpaceIds,
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
    };
  }

  /** Update the display name and/or email. Email stays unique per tenant. */
  async updateProfile(
    userId: string,
    tenantId: string,
    patch: { displayName?: string; email?: string },
  ): Promise<{ email: string; displayName: string | null }> {
    const user = await this.users.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new UnauthorizedException('Unknown user');
    if (patch.email && patch.email !== user.email) {
      const clash = await this.users.findOne({ where: { tenantId, email: patch.email } });
      if (clash) throw new ConflictException('That email is already in use');
      user.email = patch.email;
    }
    if (patch.displayName !== undefined) user.displayName = patch.displayName;
    await this.users.save(user);
    return { email: user.email, displayName: user.displayName };
  }

  /** Change the password after verifying the current one. */
  async changePassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :userId AND u.tenantId = :tenantId', { userId, tenantId })
      .getOne();
    if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.users.update(
      { id: userId, tenantId },
      { passwordHash: await hashPassword(newPassword) },
    );
  }

  /** Read a user's persisted preferences (§2). Empty object if the user has none yet. */
  async getSettings(userId: string, tenantId: string): Promise<UserSettingsDto> {
    const user = await this.users.findOne({
      where: { id: userId, tenantId },
      select: { id: true, settings: true },
    });
    return (user?.settings ?? {}) as UserSettingsDto;
  }

  /** Merge a preferences patch into the user's stored settings and return the result. */
  async saveSettings(
    userId: string,
    tenantId: string,
    patch: UserSettingsDto,
  ): Promise<UserSettingsDto> {
    const user = await this.users.findOne({
      where: { id: userId, tenantId },
      select: { id: true, settings: true },
    });
    if (!user) throw new UnauthorizedException('Unknown user');
    const merged = { ...(user.settings ?? {}), ...patch };
    await this.users.update({ id: userId, tenantId }, { settings: merged });
    return merged as UserSettingsDto;
  }

  private async tokenFor(userId: string, tenantId: string, user: UserDto): Promise<AuthTokenDto> {
    const payload: JwtPayload = { sub: userId, tid: tenantId };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }

  private toDto(user: User, tenantId: string): UserDto {
    return { id: user.id, tenantId, email: user.email, displayName: user.displayName };
  }
}
