import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { BlockDto, FolderDto } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { Folder } from '../../entities/index';
import { FolderService } from './folder.service';
import { ViewService } from '../view/view.service';
import { BlockService } from '../block/block.service';
import { toBlockDto } from '../../common/block-dto';

class CreateFolderBody {
  @IsString() @MinLength(1) name!: string;
  @IsUUID() spaceId!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
}

class RenameFolderBody {
  @IsString() @MinLength(1) name!: string;
}

class SetParentBody {
  @IsOptional() @IsUUID() parentId?: string | null;
}

class FileBlockBody {
  @IsOptional() @IsUUID() folderId?: string | null;
}

/** Note folders (§8.2) — the sidebar organization tree. */
@Controller('folders')
@UseGuards(AuthGuard)
export class FolderController {
  constructor(
    private readonly folders: FolderService,
    private readonly views: ViewService,
    private readonly blocks: BlockService,
  ) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<FolderDto[]> {
    return this.folders.list(ctx).then((rows) => rows.map(toFolderDto));
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() body: CreateFolderBody): Promise<FolderDto> {
    return this.folders.create(ctx, body).then(toFolderDto);
  }

  @Patch(':id')
  rename(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: RenameFolderBody,
  ): Promise<FolderDto> {
    return this.folders.rename(ctx, id, body.name).then(toFolderDto);
  }

  @Patch(':id/parent')
  setParent(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: SetParentBody,
  ): Promise<FolderDto> {
    return this.folders.setParent(ctx, id, body.parentId ?? null).then(toFolderDto);
  }

  @Delete(':id')
  async remove(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.folders.remove(ctx, id);
    return { ok: true };
  }

  /** File a note into this folder (or back to the Briefkasten with `folderId: null`). */
  @Post('file/:blockId')
  async fileBlock(
    @Ctx() ctx: RequestContext,
    @Param('blockId') blockId: string,
    @Body() body: FileBlockBody,
  ): Promise<{ ok: true }> {
    await this.folders.fileBlock(ctx, blockId, body.folderId ?? null);
    return { ok: true };
  }

  /** Notes filed into this folder (permission-scoped, §15.2). */
  @Get(':id/notes')
  async notes(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BlockDto[]> {
    const blocks = await this.views.folderContents(ctx, id);
    const tags = await this.blocks.tagIdsForMany(blocks.map((b) => b.id));
    return blocks.map((b) => toBlockDto(b, tags.get(b.id) ?? []));
  }
}

function toFolderDto(f: Folder): FolderDto {
  return { id: f.id, name: f.name, parentId: f.parentId, position: f.position };
}
