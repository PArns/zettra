import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RequestContext } from './request-context';

export const CONTEXT_KEY = 'zettraContext';

/**
 * Injects the request's {@link RequestContext} (tenantId, userId, visibleSpaceIds) into a
 * controller handler. Populated by AuthGuard; throws if the route was not guarded.
 */
export const Ctx = createParamDecorator(
  (_data: unknown, exec: ExecutionContext): RequestContext => {
    const req = exec.switchToHttp().getRequest<Record<string, unknown>>();
    const ctx = req[CONTEXT_KEY] as RequestContext | undefined;
    if (!ctx) throw new UnauthorizedException('Missing request context');
    return ctx;
  },
);
