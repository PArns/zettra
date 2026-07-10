import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { wouldCycle } from '@zettra/shared';
import { Block, Folder } from '../../entities/index';
import { RequestContext } from '../../common/request-context';

/**
 * Note folders (§8.2) — the organizational tree that lets a user file notes out of the
 * Briefkasten so they can be found again. A folder is a lightweight `parentId` tree; a note
 * points at one folder via `block.folderId`. Folders never affect permissions (invariant 6 &
 * 11): filing is presentation only, so listing is tenant + owner scoped and content reads go
 * through the permission-scoped view compiler.
 */
@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder) private readonly folders: Repository<Folder>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
  ) {}

  /** Every folder the acting user owns in this tenant (ordered for stable tree rendering). */
  list(ctx: RequestContext): Promise<Folder[]> {
    return this.folders.find({
      where: { tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined },
      order: { position: 'ASC', name: 'ASC' },
    });
  }

  async create(
    ctx: RequestContext,
    dto: { name: string; parentId?: string | null; spaceId: string },
  ): Promise<Folder> {
    if (dto.parentId) await this.requireFolder(ctx, dto.parentId);
    const count = await this.folders.count({
      where: { tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined },
    });
    return this.folders.save(
      this.folders.create({
        tenantId: ctx.tenantId,
        spaceId: dto.spaceId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        position: count,
        ownerUserId: ctx.userId,
      }),
    );
  }

  async rename(ctx: RequestContext, id: string, name: string): Promise<Folder> {
    const folder = await this.requireFolder(ctx, id);
    folder.name = name;
    return this.folders.save(folder);
  }

  /**
   * Move a folder under a new parent (or to the root with `parentId: null`). Cycle-guarded so
   * the tree stays a tree (§8.1, shared with the tag tree).
   */
  async setParent(ctx: RequestContext, id: string, parentId: string | null): Promise<Folder> {
    const folder = await this.requireFolder(ctx, id);
    if (parentId) {
      await this.requireFolder(ctx, parentId);
      const all = await this.folders.find({
        where: { tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined },
        select: { id: true, parentId: true },
      });
      if (wouldCycle(all, id, parentId)) {
        throw new BadRequestException('Moving the folder there would create a cycle');
      }
    }
    folder.parentId = parentId;
    return this.folders.save(folder);
  }

  /**
   * Delete a folder. Its notes fall back to the Briefkasten (`folderId = null`) and its child
   * folders re-parent to the deleted folder's parent — nothing is destroyed but the folder row.
   */
  async remove(ctx: RequestContext, id: string): Promise<void> {
    const folder = await this.requireFolder(ctx, id);
    await this.blocks.update(
      { tenantId: ctx.tenantId, folderId: id },
      { folderId: folder.parentId },
    );
    await this.folders.update(
      { tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined, parentId: id },
      { parentId: folder.parentId },
    );
    await this.folders.delete({ id, tenantId: ctx.tenantId });
  }

  /**
   * File a note into a folder (or back to the Briefkasten with `folderId: null`). Scoped to the
   * tenant; the block must exist. Filing never changes a note's space or visibility.
   */
  async fileBlock(ctx: RequestContext, blockId: string, folderId: string | null): Promise<void> {
    const block = await this.blocks.findOne({
      where: { id: blockId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!block) throw new NotFoundException('Note not found');
    if (folderId) await this.requireFolder(ctx, folderId);
    await this.blocks.update({ id: blockId, tenantId: ctx.tenantId }, { folderId });
  }

  private async requireFolder(ctx: RequestContext, id: string): Promise<Folder> {
    const folder = await this.folders.findOne({
      where: { id, tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined },
    });
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }
}
