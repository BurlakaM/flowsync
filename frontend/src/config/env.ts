import { z } from 'zod';

const envSchema = z.object({
  /** Base URL of the API. `/api` works everywhere: nginx in production, the Vite proxy in development. */
  VITE_API_URL: z.string().min(1).default('/api'),
  /** Error reporting. Without a DSN nothing is initialised and nothing leaves the browser. */
  VITE_SENTRY_DSN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.url().optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Throws a readable error when a variable is invalid; unknown variables are dropped. */
export function parseEnv(raw: Record<string, unknown>): Env {
  return envSchema.parse(raw);
}

export const env = parseEnv(import.meta.env);
