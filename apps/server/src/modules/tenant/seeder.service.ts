import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FieldType, PolicyScope, SEED_TAGS, ViewLayout } from '@zettra/shared';
import { ApprovalPolicy, Tag, TagField, View } from '../../entities/index';

/**
 * Seeds the default supertags, their field schemas, a default table view each, and the
 * system approval policy on tenant creation (§8.2). Runs inside the caller's transaction so
 * tenant creation is atomic. Relation-field targets are resolved by tag name after all tags
 * exist.
 */
@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  async seedTenant(manager: EntityManager, tenantId: string): Promise<void> {
    const tagRepo = manager.getRepository(Tag);
    const fieldRepo = manager.getRepository(TagField);
    const viewRepo = manager.getRepository(View);
    const policyRepo = manager.getRepository(ApprovalPolicy);

    // Pass 1: create tags so relation targets can be resolved by name.
    const tagIdByName = new Map<string, string>();
    for (const seed of SEED_TAGS) {
      const tag = await tagRepo.save(
        tagRepo.create({
          tenantId,
          name: seed.name,
          icon: seed.icon ?? null,
          color: seed.color ?? null,
          extendsId: null,
        }),
      );
      tagIdByName.set(seed.name, tag.id);
    }

    // Pass 2: resolve extends chains, create fields + a default view, set defaultViewId.
    for (const seed of SEED_TAGS) {
      const tagId = tagIdByName.get(seed.name)!;

      if (seed.extends) {
        const extendsId = tagIdByName.get(seed.extends);
        if (extendsId) await tagRepo.update({ id: tagId }, { extendsId });
      }

      for (const [position, field] of seed.fields.entries()) {
        const config: Record<string, unknown> = {};
        if (field.config?.options) config.options = field.config.options;
        if (field.config?.targetTagName) {
          const targetTagId = tagIdByName.get(field.config.targetTagName);
          if (targetTagId) config.targetTagId = targetTagId;
        }
        await fieldRepo.save(
          fieldRepo.create({
            tagId,
            name: field.name,
            type: field.type as FieldType,
            config,
            position,
          }),
        );
      }

      const view = await viewRepo.save(
        viewRepo.create({
          tenantId,
          spaceId: null,
          name: capitalize(seed.name),
          tagId,
          layout: ViewLayout.Table,
          filters: [],
          sorts: [],
          groupBy: null,
          ownerUserId: null,
        }),
      );
      await tagRepo.update({ id: tagId }, { defaultViewId: view.id });
    }

    // System approval policy at spec defaults (§8.5).
    await policyRepo.save(
      policyRepo.create({
        tenantId,
        scope: PolicyScope.System,
        scopeId: null,
        autoApprove: 0.9,
        suggest: 0.5,
      }),
    );

    this.logger.log(`Seeded ${SEED_TAGS.length} supertags for tenant ${tenantId}`);
  }
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
