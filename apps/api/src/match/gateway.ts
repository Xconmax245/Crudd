import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  MATCH_EVENTS,
  type JoinPayload,
  type SubmitAnswerPayload,
  type MatchErrorPayload,
} from '@crudd/shared';
import { MatchEngine, MatchEngineError } from './engine';
import { redis } from './redis';
import { logger } from '../logger';
import { captureException } from '../observability';

interface SocketData {
  challengeId?: string;
  sessionId?: string;
  /** Sliding-window timestamps (ms) of recent inbound events for rate limiting. */
  events?: number[];
}

/** Simple per-socket sliding-window rate limit (readiness P2). */
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 5;

function room(challengeId: string) {
  return `match:${challengeId}`;
}

function emitError(socket: Socket, err: unknown) {
  const data = socket.data as SocketData;
  const isEngineError = err instanceof MatchEngineError;

  if (isEngineError) {
    // Known rejection — log at debug level only (e.g. rate limits, late answers)
    logger.debug(
      { matchId: data.challengeId, sessionId: data.sessionId, code: err.code, msg: err.message },
      'match.event_rejected',
    );
  } else {
    // Unexpected — log as error and capture in Sentry
    logger.error(
      { err, matchId: data.challengeId, sessionId: data.sessionId },
      'match.unexpected_gateway_error',
    );
    captureException(err, { matchId: data.challengeId, sessionId: data.sessionId });
  }

  const payload: MatchErrorPayload =
    isEngineError
      ? { message: err.message, code: err.code }
      : { message: 'Something went wrong', code: 'INTERNAL' };
  socket.emit(MATCH_EVENTS.ERROR, payload);
}

