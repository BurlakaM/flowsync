import { HealthIndicatorService } from '@nestjs/terminus';
import { AppConfigService } from '../config/app-config.service';
import { RedisHealthIndicator } from './redis.health';

const config = (redisUrl?: string) =>
  ({ redisUrl }) as unknown as AppConfigService;
const indicators = new HealthIndicatorService();

describe('RedisHealthIndicator', () => {
  it('is disabled without REDIS_URL, so readiness skips Redis', () => {
    expect(new RedisHealthIndicator(config(), indicators).enabled).toBe(false);
  });

  it('is enabled when REDIS_URL is set', () => {
    const indicator = new RedisHealthIndicator(
      config('redis://localhost:6379'),
      indicators,
    );
    expect(indicator.enabled).toBe(true);
  });

  it('reports down instead of throwing when Redis is unreachable', async () => {
    // Port 1 refuses connections, so the ping fails fast.
    const indicator = new RedisHealthIndicator(
      config('redis://127.0.0.1:1'),
      indicators,
    );

    const result = await indicator.isHealthy('redis');

    expect(result.redis.status).toBe('down');
    await indicator.onModuleDestroy();
  });
});
