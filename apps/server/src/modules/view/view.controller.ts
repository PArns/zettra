import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ViewFilter, ViewLayout, ViewSort } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { BlockDto, TodoItemDto } from '@zettra/shared';
import { ViewData, ViewService } from './view.service';
import { Block, View } from '../../entities/index';
import { BlockService } from '../block/block.service';
import { toBlockDto } from '../../common/block-dto';

class CreateTodoBody {
  @IsString() @MinLength(1) title!: string;
}

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
  constructor(
    private readonly views: ViewService,
    private readonly blocks: BlockService,
  ) {}

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
  async inbox(@Ctx() ctx: RequestContext): Promise<BlockDto[]> {
    const blocks = await this.views.inbox(ctx);
    const tags = await this.blocks.tagIdsForMany(blocks.map((b) => b.id));
    return blocks.map((b) => toBlockDto(b, tags.get(b.id) ?? []));
  }

  /** The "For Review" bucket — the acting user's captures awaiting triage (§8.3). */
  @Get('for-review')
  async forReview(@Ctx() ctx: RequestContext): Promise<BlockDto[]> {
    const blocks = await this.views.forReview(ctx);
    const tags = await this.blocks.tagIdsForMany(blocks.map((b) => b.id));
    return blocks.map((b) => toBlockDto(b, tags.get(b.id) ?? []));
  }

  /** The global #todo list — every #todo note with due date, follow-up, and status (§4). */
  @Get('todos')
  todos(@Ctx() ctx: RequestContext): Promise<TodoItemDto[]> {
    return this.views.todos(ctx);
  }

  /** Quick-add a #todo from the global list (title only; lands undated in "Later"). */
  @Post('todos')
  createTodo(@Ctx() ctx: RequestContext, @Body() body: CreateTodoBody): Promise<TodoItemDto> {
    return this.views.createTodo(ctx, body.title);
  }

  /** Toggle a #todo note's status (done-checkbox in the global list). */
  @Post('todos/:blockId/status')
  async setTodoStatus(
    @Ctx() ctx: RequestContext,
    @Param('blockId') blockId: string,
    @Body() body: { status: string },
  ): Promise<{ ok: true }> {
    await this.views.setTodoStatus(ctx, blockId, body.status);
    return { ok: true };
  }

  /** The Today feed — everything the acting user can see that was created or updated today (§6). */
  @Get('today-items')
  async todayItems(@Ctx() ctx: RequestContext): Promise<BlockDto[]> {
    const blocks = await this.views.todayItems(ctx);
    const tags = await this.blocks.tagIdsForMany(blocks.map((b) => b.id));
    return blocks.map((b) => toBlockDto(b, tags.get(b.id) ?? []));
  }

  /** Entities carrying a supertag — the option list for a `relation`-typed field picker. */
  @Get('tag/:tagId/entities')
  entities(
    @Ctx() ctx: RequestContext,
    @Param('tagId') tagId: string,
  ): Promise<{ blockId: string; title: string }[]> {
    return this.views.entitiesForTag(ctx, tagId);
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
