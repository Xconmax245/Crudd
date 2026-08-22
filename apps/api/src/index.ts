import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '@crudd/database';
import { routes } from './routes';
import { leaderboardRoutes } from './leaderboard';
import { adminRoutes } from './admin/routes';

import { attachMatchGateway, type MatchGateway } from './match/gateway';
import { redis } from './match/redis';
import { captureException } from './observability';
import { logger } from './logger';



const port = Number(process.env.PORT) || 3001;

const corsOrigins = (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
  // Always allow requests with no origin (server-to-server, curl, etc.)
  if (!origin) return cb(null, true);

  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3002',
    process.env.LANDING_URL || 'http://localhost:5173',
  ];

  // Allow localhost in development, and ANY .vercel.app domain
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const isVercel = origin.endsWith('.vercel.app');
  if (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost) || isVercel) {
    return cb(null, true);
  }
  return cb(null, false);
};

const fastify = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

let gateway: MatchGateway | null = null;
let shuttingDown = false;

/**
 * Graceful shutdown (readiness P0.1). On SIGTERM/SIGINT we stop accepting new
 * work, drain the match gateway (sweeper + sockets), then close Redis and
 * Prisma before exiting. This prevents matches being dropped on every deploy.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  const timeout = setTimeout(() => {
    fastify.log.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  try {
    if (gateway) await gateway.close(); // stop sweeper + close Socket.IO
    await fastify.close(); // stop accepting HTTP connections
    await redis.quit(); // flush + close the shared Redis connection
    await db.$disconnect(); // close Prisma / Postgres pool
    clearTimeout(timeout);
    fastify.log.info('Shutdown complete.');
    process.exit(0);
  } catch (err) {
    fastify.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

async function start() {
  await fastify.register(helmet, { contentSecurityPolicy: false });

  await fastify.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(routes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(adminRoutes);


  // Capture unexpected server errors in Sentry.
  // Client errors (4xx) are normal application flow — do not report them.
  fastify.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      captureException(error, { url: request.url, method: request.method });
      fastify.log.error({ err: error, url: request.url, method: request.method }, 'Unhandled server error');
    }
    void reply.status(statusCode).send({
      error: error.message ?? 'Internal Server Error',
      statusCode,
    });
  });


  // Attach the real-time match gateway to Fastify's underlying HTTP server.
  // Socket.IO accepts an origin function identical to fastify/cors.
  gateway = attachMatchGateway(fastify.server, corsOrigins as any);

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`API + match gateway running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureException(reason);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  captureException(err);
  process.exit(1);
});

start();
