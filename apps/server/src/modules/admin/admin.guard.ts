import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@zettra/shared';
import { User } from '../../entities/index';
import { CONTEXT_KEY } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';

/**
 * Admin-only gate. Runs after {@link AuthGuard} (which populates the RequestContext), then checks
 * the acting user's tenant role is `admin`. Use as `@UseGuards(AuthGuard, AdminGuard)`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(exec: ExecutionContext): Promise<boolean> {
    const req = exec.switchToHttp().getRequest<Record<string, unknown>>();
    const ctx = req[CONTEXT_KEY] as RequestContext | undefined;
    if (!ctx?.userId) throw new ForbiddenException('Admin only');
    const user = await this.users.findOne({
      where: { id: ctx.userId, tenantId: ctx.tenantId },
      select: { id: true, role: true },
    });
    if (user?.role !== UserRole.Admin) throw new ForbiddenException('Admin only');
    return true;
  }
}
