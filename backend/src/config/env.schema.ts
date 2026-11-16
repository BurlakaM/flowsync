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
