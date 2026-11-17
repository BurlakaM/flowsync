import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import IORedis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

/**
 * Redis is optional (D30): without REDIS_URL mail goes through the API process, so the check
 * is skipped instead of reporting a dependency the deployment does not have.
 */
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private client?: IORedis;

  constructor(
    private readonly config: AppConfigService,
    private readonly indicators: HealthIndicatorService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.redisUrl);
  }

  async isHealthy(key: string) {
    const indicator = this.indicators.check(key);
    try {
      await this.connection().ping();
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Redis is unreachable' });
    }
  }

  async onModuleDestroy() {
    this.client?.disconnect();
  }

  private connection(): IORedis {
    // One shared connection that fails fast: a readiness probe must answer, not wait for retries.
    this.client ??= new IORedis(this.config.redisUrl as string, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    return this.client;
  }
}
