import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Allow, IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { FieldValueService } from './field-value.service';
import { FieldValue } from '../../entities/index';

class SetFieldBody {
  @IsString() fieldId!: string;
  // Arbitrary-typed value; @Allow keeps it past the whitelisting ValidationPipe.
  @Allow() value!: unknown;
}

@Controller('blocks/:blockId/fields')
@UseGuards(AuthGuard)
export class FieldValueController {
  constructor(private readonly fieldValues: FieldValueService) {}

  @Get()
  list(@Ctx() ctx: RequestContext, @Param('blockId') blockId: string): Promise<FieldValue[]> {
    return this.fieldValues.listForBlock(ctx.tenantId, blockId);
  }

  @Put()
  set(
    @Ctx() ctx: RequestContext,
    @Param('blockId') blockId: string,
    @Body() body: SetFieldBody,
  ): Promise<FieldValue> {
    return this.fieldValues.set(ctx.tenantId, blockId, body.fieldId, body.value, ctx.userId);
  }
}
