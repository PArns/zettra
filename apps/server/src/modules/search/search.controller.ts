import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { SearchHit, SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Hybrid (dense + full-text) global search, permission-scoped (§11, §15.2). */
  @Get()
  run(@Ctx() ctx: RequestContext, @Query('q') q: string): Promise<SearchHit[]> {
    return this.search.search(ctx, q ?? '');
  }
}
