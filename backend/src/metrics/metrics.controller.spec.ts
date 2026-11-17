import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

const res = { setHeader: vi.fn() } as unknown as Response;
const controller = (token?: string) =>
  new MetricsController(new MetricsService(), {
    metricsToken: token,
  } as AppConfigService);

describe('MetricsController', () => {
  it('serves metrics freely when no token is configured', async () => {
    await expect(controller().scrape(undefined, res)).resolves.toContain(
      'process_cpu',
    );
  });

  it('serves metrics for the right bearer token', async () => {
    const token = 'a-long-enough-token';

    await expect(
      controller(token).scrape(`Bearer ${token}`, res),
    ).resolves.toContain('process_cpu');
  });

  it.each([undefined, 'Bearer wrong-token-of-same!', 'Bearer short'])(
    'rejects %s when a token is configured',
    async (header) => {
      await expect(
        controller('a-long-enough-token').scrape(header, res),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});
