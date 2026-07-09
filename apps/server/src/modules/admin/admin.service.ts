import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AiPrivacyScope, UserRole } from '@zettra/shared';
import {
  Block,
  BlockEmbedding,
  BlockRelation,
  BlockTag,
  FieldValue,
  Membership,
  Space,
  User,
  View,
} from '../../entities/index';
import { hashPassword } from '../../common/password';
import { RequestContext } from '../../common/request-context';
import { JwtPayload } from '../auth/auth.guard';
import { SpaceService } from '../space/space.service';
import { leavesAnAdmin } from './admin.rules';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
}

/**
 * Workspace administration (§2): manage the tenant's users (create / set role / delete /
 * impersonate) and its spaces (list / create / delete). Every method is tenant-scoped; the
 * caller is already proven to be an admin by {@link AdminGuard}. "Never lock yourself out"
 * guarantees (keep ≥1 admin, no self-delete) are enforced via the pure {@link leavesAnAdmin}.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly spaceService: SpaceService,
  ) {}

  // --- Users ---

  async listUsers(tenantId: string): Promise<AdminUser[]> {
    const rows = await this.users.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async createUser(
    tenantId: string,
    dto: { email: string; password: string; displayName?: string; role?: string },
  ): Promise<AdminUser> {
    const clash = await this.users.findOne({ where: { tenantId, email: dto.email } });
    if (clash) throw new ConflictException('That email is already in use');
    const role = dto.role === UserRole.Admin ? UserRole.Admin : UserRole.Member;
    const user = await this.users.save(
      this.users.create({
        tenantId,
        email: dto.email,
        displayName: dto.displayName ?? null,
        role,
        passwordHash: await hashPassword(dto.password),
      }),
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async setUserRole(tenantId: string, userId: string, role: string): Promise<void> {
    const next = role === UserRole.Admin ? UserRole.Admin : UserRole.Member;
    const user = await this.users.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    // Demoting the last admin would lock the workspace out.
    if (
      user.role === UserRole.Admin &&
      next !== UserRole.Admin &&
      !(await this.otherAdminExists(tenantId, userId))
    ) {
      throw new BadRequestException('The workspace must keep at least one admin');
    }
    await this.users.update({ id: userId, tenantId }, { role: next });
  }

  async deleteUser(ctx: RequestContext, userId: string): Promise<void> {
    if (userId === ctx.userId) throw new BadRequestException('You cannot delete your own account');
    const user = await this.users.findOne({ where: { id: userId, tenantId: ctx.tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.Admin && !(await this.otherAdminExists(ctx.tenantId, userId))) {
      throw new BadRequestException('The workspace must keep at least one admin');
    }
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Membership).delete({ tenantId: ctx.tenantId, userId });
      await m.getRepository(User).delete({ id: userId, tenantId: ctx.tenantId });
    });
  }

  /** Mint an access token for another user in the tenant — admin impersonation (§2). */
  async impersonate(tenantId: string, userId: string): Promise<{ accessToken: string }> {
    const user = await this.users.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const payload: JwtPayload = { sub: user.id, tid: tenantId };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  private async otherAdminExists(tenantId: string, excludingUserId: string): Promise<boolean> {
    const admins = await this.users.find({
      where: { tenantId, role: UserRole.Admin },
      select: { id: true },
    });
    return leavesAnAdmin(
      admins.map((a) => a.id),
      excludingUserId,
    );
  }

  // --- Spaces ---

  listSpaces(tenantId: string): Promise<Space[]> {
    return this.spaces.find({ where: { tenantId }, order: { name: 'ASC' } });
  }

  createSpace(ctx: RequestContext, name: string, aiPolicy?: AiPrivacyScope): Promise<Space> {
    return this.spaceService.create(ctx, name, aiPolicy);
  }

  /** Delete a space and every row scoped to it (blocks + their facts, views, memberships). */
  async deleteSpace(tenantId: string, spaceId: string): Promise<void> {
    const space = await this.spaces.findOne({ where: { id: spaceId, tenantId } });
    if (!space) throw new NotFoundException('Space not found');
    await this.dataSource.transaction(async (m) => {
      const blocks = await m
        .getRepository(Block)
        .find({ where: { tenantId, spaceId }, select: { id: true } });
      const ids = blocks.map((b) => b.id);
      if (ids.length) {
        await m.getRepository(FieldValue).delete({ blockId: In(ids) });
        await m.getRepository(BlockTag).delete({ blockId: In(ids) });
        await m.getRepository(BlockEmbedding).delete({ blockId: In(ids) });
        await m.getRepository(BlockRelation).delete({ sourceId: In(ids) });
        await m.getRepository(BlockRelation).delete({ targetId: In(ids) });
      }
      await m.getRepository(Block).delete({ tenantId, spaceId });
      await m.getRepository(View).delete({ tenantId, spaceId });
      await m.getRepository(Membership).delete({ tenantId, spaceId });
      await m.getRepository(Space).delete({ id: spaceId, tenantId });
    });
  }
}
