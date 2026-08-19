import Redis from 'ioredis';
import { logger } from '../logger';

// Single shared Redis connection for the live match layer.
// Live match state (§9/§10 of BUILD_DIRECTIVE) lives here; `match_answers` is
// the durable write-behind log flushed to Postgres per question.
const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(url, {
  maxRetriesPerRequest: null,
  // Exponential back-off capped at 2 s; give up after 3 attempts so
  // browse/admin traffic remains unaffected when Redis is unavailable locally.
  retryStrategy: (times: number) => {
    if (times > 3) return null; // stop retrying
    return Math.min(times * 500, 2000);
  },
  reconnectOnError: () => false,
  // Lazy connect prevents the flushQueue exception when retryStrategy returns
  // null before any command is issued.
  lazyConnect: true,
  // Production-safe timeouts
  connectTimeout: 5000,
  commandTimeout: 3000,
});

redis.on('error', (err) => {
  logger.error({ err: { message: err.message, code: (err as NodeJS.ErrnoException).code } }, 'redis.connection_error');
});

// ioredis emits 'close' when retryStrategy returns null.  Without this
// listener any pending commands surface as unhandled exceptions.
redis.on('close', () => {
  logger.warn('redis.connection_closed — live match features unavailable');
});

redis.on('connect', () => {
  logger.info('redis.connected');
});

redis.on('reconnecting', (delay: number) => {
  logger.debug({ delay }, 'redis.reconnecting');
});
