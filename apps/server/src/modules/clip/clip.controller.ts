import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { BlockDto } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { ClipService } from './clip.service';

class ClipBody {
  @IsString() @MinLength(4) url!: string;
}

/** Web clipper (§8.3): POST a URL, get back the clipped article as a block. */
@Controller('clip')
@UseGuards(AuthGuard)
export class ClipController {
  constructor(private readonly clip: ClipService) {}

  @Post()
  clipUrl(@Ctx() ctx: RequestContext, @Body() body: ClipBody): Promise<BlockDto> {
    return this.clip.clip(ctx, body.url);
  }
}
