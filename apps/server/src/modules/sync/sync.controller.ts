import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DocBlock } from '@zettra/shared';
import { InternalGuard } from '../../common/internal.guard';
import { MaterializeService } from './materialize.service';

class MaterializeBody {
  tenantId!: string;
  doc!: DocBlock[];
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
}
