import { z } from 'zod';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

/** `SMTP_HOST=` (an empty value in .env) means "not set", not "set to nothing". */
const blankIsUnset = (value: unknown) => (value === '' ? undefined : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankIsUnset, schema.optional());

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a PostgreSQL connection URL'),
    JWT_SECRET: z.string().min(1, 'must not be empty'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'use a duration such as 15m, 1h or 7d')
      .default('15m'),
    /** How long a refresh token (and the session behind it) lives. */
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    /** Marks the refresh cookie Secure (sent only over HTTPS). Keep false for http://localhost. */
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** Comma-separated list of allowed origins. Empty means the local frontends. */
    CORS_ORIGINS: z.string().optional(),
    /** Number of reverse proxies in front of the app (nginx = 1); needed for the client IP. */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    /** bcrypt cost: higher is slower and safer. Tests use the minimum. */
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
    /** Redis for the job queue. Without it jobs run inside the API process: no retries, lost on restart. */
    REDIS_URL: optional(
      z.string().regex(/^rediss?:\/\//, 'must be a Redis URL (redis://...)'),
    ),
    /** How often the outbox relay looks for undelivered events, in ms. 0 switches the loop off (tests). */
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(0).default(2000),
    /** When set, GET /api/metrics requires `Authorization: Bearer <token>`. */
    METRICS_TOKEN: optional(z.string().min(16)),
    /** Error reporting. Without a DSN Sentry stays completely off. */
    SENTRY_DSN: optional(z.url()),
    /** Public address of the frontend: the links in emails point there. */
    APP_URL: z.preprocess(
      blankIsUnset,
      z.url().default('http://localhost:5173'),
    ),
    /**
     * Email is switched on by SMTP_HOST and MAIL_FROM together. Without them nothing is ever sent,
     * and nothing fails: notifications still appear in the application.
     */
    SMTP_HOST: optional(z.string().min(1)),
    SMTP_PORT: z.preprocess(
      blankIsUnset,
      z.coerce.number().int().min(1).max(65535).default(587),
    ),
    /** true = TLS from the first byte (usually port 465); false = plain or STARTTLS (587, 25, 1025). */
    SMTP_SECURE: z.preprocess(
      blankIsUnset,
      z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    ),
    SMTP_USER: optional(z.string()),
    SMTP_PASSWORD: optional(z.string()),
    /** The sender, e.g. `FlowSync <noreply@example.com>`. */
    MAIL_FROM: optional(z.string().min(3)),
    /**
     * File storage (project pictures) on any S3-compatible service: AWS S3, MinIO, Cloudflare R2 and so on.
     * Uploads are switched on by S3_ACCESS_KEY and S3_SECRET_KEY together; without them the rest of the
     * application works and uploading answers 503.
     */
    S3_ENDPOINT: optional(z.url()),
    S3_BUCKET: z.preprocess(
      blankIsUnset,
      z.string().min(3).default('flowsync'),
    ),
    S3_REGION: z.preprocess(blankIsUnset, z.string().default('us-east-1')),
    S3_ACCESS_KEY: optional(z.string().min(1)),
    S3_SECRET_KEY: optional(z.string().min(1)),
    /** MinIO and most self-hosted servers need path-style addresses (host/bucket/key); AWS accepts both. */
    S3_FORCE_PATH_STYLE: z.preprocess(
      blankIsUnset,
      z
        .enum(['true', 'false'])
        .default('true')
        .transform((value) => value === 'true'),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'must be at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule: the application refuses to start when the environment is invalid. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return result.data;
}
