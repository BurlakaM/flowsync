import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { RedisHealthIndicator } from './redis.health';

// Public and unthrottled: used by Docker, the proxy and monitoring, none of which has a token.
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  /**
   * Liveness: the process is up and the event loop answers. It checks no dependency on purpose,
   * otherwise a database outage would make the orchestrator restart a healthy API in a loop.
   */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness: the API can serve traffic, i.e. its dependencies answer. A failure returns 503 so
   * a proxy stops sending requests without restarting the container. `GET /health` is the same
   * check, kept for the existing Docker healthchecks.
   */
  @Get(['', 'ready'])
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      ...(this.redisHealth.enabled
        ? [() => this.redisHealth.isHealthy('redis')]
        : []),
    ]);
  }
}
