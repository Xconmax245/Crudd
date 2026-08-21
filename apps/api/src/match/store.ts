import type {
  ChallengeStatus,
  ParticipantRole,
  MatchPhase,
  LeaderboardEntry,
  QuestionEndPayload,
  MatchEndPayload,
} from '@crudd/shared';
import { redis } from './redis';
import { logger } from '../logger';

// ===========================================================================
// Live match state — Redis-backed with a transparent in-memory fallback.
//
// Keys per challenge (Redis):
//   match:{id}:meta      -> JSON blob (structural state; host-driven writes)
//   match:{id}:players   -> hash sessionId -> JSON StoredPlayer
//   match:{id}:scores    -> hash sessionId -> integer (atomic HINCRBY)
//   match:{id}:q{pos}    -> hash sessionId -> JSON StoredAnswer
//   match:{id}:reveal    -> JSON QuestionEndPayload (last reveal, for rejoin)
//   match:{id}:end       -> JSON MatchEndPayload (final, for rejoin)
// Global index:
//   matches:active       -> set of challengeIds with a live match (sweeper input)
//
// Scores use HINCRBY so concurrent answer submissions are atomic. Answers use a
// per-field hash so simultaneous writers never clobber each other. Timers are
// NOT held in-process — the engine's sweeper derives deadlines from Redis, so a
// process restart transparently resumes any in-flight match (crash recovery).
//
// GRACEFUL DEGRADATION: if Redis is unavailable (e.g. local dev without the
// docker Redis, or a transient prod outage), every operation falls back to an
// equivalent in-process implementation so matches — and match chat — keep
// working on a single node instead of failing the JOIN handshake outright.
// (Cross-replica fan-out and crash recovery require Redis; a single node is
// fully functional on the fallback.)
// ===========================================================================

const TTL_SECONDS = 60 * 60 * 6; // 6 hours
const ACTIVE_SET = 'matches:active';

const k = {
  meta: (id: string) => `match:${id}:meta`,
  players: (id: string) => `match:${id}:players`,
  scores: (id: string) => `match:${id}:scores`,
  answers: (id: string, pos: number) => `match:${id}:q${pos}`,
  reveal: (id: string) => `match:${id}:reveal`,
  end: (id: string) => `match:${id}:end`,
};


export interface MatchMeta {
  challengeId: string;
  slug: string;
  bankTitle: string;
  hostSessionId: string;
  status: ChallengeStatus;
  phase: MatchPhase;
  questionCount: number;
  timerSeconds: number;
  maxPlayers: number;
  /** 0-based position of current question; -1 while in the lobby. */
  currentPosition: number;
  startedAt: number | null;
  endsAt: number | null;
  /** Epoch ms the STARTING countdown ends and Q0 opens; null outside STARTING. */
  countdownEndsAt: number | null;
}


export interface StoredPlayer {
  sessionId: string;
  username: string | null;
  role: ParticipantRole;
  connected: boolean;
}

export interface StoredAnswer {
  selectedIndex: number;
  responseMs: number;
  isCorrect: boolean;
  points: number;
}

// ===========================================================================
// Redis health + in-memory fallback plumbing
// ===========================================================================

/**
 * True only while a live Redis connection is confirmed usable. Starts false so
 * that until the connection is established (or if it never is) we serve from
 * memory; flips true on `ready` and back to false the moment the link drops.
 */
let redisReady = false;
/** Emit the "using in-memory fallback" warning at most once per process. */
let warnedFallback = false;

redis.on('ready', () => {
  redisReady = true;
});
for (const ev of ['end', 'close', 'error'] as const) {
  redis.on(ev, () => {
    redisReady = false;
  });
}

function redisUsable(): boolean {
  return redisReady && redis.status === 'ready';
}

function noteFallback(): void {
  if (!warnedFallback) {
    warnedFallback = true;
    logger.warn(
      'match.store using in-memory fallback — Redis unavailable. Live matches work on a single node; cross-replica fan-out & crash recovery are disabled until Redis is reachable.',
    );
  }
}

/**
 * Run `redisOp` when Redis is healthy, otherwise (or on any failure) run the
 * equivalent in-memory `memOp`. A failed Redis op marks the connection unusable
 * so we don't thrash on it every call.
 */
async function withStore<T>(redisOp: () => Promise<T>, memOp: () => T): Promise<T> {
  if (redisUsable()) {
    try {
      return await redisOp();
    } catch (err) {
      redisReady = false;
      logger.warn({ err }, 'match.store redis op failed — serving from memory');
    }
  }
  noteFallback();
  return memOp();
}

/** In-process mirror of the Redis data structures used above. */
const mem = {
  meta: new Map<string, MatchMeta>(),
  players: new Map<string, Map<string, StoredPlayer>>(),
  scores: new Map<string, Map<string, number>>(),
  answers: new Map<string, Map<string, StoredAnswer>>(), // key: `${id}:${pos}`
  reveal: new Map<string, QuestionEndPayload>(),
  end: new Map<string, MatchEndPayload>(),
  active: new Set<string>(),
};

const answerKey = (id: string, pos: number) => `${id}:${pos}`;

