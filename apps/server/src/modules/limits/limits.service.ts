import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  asTier,
  bytesToMb,
  limitsFor,
  TenantTier,
  TierLimits,
  TierUsage,
  wouldExceed,
  type LimitedResource,
} from '@zettra/shared';
import { Block, Space, Tenant, User } from '../../entities/index';
import { loadConfig } from '../../config/configuration';

/**
 * Tier limit enforcement (§5). Reads the tenant's tier, counts current usage, and blocks a
 * create that would cross a cap. Kept out of the entity services so the caps live in one place.
 */
@Injectable()
export class LimitsService {
  private readonly uploadDir = loadConfig().uploadDir;

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
    const [members, spaces, blocks, bytes] = await Promise.all([
      this.users.count({ where: { tenantId } }),
      this.spaces.count({ where: { tenantId } }),
      this.blocks.count({ where: { tenantId } }),
      this.storageBytes(tenantId),
    ]);
    return { members, spaces, blocks, storageMb: bytesToMb(bytes) };
  }

  /**
   * Total bytes stored for a tenant — the sum of served upload sizes, which live flat under
   * `<uploadDir>/<tenantId>/` (see UploadsService). Returns 0 when the tenant has no uploads.
   * SPEC-GAP: for very large tenants this stat-walk should be cached/denormalized per upload.
   */
  private async storageBytes(tenantId: string): Promise<number> {
    const dir = join(this.uploadDir, tenantId);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return 0; // directory absent → nothing uploaded yet
    }
    let total = 0;
    for (const name of names) {
      try {
        const s = await stat(join(dir, name));
        if (s.isFile()) total += s.size;
      } catch {
        // File removed between readdir and stat — skip it.
      }
    }
    return total;
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

  /**
   * Throw if storing `incomingBytes` more would push the tenant past its storage cap. Uploads
   * stream, so the size is taken from Content-Length up front (0 when absent, which still blocks
   * a tenant already at/over the cap).
   */
  async assertCanUpload(tenantId: string, incomingBytes: number): Promise<void> {
    const { limits, usage } = await this.summary(tenantId);
    if (wouldExceed(usage.storageMb, limits.storageMb, bytesToMb(incomingBytes))) {
      throw new ForbiddenException(
        `Your plan's storage limit (${limits.storageMb} MB) has been reached. Upgrade to add more.`,
      );
    }
  }
}
