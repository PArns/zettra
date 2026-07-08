import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Liveness/readiness (§10 phase 1). `web`/compose healthchecks hit `/api/health`. */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async health(): Promise<{ status: string; db: boolean }> {
    let db = false;
    try {
      await this.dataSource.query('SELECT 1');
      db = true;
    } catch {
      db = false;
    }
    return { status: db ? 'ok' : 'degraded', db };
  }
}
