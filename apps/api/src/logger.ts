/**
 * CRUDD — Structured logger (Task 4)
 *
 * Shared Pino logger for code outside the Fastify request lifecycle
 * (match engine, gateway, redis, sweeper).
 *
 * Levels:
 *   production → info+
 *   development → debug+
 *   test/vitest → silent (no noise during vitest runs)
 *
 * NEVER log (auto-redacted):
 *   DATABASE_URL, DIRECT_URL, REDIS_URL, SENTRY_DSN,
 *   password, secret, token, authorization, cookie
 */
import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

export const logger = pino({
  level: isTest
    ? 'silent'
    : (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')),
  redact: {
    paths: [
      'DATABASE_URL', 'DIRECT_URL', 'REDIS_URL', 'SENTRY_DSN',
      'password', 'secret', 'token', 'authorization', 'cookie',
    ],
    censor: '[REDACTED]',
  },
});
