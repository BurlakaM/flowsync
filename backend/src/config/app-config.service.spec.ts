import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import type { Env } from './env.schema';

function createService(values: Partial<Env>): AppConfigService {
  const config = { get: (key: keyof Env) => values[key] };
  return new AppConfigService(config as unknown as ConfigService<Env, true>);
}

describe('AppConfigService', () => {
  describe('corsOrigins', () => {
    it('falls back to the local frontends when nothing is configured', () => {
      expect(createService({}).corsOrigins).toContain('http://localhost:8080');
      expect(createService({ CORS_ORIGINS: ' , ' }).corsOrigins).toContain(
        'http://localhost:3001',
      );
    });

    it('splits and trims a comma-separated list', () => {
      const service = createService({
        CORS_ORIGINS: 'https://a.example , https://b.example',
      });
      expect(service.corsOrigins).toEqual([
        'https://a.example',
        'https://b.example',
      ]);
    });
  });

  it('derives the environment flags from NODE_ENV', () => {
    expect(createService({ NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(createService({ NODE_ENV: 'test' }).isTest).toBe(true);
    expect(createService({ NODE_ENV: 'development' }).isDevelopment).toBe(true);
    expect(createService({ NODE_ENV: 'test' }).isProduction).toBe(false);
  });
});
