import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ViewFilter, ViewLayout, ViewSort } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { ViewData, ViewService } from './view.service';
import { Block, View } from '../../entities/index';

class CreateViewBody {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsUUID() spaceId?: string;
  @IsOptional() @IsUUID() tagId?: string;
  @IsOptional() @IsEnum(ViewLayout) layout?: ViewLayout;
  @IsOptional() @IsArray() filters?: ViewFilter[];
  @IsOptional() @IsArray() sorts?: ViewSort[];
  @IsOptional() @IsUUID() groupBy?: string;
}

@Controller('views')
@UseGuards(AuthGuard)
export class ViewController {
  constructor(private readonly views: ViewService) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<View[]> {
    return this.views.list(ctx);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() body: CreateViewBody): Promise<View> {
    return this.views.create(ctx, body);
  }

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: Partial<CreateViewBody>,
  ): Promise<View> {
    return this.views.update(ctx, id, body);
  }

  @Delete(':id')
  async remove(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ ok: true }> {
    await this.views.remove(ctx, id);
    return { ok: true };
  }

  /** The Briefkasten — untagged blocks owned by the acting user (§8.2). */
  @Get('inbox')
  inbox(@Ctx() ctx: RequestContext): Promise<Block[]> {
    return this.views.inbox(ctx);
  }

  @Get(':id/rows')
  run(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<Block[]> {
    return this.views.run(ctx, id);
  }

  /** Full render payload: view + effective fields + rows with field values. */
  @Get(':id/data')
  data(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<ViewData> {
    return this.views.data(ctx, id);
  }
}
