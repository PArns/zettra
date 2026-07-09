import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Allow, IsString } from 'class-validator';
import { DocBlock } from '@zettra/shared';
import { InternalGuard } from '../../common/internal.guard';
import { MaterializeService } from './materialize.service';

class MaterializeBody {
  @IsString() tenantId!: string;
  @Allow() doc!: DocBlock[];
}

/**
 * Internal endpoint invoked by the collab persistence hook after a Yjs document settles
 * (§8.7). Not publicly routed (§13.1); guarded by the internal shared secret.
 */
@Controller('internal/sync')
@UseGuards(InternalGuard)
export class SyncController {
  constructor(private readonly materialize: MaterializeService) {}

  @Post(':blockId')
  async run(
    @Param('blockId') blockId: string,
    @Body() body: MaterializeBody,
  ): Promise<{ ok: true }> {
    await this.materialize.materialize(body.tenantId, blockId, body.doc);
    return { ok: true };
  }

  /**
   * Content projection for the collab persistence hook to rebuild the Yjs doc on load (§8.7).
   * Tenant-scoped so a doc load can't read another tenant's block.
   */
  @Get(':blockId')
  async load(
    @Param('blockId') blockId: string,
    @Query('tenantId') tenantId: string,
  ): Promise<{ doc: DocBlock[] }> {
    return { doc: await this.materialize.getDoc(tenantId, blockId) };
  }
}
