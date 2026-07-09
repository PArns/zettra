import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MembershipRole, UserRole } from '@zettra/shared';
import { Membership, Space, Tenant, User } from '../../entities/index';
import { hashPassword } from '../../common/password';
import { SeederService } from './seeder.service';

export interface ProvisionTenantInput {
  tenantName: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerDisplayName?: string;
}

export interface ProvisionTenantResult {
  tenant: Tenant;
  owner: User;
  defaultSpace: Space;
}

/**
 * Tenant provisioning (§8.2). Creates the tenant, an owner user, a default space with an
 * owner membership, and seeds the default supertags — all atomically.
 */
@Injectable()
export class TenantService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly seeder: SeederService,
  ) {}

  async provision(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    return this.dataSource.transaction(async (manager) => {
      const tenant = await manager
        .getRepository(Tenant)
        .save(manager.getRepository(Tenant).create({ name: input.tenantName }));

      const existing = await manager
        .getRepository(User)
        .findOne({ where: { tenantId: tenant.id, email: input.ownerEmail } });
      if (existing) throw new ConflictException('User already exists for this tenant');

      const owner = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          tenantId: tenant.id,
          email: input.ownerEmail,
          displayName: input.ownerDisplayName ?? null,
          // The tenant creator is the workspace admin (§2).
          role: UserRole.Admin,
          passwordHash: await hashPassword(input.ownerPassword),
        }),
      );

      const defaultSpace = await manager
        .getRepository(Space)
        .save(manager.getRepository(Space).create({ tenantId: tenant.id, name: 'General' }));

      await manager.getRepository(Membership).save(
        manager.getRepository(Membership).create({
          tenantId: tenant.id,
          spaceId: defaultSpace.id,
          userId: owner.id,
          role: MembershipRole.Owner,
        }),
      );

      await this.seeder.seedTenant(manager, tenant.id);

      return { tenant, owner, defaultSpace };
    });
  }
}
