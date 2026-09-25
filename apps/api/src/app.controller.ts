import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cloud Run liveness probe — just proves the process is up. */
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Cloud Run liveness probe alias. */
  @Public()
  @Get('healthz')
  healthz() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Cloud Run readiness probe — proves the DB is reachable before accepting traffic.
   * Returns 503 if the DB query fails so Cloud Run withholds traffic to this instance.
   */
  @Public()
  @Get('readyz')
  async readyz() {
    try {
      // Fast round-trip: SELECT 1 via Prisma's underlying connection.
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        checks: { database: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        checks: { database: 'error' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
