import type {
  ChallengeStatus,
  ParticipantRole,
  MatchPhase,
  LeaderboardEntry,
  QuestionEndPayload,
  MatchEndPayload,
} from '@crudd/shared';
import { redis } from './redis';

// ===========================================================================
// Redis-backed live match state.
//
// Keys per challenge:
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

// --- meta -------------------------------------------------------------------

export async function saveMeta(meta: MatchMeta): Promise<void> {
  await redis.set(k.meta(meta.challengeId), JSON.stringify(meta), 'EX', TTL_SECONDS);
}

export async function getMeta(challengeId: string): Promise<MatchMeta | null> {
  const raw = await redis.get(k.meta(challengeId));
  return raw ? (JSON.parse(raw) as MatchMeta) : null;
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
  return (await redis.exists(k.meta(challengeId))) === 1;
}

// --- players ----------------------------------------------------------------

export async function upsertPlayer(challengeId: string, player: StoredPlayer): Promise<void> {
  await redis.hset(k.players(challengeId), player.sessionId, JSON.stringify(player));
  await redis.expire(k.players(challengeId), TTL_SECONDS);
}

export async function getPlayers(challengeId: string): Promise<StoredPlayer[]> {
  const map = await redis.hgetall(k.players(challengeId));
  return Object.values(map).map((v) => JSON.parse(v) as StoredPlayer);
}

export async function setPlayerConnected(
  challengeId: string,
  sessionId: string,
  connected: boolean,
): Promise<void> {
  const raw = await redis.hget(k.players(challengeId), sessionId);
  if (!raw) return;
  const player = JSON.parse(raw) as StoredPlayer;
  player.connected = connected;
  await redis.hset(k.players(challengeId), sessionId, JSON.stringify(player));
}

export async function setPlayerRole(
  challengeId: string,
  sessionId: string,
  role: ParticipantRole,
): Promise<void> {
  const raw = await redis.hget(k.players(challengeId), sessionId);
  if (!raw) return;
  const player = JSON.parse(raw) as StoredPlayer;
  player.role = role;
  await redis.hset(k.players(challengeId), sessionId, JSON.stringify(player));
}


// --- scores -----------------------------------------------------------------

export async function incrScore(
  challengeId: string,
  sessionId: string,
  points: number,
): Promise<void> {
  if (points === 0) {
    // Ensure the field exists at 0 so the player appears on the leaderboard.
    await redis.hsetnx(k.scores(challengeId), sessionId, '0');
  } else {
    await redis.hincrby(k.scores(challengeId), sessionId, points);
  }
  await redis.expire(k.scores(challengeId), TTL_SECONDS);
}

export async function getScores(challengeId: string): Promise<Record<string, number>> {
  const map = await redis.hgetall(k.scores(challengeId));
  const out: Record<string, number> = {};
  for (const [sid, val] of Object.entries(map)) out[sid] = Number(val) || 0;
  return out;
}

// --- answers ----------------------------------------------------------------

export async function recordAnswer(
  challengeId: string,
  position: number,
  sessionId: string,
  answer: StoredAnswer,
): Promise<void> {
  await redis.hset(k.answers(challengeId, position), sessionId, JSON.stringify(answer));
  await redis.expire(k.answers(challengeId, position), TTL_SECONDS);
}

export async function hasAnswered(
  challengeId: string,
  position: number,
  sessionId: string,
): Promise<boolean> {
  return (await redis.hexists(k.answers(challengeId, position), sessionId)) === 1;
}

export async function getAnswers(
  challengeId: string,
  position: number,
): Promise<Record<string, StoredAnswer>> {
  const map = await redis.hgetall(k.answers(challengeId, position));
  const out: Record<string, StoredAnswer> = {};
  for (const [sid, val] of Object.entries(map)) out[sid] = JSON.parse(val) as StoredAnswer;
  return out;
}

export async function answerCount(challengeId: string, position: number): Promise<number> {
  return redis.hlen(k.answers(challengeId, position));
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
  const keys = [
    k.meta(challengeId),
    k.players(challengeId),
    k.scores(challengeId),
    k.reveal(challengeId),
    k.end(challengeId),
  ];
  for (let pos = 0; pos < questionCount; pos++) keys.push(k.answers(challengeId, pos));
  await Promise.all([redis.del(...keys), removeActive(challengeId)]);
}

// --- rejoin snapshots -------------------------------------------------------
// Cache the last REVEAL and the final END payloads so a client reconnecting
// during those phases can be caught up immediately (BUILD_DIRECTIVE §8/rejoin).

export async function saveRevealSnapshot(
  challengeId: string,
  payload: QuestionEndPayload,
): Promise<void> {
  await redis.set(k.reveal(challengeId), JSON.stringify(payload), 'EX', TTL_SECONDS);
}

export async function getRevealSnapshot(
  challengeId: string,
): Promise<QuestionEndPayload | null> {
  const raw = await redis.get(k.reveal(challengeId));
  return raw ? (JSON.parse(raw) as QuestionEndPayload) : null;
}

export async function saveEndSnapshot(
  challengeId: string,
  payload: MatchEndPayload,
): Promise<void> {
  await redis.set(k.end(challengeId), JSON.stringify(payload), 'EX', TTL_SECONDS);
}

export async function getEndSnapshot(challengeId: string): Promise<MatchEndPayload | null> {
  const raw = await redis.get(k.end(challengeId));
  return raw ? (JSON.parse(raw) as MatchEndPayload) : null;
}

// --- active-match index -----------------------------------------------------
// A set of challengeIds with a running match. The engine's sweeper reads this
// on each tick and after a restart to resume in-flight matches (crash recovery)
// without holding any per-question timers in process memory.

export async function markActive(challengeId: string): Promise<void> {
  await redis.sadd(ACTIVE_SET, challengeId);
}

export async function removeActive(challengeId: string): Promise<void> {
  await redis.srem(ACTIVE_SET, challengeId);
}

export async function getActiveMatchIds(): Promise<string[]> {
  return redis.smembers(ACTIVE_SET);
}


