import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CONTEXT_KEY } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { PermissionsService } from '../membership/permissions.service';

export interface JwtPayload {
  sub: string; // userId
  tid: string; // tenantId
}

/**
 * Authenticates via Bearer JWT and builds the permission-scoped RequestContext, resolving
 * `visibleSpaceIds` once per request (§15.2) so downstream reads scope at the query layer.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(exec: ExecutionContext): Promise<boolean> {
    const req = exec.switchToHttp().getRequest<Record<string, unknown>>();
    const header = (req['headers'] as Record<string, string | undefined>)?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(header.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const visibleSpaceIds = await this.permissions.visibleSpaceIds(payload.tid, payload.sub);
    const ctx: RequestContext = { tenantId: payload.tid, userId: payload.sub, visibleSpaceIds };
    req[CONTEXT_KEY] = ctx;
    return true;
  }
}
