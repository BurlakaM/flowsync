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

  /** Undefined means "no Redis": jobs then run inside the API process. */
  get redisUrl(): string | undefined {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get appUrl(): string {
    return this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
  }

  /** Email needs a server and a sender; with only one of them it stays off. */
  get mailEnabled(): boolean {
    return Boolean(
      this.config.get('SMTP_HOST', { infer: true }) &&
      this.config.get('MAIL_FROM', { infer: true }),
    );
  }

  get mailFrom(): string | undefined {
    return this.config.get('MAIL_FROM', { infer: true });
  }

  get smtp() {
    return {
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      secure: this.config.get('SMTP_SECURE', { infer: true }),
      user: this.config.get('SMTP_USER', { infer: true }),
      password: this.config.get('SMTP_PASSWORD', { infer: true }),
    };
  }

  /** Uploads work only with a key pair; the rest of the storage settings have defaults. */
  get storageEnabled(): boolean {
    return Boolean(
      this.config.get('S3_ACCESS_KEY', { infer: true }) &&
      this.config.get('S3_SECRET_KEY', { infer: true }),
    );
  }

  get storage() {
    return {
      endpoint: this.config.get('S3_ENDPOINT', { infer: true }),
      bucket: this.config.get('S3_BUCKET', { infer: true }),
      region: this.config.get('S3_REGION', { infer: true }),
      accessKey: this.config.get('S3_ACCESS_KEY', { infer: true }),
      secretKey: this.config.get('S3_SECRET_KEY', { infer: true }),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE', { infer: true }),
    };
  }

  get bcryptRounds(): number {
    return this.config.get('BCRYPT_ROUNDS', { infer: true });
  }
}
