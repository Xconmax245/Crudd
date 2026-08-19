/**
 * CRUDD — Observability bootstrap (Task 4)
 *
 * Initializes Sentry from environment variables.
 * Sentry is completely optional:
 *   - Missing SENTRY_DSN → SDK is a no-op stub.
 *   - Present SENTRY_DSN  → full error capture + tracing.
 *
 * Import this module BEFORE any other application code in server.ts.
 */

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0);

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
    // Never send raw SQL or DB connection strings.
    sendDefaultPii: false,
  });
}

export { Sentry };

/**
 * Capture an unexpected error in Sentry (if configured) and return the
 * event ID, or undefined when Sentry is not active.
 * Only call this for genuinely unexpected errors — not normal 4xx rejections.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): string | undefined {
  if (!dsn) return undefined;
  return Sentry.withScope((scope) => {
    if (context) scope.setContext('match', context);
    return Sentry.captureException(err);
  });
}