/** Returns true if the socket is within its rate budget; false if it should be dropped. */
function withinRateLimit(socket: Socket): boolean {
  const data = socket.data as SocketData;
  const now = Date.now();
  const events = (data.events ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  events.push(now);
  data.events = events;
  return events.length <= RATE_LIMIT_MAX;
}

export interface MatchGateway {
  io: Server;
  engine: MatchEngine;
  /** Gracefully tear down the gateway (sweeper + socket server). */
  close: () => Promise<void>;
}

/**
 * Attach the Socket.IO match gateway to an existing HTTP server.
 * All authoritative logic lives in MatchEngine; this layer only validates
 * inbound payloads, manages room membership, relays errors, and enforces a
 * basic per-socket rate limit.
 *
 * A Redis adapter is attached so match broadcasts fan out correctly across
 * multiple API replicas (readiness P0.4). Match *timing* is owned by the
 * engine's Redis-backed sweeper, so combined with sticky-session routing the
 * system tolerates horizontal scaling and process restarts.
 */
export function attachMatchGateway(httpServer: HttpServer, corsOrigins: string[]): MatchGateway {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    path: '/socket.io',
  });

  // Cross-replica broadcast fan-out. Uses a duplicated connection for the
  // subscriber side as required by the Redis adapter.
  const subClient = redis.duplicate();
  subClient.on('error', (err) => {
    logger.error({ err: { message: err.message } }, 'redis.subclient_error');
  });
  // Prevent unhandled exception when Redis is unreachable and retryStrategy gives up
  subClient.on('close', () => {
    logger.warn('redis.subclient_closed');
  });
  io.adapter(createAdapter(redis, subClient));

  const engine = new MatchEngine(io);

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    data.events = [];

    socket.on(MATCH_EVENTS.JOIN, async (payload: JoinPayload) => {
      try {
        if (!withinRateLimit(socket)) {
          throw new MatchEngineError('Slow down', 'RATE_LIMITED');
        }
        if (!payload?.slug || !payload?.sessionId) {
          throw new MatchEngineError('Invalid join payload', 'BAD_REQUEST');
        }
        const meta = await engine.ensureLobby(payload.slug);
        await engine.join(meta.challengeId, payload.sessionId, payload.username ?? null);

        data.challengeId = meta.challengeId;
        data.sessionId = payload.sessionId;
        await socket.join(room(meta.challengeId));

        logger.info(
          { matchId: meta.challengeId, sessionId: payload.sessionId },
          'match.joined',
        );

        await engine.broadcastLobby(meta.challengeId);

        // Catch a (re)joining client up to the exact live phase: an open
        // question, the last reveal, or the final results (readiness P1.4).
        const snapshot = await engine.rejoinSnapshot(meta.challengeId);
        if (snapshot?.kind === 'countdown') {
          socket.emit(MATCH_EVENTS.COUNTDOWN, snapshot.payload);
          logger.debug({ matchId: meta.challengeId, sessionId: payload.sessionId }, 'match.rejoined — countdown');
        } else if (snapshot?.kind === 'question') {
          socket.emit(MATCH_EVENTS.QUESTION_START, snapshot.payload);
          logger.debug({ matchId: meta.challengeId, sessionId: payload.sessionId }, 'match.rejoined — question');
        } else if (snapshot?.kind === 'reveal') {
          socket.emit(MATCH_EVENTS.QUESTION_END, snapshot.payload);
          logger.debug({ matchId: meta.challengeId, sessionId: payload.sessionId }, 'match.rejoined — reveal');
        } else if (snapshot?.kind === 'end') {
          socket.emit(MATCH_EVENTS.MATCH_END, snapshot.payload);
          logger.debug({ matchId: meta.challengeId, sessionId: payload.sessionId }, 'match.rejoined — ended');
        }
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(MATCH_EVENTS.START, async () => {
      try {
        if (!withinRateLimit(socket)) {
          throw new MatchEngineError('Slow down', 'RATE_LIMITED');
        }
        if (!data.challengeId || !data.sessionId) {
          throw new MatchEngineError('Join a lobby first', 'BAD_REQUEST');
        }
        await engine.startMatch(data.challengeId, data.sessionId);
        logger.info({ matchId: data.challengeId, sessionId: data.sessionId }, 'match.started');
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(MATCH_EVENTS.SUBMIT, async (payload: SubmitAnswerPayload) => {
      try {
        if (!withinRateLimit(socket)) {
          throw new MatchEngineError('Slow down', 'RATE_LIMITED');
        }
        if (!data.challengeId || !data.sessionId) {
          throw new MatchEngineError('Join a lobby first', 'BAD_REQUEST');
        }
        if (
          typeof payload?.position !== 'number' ||
          typeof payload?.selectedIndex !== 'number'
        ) {
          throw new MatchEngineError('Invalid answer payload', 'BAD_REQUEST');
        }
        const result = await engine.submitAnswer(
          data.challengeId,
          data.sessionId,
          payload.position,
          payload.selectedIndex,
        );
        // Log submission without the selectedIndex value (don't expose answer choices)
        logger.debug(
          { matchId: data.challengeId, sessionId: data.sessionId, position: payload.position, accepted: result.accepted },
          'match.answer_submitted',
        );
        socket.emit(MATCH_EVENTS.ANSWER_ACK, {
          position: payload.position,
          accepted: result.accepted,
          selectedIndex: result.selectedIndex,
        });
      } catch (err) {
        if (err instanceof MatchEngineError) {
          logger.debug(
            { matchId: data.challengeId, sessionId: data.sessionId, position: payload?.position, code: err.code },
            'match.answer_rejected',
          );
          socket.emit(MATCH_EVENTS.ANSWER_ACK, {
            position: payload?.position ?? -1,
            accepted: false,
            selectedIndex: payload?.selectedIndex ?? -1,
            reason: err.message,
          });
        } else {
          emitError(socket, err);
        }
      }
    });

    socket.on(MATCH_EVENTS.NEXT, async () => {
      try {
        if (!withinRateLimit(socket)) {
          throw new MatchEngineError('Slow down', 'RATE_LIMITED');
        }
        if (!data.challengeId || !data.sessionId) {
          throw new MatchEngineError('Join a lobby first', 'BAD_REQUEST');
        }
        await engine.advance(data.challengeId, data.sessionId);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on('disconnect', async () => {
      try {
        if (data.challengeId && data.sessionId) {
          logger.debug({ matchId: data.challengeId, sessionId: data.sessionId }, 'match.player_disconnected');
          await engine.markDisconnected(data.challengeId, data.sessionId);
        }
      } catch {
        // best-effort cleanup; nothing to surface to a departed client
      }
    });
  });

  const close = async (): Promise<void> => {
    engine.stop();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    subClient.disconnect();
  };

  return { io, engine, close };
}