// --- meta -------------------------------------------------------------------

export async function saveMeta(meta: MatchMeta): Promise<void> {
  await withStore(
    async () => {
      await redis.set(k.meta(meta.challengeId), JSON.stringify(meta), 'EX', TTL_SECONDS);
    },
    () => {
      mem.meta.set(meta.challengeId, { ...meta });
    },
  );
}

export async function getMeta(challengeId: string): Promise<MatchMeta | null> {
  return withStore(
    async () => {
      const raw = await redis.get(k.meta(challengeId));
      return raw ? (JSON.parse(raw) as MatchMeta) : null;
    },
    () => {
      const m = mem.meta.get(challengeId);
      return m ? { ...m } : null;
    },
  );
}

export async function patchMeta(
  challengeId: string,
  patch: Partial<MatchMeta>,
): Promise<MatchMeta | null> {
  const current = await getMeta(challengeId);
  if (!current) return null;
  const next = { ...current, ...patch };
  await saveMeta(next);
  return next;
}

export async function metaExists(challengeId: string): Promise<boolean> {
  return withStore(
    async () => (await redis.exists(k.meta(challengeId))) === 1,
    () => mem.meta.has(challengeId),
  );
}

// --- players ----------------------------------------------------------------

export async function upsertPlayer(challengeId: string, player: StoredPlayer): Promise<void> {
  await withStore(
    async () => {
      await redis.hset(k.players(challengeId), player.sessionId, JSON.stringify(player));
      await redis.expire(k.players(challengeId), TTL_SECONDS);
    },
    () => {
      let map = mem.players.get(challengeId);
      if (!map) {
        map = new Map();
        mem.players.set(challengeId, map);
      }
      map.set(player.sessionId, { ...player });
    },
  );
}

export async function getPlayers(challengeId: string): Promise<StoredPlayer[]> {
  return withStore(
    async () => {
      const map = await redis.hgetall(k.players(challengeId));
      return Object.values(map).map((v) => JSON.parse(v) as StoredPlayer);
    },
    () => Array.from(mem.players.get(challengeId)?.values() ?? []).map((p) => ({ ...p })),
  );
}

export async function setPlayerConnected(
  challengeId: string,
  sessionId: string,
  connected: boolean,
): Promise<void> {
  await withStore(
    async () => {
      const raw = await redis.hget(k.players(challengeId), sessionId);
      if (!raw) return;
      const player = JSON.parse(raw) as StoredPlayer;
      player.connected = connected;
      await redis.hset(k.players(challengeId), sessionId, JSON.stringify(player));
    },
    () => {
      const player = mem.players.get(challengeId)?.get(sessionId);
      if (player) player.connected = connected;
    },
  );
}

export async function setPlayerRole(
  challengeId: string,
  sessionId: string,
  role: ParticipantRole,
): Promise<void> {
  await withStore(
    async () => {
      const raw = await redis.hget(k.players(challengeId), sessionId);
      if (!raw) return;
      const player = JSON.parse(raw) as StoredPlayer;
      player.role = role;
      await redis.hset(k.players(challengeId), sessionId, JSON.stringify(player));
    },
    () => {
      const player = mem.players.get(challengeId)?.get(sessionId);
      if (player) player.role = role;
    },
  );
}


// --- scores -----------------------------------------------------------------

export async function incrScore(
  challengeId: string,
  sessionId: string,
  points: number,
): Promise<void> {
  await withStore(
    async () => {
      if (points === 0) {
        // Ensure the field exists at 0 so the player appears on the leaderboard.
        await redis.hsetnx(k.scores(challengeId), sessionId, '0');
      } else {
        await redis.hincrby(k.scores(challengeId), sessionId, points);
      }
      await redis.expire(k.scores(challengeId), TTL_SECONDS);
    },
    () => {
      let map = mem.scores.get(challengeId);
      if (!map) {
        map = new Map();
        mem.scores.set(challengeId, map);
      }
      if (points === 0) {
        if (!map.has(sessionId)) map.set(sessionId, 0);
      } else {
        map.set(sessionId, (map.get(sessionId) ?? 0) + points);
      }
    },
  );
}

export async function getScores(challengeId: string): Promise<Record<string, number>> {
  return withStore(
    async () => {
      const map = await redis.hgetall(k.scores(challengeId));
      const out: Record<string, number> = {};
      for (const [sid, val] of Object.entries(map)) out[sid] = Number(val) || 0;
      return out;
    },
    () => {
      const out: Record<string, number> = {};
      for (const [sid, val] of mem.scores.get(challengeId) ?? []) out[sid] = val;
      return out;
    },
  );
}

// --- answers ----------------------------------------------------------------

export async function recordAnswer(
  challengeId: string,
  position: number,
  sessionId: string,
  answer: StoredAnswer,
): Promise<void> {
  await withStore(
    async () => {
      await redis.hset(k.answers(challengeId, position), sessionId, JSON.stringify(answer));
      await redis.expire(k.answers(challengeId, position), TTL_SECONDS);
    },
    () => {
      const key = answerKey(challengeId, position);
      let map = mem.answers.get(key);
      if (!map) {
        map = new Map();
        mem.answers.set(key, map);
      }
      map.set(sessionId, { ...answer });
    },
  );
}

