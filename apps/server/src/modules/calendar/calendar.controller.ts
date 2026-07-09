import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { Agenda, CalendarService } from './calendar.service';

class AgendaQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}

/** Calendar surface (§3). Permission-scoped in the service (invariant 11). */
@Controller('calendar')
@UseGuards(AuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('agenda')
  agenda(@Ctx() ctx: RequestContext, @Query() q: AgendaQuery): Promise<Agenda> {
    return this.calendar.agenda(ctx, q.from, q.to);
  }
}
