import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  asTier,
  limitsFor,
  TenantTier,
  TierLimits,
  TierUsage,
  wouldExceed,
  type LimitedResource,
} from '@zettra/shared';
import { Block, Space, Tenant, User } from '../../entities/index';

/**
 * Tier limit enforcement (§5). Reads the tenant's tier, counts current usage, and blocks a
 * create that would cross a cap. Kept out of the entity services so the caps live in one place.
 */
@Injectable()
export class LimitsService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
  ) {}

  async getTier(tenantId: string): Promise<TenantTier> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    return asTier(tenant?.tier);
  }

  async getUsage(tenantId: string): Promise<TierUsage> {
    const [members, spaces, blocks] = await Promise.all([
      this.users.count({ where: { tenantId } }),
      this.spaces.count({ where: { tenantId } }),
      this.blocks.count({ where: { tenantId } }),
    ]);
    // SPEC-GAP: storage accounting (summing served upload sizes) is not tracked yet.
    return { members, spaces, blocks, storageMb: 0 };
  }

  async summary(
    tenantId: string,
  ): Promise<{ tier: TenantTier; limits: TierLimits; usage: TierUsage }> {
    const tier = await this.getTier(tenantId);
    return { tier, limits: limitsFor(tier), usage: await this.getUsage(tenantId) };
  }

  /** Throw if creating one more `resource` would exceed the tenant's tier cap. */
  async assertCanCreate(tenantId: string, resource: LimitedResource): Promise<void> {
    const { limits, usage } = await this.summary(tenantId);
    if (wouldExceed(usage[resource], limits[resource])) {
      throw new ForbiddenException(
        `Your plan's ${resource} limit (${limits[resource]}) has been reached. Upgrade to add more.`,
      );
    }
  }
}
