import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { loadConfig } from '../config/configuration';

/**
 * Guards internal service-to-service endpoints (e.g. the collab persistence hook calling the
 * sync endpoint). Checks a shared secret header. These endpoints are never exposed publicly
 * by nginx (§13.1) — this is defense-in-depth.
 */
@Injectable()
export class InternalGuard implements CanActivate {
  private readonly secret = loadConfig().appSecret;

  canActivate(exec: ExecutionContext): boolean {
    const req = exec.switchToHttp().getRequest<Record<string, unknown>>();
    const header = (req['headers'] as Record<string, string | undefined>)?.['x-internal-secret'];
    if (header !== this.secret) throw new UnauthorizedException('Invalid internal secret');
    return true;
  }
}
