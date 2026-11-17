import * as Sentry from '@sentry/react';

let enabled = false;

/**
 * Starts error reporting when a DSN is configured. Errors only: no tracing and no session replay,
 * both of which record what the user does and would need a privacy review first.
 */
export function initMonitoring(dsn: string | undefined, environment: string) {
  if (!dsn || enabled) return;
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  enabled = true;
}

/** Safe to call anywhere: it does nothing while monitoring is off. */
export function reportError(error: unknown) {
  if (enabled) Sentry.captureException(error);
}