export async function hasAnswered(
  challengeId: string,
  position: number,
  sessionId: string,
): Promise<boolean> {
  return withStore(
    async () => (await redis.hexists(k.answers(challengeId, position), sessionId)) === 1,
    () => mem.answers.get(answerKey(challengeId, position))?.has(sessionId) ?? false,
  );
}

export async function getAnswers(
  challengeId: string,
  position: number,
): Promise<Record<string, StoredAnswer>> {
  return withStore(
    async () => {
      const map = await redis.hgetall(k.answers(challengeId, position));
      const out: Record<string, StoredAnswer> = {};
      for (const [sid, val] of Object.entries(map)) out[sid] = JSON.parse(val) as StoredAnswer;
      return out;
    },
    () => {
      const out: Record<string, StoredAnswer> = {};
      for (const [sid, val] of mem.answers.get(answerKey(challengeId, position)) ?? []) {
        out[sid] = { ...val };
      }
      return out;
    },
  );
}

export async function answerCount(challengeId: string, position: number): Promise<number> {
  return withStore(
    async () => redis.hlen(k.answers(challengeId, position)),
    () => mem.answers.get(answerKey(challengeId, position))?.size ?? 0,
  );
}

// --- leaderboard / cleanup --------------------------------------------------

export function buildLeaderboard(
  players: StoredPlayer[],
  scores: Record<string, number>,
): LeaderboardEntry[] {
  return players
    .map((p) => ({
      sessionId: p.sessionId,
      username: p.username,
      score: scores[p.sessionId] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score || (a.username ?? '').localeCompare(b.username ?? ''))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

export async function clearMatch(challengeId: string, questionCount: number): Promise<void> {
  await withStore(
    async () => {
      const keys = [
        k.meta(challengeId),
        k.players(challengeId),
        k.scores(challengeId),
        k.reveal(challengeId),
        k.end(challengeId),
      ];
      for (let pos = 0; pos < questionCount; pos++) keys.push(k.answers(challengeId, pos));
      await Promise.all([redis.del(...keys), redis.srem(ACTIVE_SET, challengeId)]);
    },
    () => {
      mem.meta.delete(challengeId);
      mem.players.delete(challengeId);
      mem.scores.delete(challengeId);
      mem.reveal.delete(challengeId);
      mem.end.delete(challengeId);
      for (let pos = 0; pos < questionCount; pos++) mem.answers.delete(answerKey(challengeId, pos));
      mem.active.delete(challengeId);
    },
  );
}

// --- rejoin snapshots -------------------------------------------------------
// Cache the last REVEAL and the final END payloads so a client reconnecting
// during those phases can be caught up immediately (BUILD_DIRECTIVE §8/rejoin).

export async function saveRevealSnapshot(
  challengeId: string,
  payload: QuestionEndPayload,
): Promise<void> {
  await withStore(
    async () => {
      await redis.set(k.reveal(challengeId), JSON.stringify(payload), 'EX', TTL_SECONDS);
    },
    () => {
      mem.reveal.set(challengeId, payload);
    },
  );
}

export async function getRevealSnapshot(
  challengeId: string,
): Promise<QuestionEndPayload | null> {
  return withStore(
    async () => {
      const raw = await redis.get(k.reveal(challengeId));
      return raw ? (JSON.parse(raw) as QuestionEndPayload) : null;
    },
    () => mem.reveal.get(challengeId) ?? null,
  );
}

export async function saveEndSnapshot(
  challengeId: string,
  payload: MatchEndPayload,
): Promise<void> {
  await withStore(
    async () => {
      await redis.set(k.end(challengeId), JSON.stringify(payload), 'EX', TTL_SECONDS);
    },
    () => {
      mem.end.set(challengeId, payload);
    },
  );
}

export async function getEndSnapshot(challengeId: string): Promise<MatchEndPayload | null> {
  return withStore(
    async () => {
      const raw = await redis.get(k.end(challengeId));
      return raw ? (JSON.parse(raw) as MatchEndPayload) : null;
    },
    () => mem.end.get(challengeId) ?? null,
  );
}

// --- active-match index -----------------------------------------------------
// A set of challengeIds with a running match. The engine's sweeper reads this
// on each tick and after a restart to resume in-flight matches (crash recovery)
// without holding any per-question timers in process memory.

export async function markActive(challengeId: string): Promise<void> {
  await withStore(
    async () => {
      await redis.sadd(ACTIVE_SET, challengeId);
    },
    () => {
      mem.active.add(challengeId);
    },
  );
}

export async function removeActive(challengeId: string): Promise<void> {
  await withStore(
    async () => {
      await redis.srem(ACTIVE_SET, challengeId);
    },
    () => {
      mem.active.delete(challengeId);
    },
  );
}

export async function getActiveMatchIds(): Promise<string[]> {
  return withStore(
    async () => redis.smembers(ACTIVE_SET),
    () => Array.from(mem.active),
  );
}
