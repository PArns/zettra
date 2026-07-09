import { BlockDto } from '@zettra/shared';
import { Block } from '../entities/index';

/** Single source of truth for Block → BlockDto so every endpoint returns the same shape. */
export function toBlockDto(b: Block, tagIds: string[]): BlockDto {
  return {
    id: b.id,
    tenantId: b.tenantId,
    spaceId: b.spaceId,
    parentId: b.parentId,
    position: b.position,
    content: b.content,
    source: b.source,
    sourceRef: b.sourceRef,
    visibility: b.visibility,
    needsReview: b.needsReview,
    ownerUserId: b.ownerUserId,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    tagIds,
  };
}
