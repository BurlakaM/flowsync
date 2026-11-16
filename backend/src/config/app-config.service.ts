import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

// Used when CORS_ORIGINS is not set: the local frontends (docker, CRA, Vite).
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:3001',
  'http://localhost:5173',
];

/** Typed access to the validated environment. Use it instead of process.env / ConfigService. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  get jwtExpiresIn(): string {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }

  get refreshTokenTtlMs(): number {
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return days * 24 * 60 * 60 * 1000;
  }

  get cookieSecure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }

  get corsOrigins(): string[] {
    const raw = this.config.get('CORS_ORIGINS', { infer: true });
    const origins = raw
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return origins?.length ? origins : DEFAULT_CORS_ORIGINS;
  }

  get trustProxy(): number {
    return this.config.get('TRUST_PROXY', { infer: true });
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get bcryptRounds(): number {
    return this.config.get('BCRYPT_ROUNDS', { infer: true });
  }
}
