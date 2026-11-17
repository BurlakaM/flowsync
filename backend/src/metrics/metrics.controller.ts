import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/app-config.service';
import { MetricsService } from './metrics.service';

/**
 * Public for the JWT guard because Prometheus has no user token. Access is limited differently:
 * the proxy never forwards /api/metrics to the internet (nginx returns 404), Prometheus scrapes the
 * backend inside the Docker network, and METRICS_TOKEN adds a bearer check when it is set.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    this.assertAllowed(authorization);
    res.setHeader('Content-Type', this.metrics.registry.contentType);
    return this.metrics.registry.metrics();
  }

  private assertAllowed(authorization: string | undefined): void {
    const token = this.config.metricsToken;
    if (!token) return;

    const given = Buffer.from(authorization?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(token);
    // Constant-time comparison: the token must not leak through response timing.
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
  }
}
