import type { Server } from 'socket.io';
import { db } from '@crudd/database';
import { calculateScore } from '@crudd/scoring';
import {
  MATCH_EVENTS,
  type LobbyStatePayload,
  type QuestionStartPayload,
  type QuestionEndPayload,
  type MatchEndPayload,
  type PlayerQuestionResult,
  type PlayerMatchStats,
  type CountdownPayload,
  type LobbyCancelledPayload,
} from '@crudd/shared';
import {
  saveMeta,
  getMeta,
  patchMeta,
  metaExists,
  upsertPlayer,
  getPlayers,
  setPlayerConnected,
  setPlayerRole,
  incrScore,
  getScores,
  recordAnswer,
  hasAnswered,
  getAnswers,
  answerCount,
  buildLeaderboard,
  saveRevealSnapshot,
  getRevealSnapshot,
  saveEndSnapshot,
  getEndSnapshot,
  markActive,
  removeActive,
  getActiveMatchIds,
  clearMatch,
  type MatchMeta,
  type StoredPlayer,
} from './store';
import { logger } from '../logger';
import { captureException } from '../observability';

/** 3-2-1-Go countdown length before the first question (BUILD_DIRECTIVE §7.8/§9). */
const COUNTDOWN_MS = 3000;
/** Sweeper cadence — how often the server checks for elapsed deadlines. */
const SWEEP_INTERVAL_MS = 500;

interface LoadedQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctIndex: number;
}

export class MatchEngineError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

/**
 * Server-authoritative match engine (BUILD_DIRECTIVE §9/§10).
 * - The server owns all timing; clients render broadcast state only.
 * - The correct answer is never sent before a question resolves.
 * - Live state lives in Redis; `match_answers` is the durable write-behind log.
 *
 * Timing is NOT held in in-process timers. Instead a single sweeper loop derives
 * deadlines from Redis (`meta.countdownEndsAt` / `meta.endsAt`). This makes the
 * engine stateless across restarts: an interrupted match is transparently
 * resumed from Redis (crash recovery), and it can run behind sticky-session
 * routing without losing matches to a `setTimeout` bound to a dead process.
 */
export class MatchEngine {
  private io: Server;
  /** Per-challenge question cache (rebuilt lazily from the DB when missing). */
  private questionCache = new Map<string, LoadedQuestion[]>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;
  private activeMatches = new Set<string>();
  private lastFullSync = 0;

  constructor(io: Server) {
    this.io = io;
    this.startSweeper();
  }

  private room(challengeId: string) {
    return `match:${challengeId}`;
  }

  // --- sweeper (authoritative timing) -------------------------------------

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      void this.sweep();
    }, SWEEP_INTERVAL_MS);
    // Do not keep the event loop alive solely for the sweeper.
    this.sweeper.unref?.();
  }

  /** Stop the sweeper (used on graceful shutdown). */
  stop(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }

  /**
   * One sweeper tick: advance any match whose server-side deadline has elapsed.
   * Reads the active-match index from Redis so it also picks up matches started
   * before a restart (crash recovery) without any in-process timers.
   */
  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const now = Date.now();
      // Sync from Redis every 15 seconds to catch crash-recovery matches,
      // without blowing the 10k/day Upstash quota.
      if (now - this.lastFullSync > 15000) {
        const ids = await getActiveMatchIds();
        for (const id of ids) this.activeMatches.add(id);
        this.lastFullSync = now;
      }

      for (const id of this.activeMatches) {
        const meta = await getMeta(id);
        if (!meta) {
          await removeActive(id);
          this.activeMatches.delete(id);
          continue;
        }
        if (meta.phase === 'STARTING' && meta.countdownEndsAt && now >= meta.countdownEndsAt) {
          await this.openQuestion(id, 0);
        } else if (meta.phase === 'QUESTION' && meta.endsAt && now >= meta.endsAt) {
          await this.endQuestion(id, meta.currentPosition);
        } else if (meta.phase === 'REVEAL' || meta.phase === 'ENDED') {
          await removeActive(id);
          this.activeMatches.delete(id);
        }
      }
    } catch (err) {
      logger.error({ err }, 'match.sweep_error');
      captureException(err, { event: 'sweep' });
    } finally {
      this.sweeping = false;
    }
  }

  // --- lobby ---------------------------------------------------------------

  /** Ensure a Redis match record exists for a challenge; returns its meta. */
  async ensureLobby(slug: string): Promise<MatchMeta> {
    const challenge = await db.challenge.findUnique({
      where: { shareSlug: slug },
      include: { bank: true },
    });
    if (!challenge) throw new MatchEngineError('Challenge not found', 'NOT_FOUND');
    if (challenge.status === 'CANCELLED') {
      throw new MatchEngineError('This challenge was cancelled', 'CANCELLED');
    }

    const existing = await getMeta(challenge.id);
    if (existing) return existing;

    const meta: MatchMeta = {
      challengeId: challenge.id,
      slug: challenge.shareSlug,
      bankTitle: challenge.bank.title,
      hostSessionId: challenge.createdBy,
      status: challenge.status,
      phase: challenge.status === 'FINISHED' ? 'ENDED' : 'LOBBY',
      questionCount: challenge.questionCount,
      timerSeconds: challenge.timerSeconds,
      maxPlayers: challenge.maxPlayers,
      currentPosition: -1,
      startedAt: null,
      endsAt: null,
      countdownEndsAt: null,
    };
    await saveMeta(meta);

    logger.info({ matchId: challenge.id, hostSessionId: challenge.createdBy }, 'match.created');

    // Re-hydrate existing participants (e.g. the host row created at creation).
    const participants = await db.matchParticipant.findMany({ where: { challengeId: challenge.id } });
    for (const p of participants) {
      await upsertPlayer(challenge.id, {
        sessionId: p.sessionId,
        username: p.username,
        role: p.role,
        connected: false,
      });
      await incrScore(challenge.id, p.sessionId, 0);
    }
    return meta;
  }

  /** Register/refresh a player in the lobby and mark them connected. */
  async join(
    challengeId: string,
    sessionId: string,
    username: string | null,
    playerId: string | null = null,
  ): Promise<MatchMeta> {
    const meta = await getMeta(challengeId);
    if (!meta) throw new MatchEngineError('Match not found', 'NOT_FOUND');

    const isHost = sessionId === meta.hostSessionId;
    const existing = await db.matchParticipant.findFirst({ where: { challengeId, sessionId } });

    if (!existing) {
      if (meta.status !== 'LOBBY') {
        throw new MatchEngineError('This match has already started', 'IN_PROGRESS');
      }
      const players = await getPlayers(challengeId);
      if (players.length >= meta.maxPlayers) {
        throw new MatchEngineError('This match is full', 'FULL');
      }
      await db.matchParticipant.create({
        data: { challengeId, sessionId, username, role: 'PLAYER', score: 0, playerId },
      });
    } else {
      // Refresh username and/or backfill the persistent playerId on rejoin.
      const patch: { username?: string; playerId?: string } = {};
      if (username && username !== existing.username) patch.username = username;
      if (playerId && playerId !== existing.playerId) patch.playerId = playerId;
      if (Object.keys(patch).length > 0) {
        await db.matchParticipant.update({ where: { id: existing.id }, data: patch });
      }
    }

    // Maintain the soft-account profile so the global leaderboard can show a
    // current display name. Best-effort: never block a join on this write.
    if (playerId) {
      const name = (username ?? existing?.username ?? 'Guest').slice(0, 40);
      try {
        await db.playerProfile.upsert({
          where: { playerId },
          create: { playerId, username: name },
          update: { username: name, lastSeen: new Date() },
        });
      } catch (err) {
        logger.warn({ err, playerId }, 'leaderboard.profile_upsert_failed');
      }
    }

    const player: StoredPlayer = {
      sessionId,
      username: username ?? existing?.username ?? null,
      role: isHost ? 'HOST' : 'PLAYER',
      connected: true,
    };
    await upsertPlayer(challengeId, player);
    await incrScore(challengeId, sessionId, 0);
    logger.info({ matchId: challengeId, sessionId, isHost: isHost || false }, 'match.joined');
    return meta;
  }


  /**
   * Mark a player disconnected. If the HOST leaves while still in the LOBBY,
   * transfer ownership to the next connected participant, or cancel the lobby
   * if none remain (BUILD_DIRECTIVE §6). During an active match, the match
   * continues unaffected and host departure is a no-op beyond the flag.
   */
  async markDisconnected(challengeId: string, sessionId: string): Promise<void> {
    if (!(await metaExists(challengeId))) return;
    await setPlayerConnected(challengeId, sessionId, false);

    const meta = await getMeta(challengeId);
    if (!meta) return;

    const hostLeftInLobby = meta.status === 'LOBBY' && sessionId === meta.hostSessionId;
    if (hostLeftInLobby) {
      await this.handleHostLeftLobby(challengeId, meta, sessionId);
      return;
    }

    await this.broadcastLobby(challengeId);
  }

  private async handleHostLeftLobby(
    challengeId: string,
    meta: MatchMeta,
    departingHost: string,
  ): Promise<void> {
    // Prefer the next connected participant in join order; ignore the old host.
    const participants = await db.matchParticipant.findMany({
      where: { challengeId },
      orderBy: { joinedAt: 'asc' },
    });
    const players = await getPlayers(challengeId);
    const connected = new Set(players.filter((p) => p.connected).map((p) => p.sessionId));

    const successor = participants.find(
      (p) => p.sessionId !== departingHost && connected.has(p.sessionId),
    );

    if (!successor) {
      // No one left to own the lobby → cancel it (terminal state per §9).
      await db.challenge.update({ where: { id: challengeId }, data: { status: 'CANCELLED' } });
      await patchMeta(challengeId, { status: 'CANCELLED' });
      const payload: LobbyCancelledPayload = {
        reason: 'The host left and no one was available to take over.',
      };
      this.io.to(this.room(challengeId)).emit(MATCH_EVENTS.LOBBY_CANCELLED, payload);
      await clearMatch(challengeId, meta.questionCount);
      this.questionCache.delete(challengeId);
      return;
    }

    // Promote the successor in both the durable store and live Redis state.
    await db.matchParticipant.update({ where: { id: successor.id }, data: { role: 'HOST' } });
    await db.matchParticipant.updateMany({
      where: { challengeId, sessionId: departingHost },
      data: { role: 'PLAYER' },
    });
    await setPlayerRole(challengeId, successor.sessionId, 'HOST');
    await setPlayerRole(challengeId, departingHost, 'PLAYER');
    await patchMeta(challengeId, { hostSessionId: successor.sessionId });
    logger.info({ matchId: challengeId, newHostSessionId: successor.sessionId, oldHostSessionId: departingHost }, 'match.host_promoted');

    await this.broadcastLobby(challengeId);
  }

  // --- broadcasting --------------------------------------------------------

  private async buildLobbyState(meta: MatchMeta): Promise<LobbyStatePayload> {
    const [players, scores] = await Promise.all([
      getPlayers(meta.challengeId),
      getScores(meta.challengeId),
    ]);
    return {
      status: meta.status,
      phase: meta.phase,
      hostSessionId: meta.hostSessionId,
      players: players
        .map((p) => ({ ...p, score: scores[p.sessionId] ?? 0 }))
        .sort((a, b) => (a.role === 'HOST' ? -1 : b.role === 'HOST' ? 1 : 0)),
      bankTitle: meta.bankTitle,
      questionCount: meta.questionCount,
      timerSeconds: meta.timerSeconds,
      maxPlayers: meta.maxPlayers,
      currentPosition: meta.currentPosition,
    };
  }

  async broadcastLobby(challengeId: string): Promise<void> {
    const meta = await getMeta(challengeId);
    if (!meta) return;
    const state = await this.buildLobbyState(meta);
    this.io.to(this.room(challengeId)).emit(MATCH_EVENTS.LOBBY_STATE, state);
  }

  /** Public question payload (never leaks the correct index). */
  private questionStartPayload(meta: MatchMeta, q: LoadedQuestion): QuestionStartPayload {
    return {
      position: meta.currentPosition,
      totalQuestions: meta.questionCount,
      questionText: q.questionText,
      options: q.options,
      startedAt: meta.startedAt ?? Date.now(),
      endsAt: meta.endsAt ?? Date.now(),
      timerSeconds: meta.timerSeconds,
    };
  }

  // --- match lifecycle -----------------------------------------------------

  /** Load (and cache) the locked question set for a challenge. */
  private async getQuestions(challengeId: string): Promise<LoadedQuestion[]> {
    const cached = this.questionCache.get(challengeId);
    if (cached) return cached;

    const rows = await db.challengeQuestion.findMany({
      where: { challengeId },
      orderBy: { position: 'asc' },
      include: { question: true },
    });
    const questions: LoadedQuestion[] = rows.map((r) => ({
      questionId: r.questionId,
      questionText: r.question.questionText,
      options: r.shuffledOptions as string[],
      correctIndex: r.shuffledCorrectIndex,
    }));
    
    // EGG 2: 5% chance to inject creator question as the final question
    if (questions.length > 0 && Math.random() < 0.05) {
      questions[questions.length - 1] = {
        questionId: 'easter-egg-creator',
        questionText: 'Who built CRUDD?',
        options: ['Some random dev', 'An AI', 'Ademola (@rynyxxx)', 'Nobody knows'],
        correctIndex: 2,
      };
    }
    
    this.questionCache.set(challengeId, questions);
    return questions;
  }

  /** Host starts the match → enter the STARTING countdown (sweeper opens Q0). */
  async startMatch(challengeId: string, sessionId: string): Promise<void> {
    const meta = await getMeta(challengeId);
    if (!meta) throw new MatchEngineError('Match not found', 'NOT_FOUND');
    if (sessionId !== meta.hostSessionId) {
      throw new MatchEngineError('Only the host can start the match', 'FORBIDDEN');
    }
    if (meta.status !== 'LOBBY') {
      throw new MatchEngineError('Match already started', 'IN_PROGRESS');
    }

    const questions = await this.getQuestions(challengeId);
    if (questions.length === 0) {
      throw new MatchEngineError('This match has no questions', 'EMPTY');
    }

    const countdownEndsAt = Date.now() + COUNTDOWN_MS;
    await db.challenge.update({ where: { id: challengeId }, data: { status: 'ACTIVE' } });
    await patchMeta(challengeId, {
      status: 'ACTIVE',
      phase: 'STARTING',
      countdownEndsAt,
    });
    await markActive(challengeId);
    this.activeMatches.add(challengeId);
    logger.info({ matchId: challengeId, hostSessionId: sessionId, countdownEndsAt }, 'match.started');

    const payload: CountdownPayload = { startsAt: countdownEndsAt };
    this.io.to(this.room(challengeId)).emit(MATCH_EVENTS.COUNTDOWN, payload);
    // The sweeper opens question 0 once the countdown elapses.
  }

  private async openQuestion(challengeId: string, position: number): Promise<void> {
    const questions = await this.getQuestions(challengeId);
    const q = questions[position];
    if (!q) return;

    const base = await getMeta(challengeId);
    if (!base) return;

    const now = Date.now();
    const endsAt = now + base.timerSeconds * 1000;
    const meta = await patchMeta(challengeId, {
      phase: 'QUESTION',
      currentPosition: position,
      startedAt: now,
      endsAt,
      countdownEndsAt: null,
    });
    if (!meta) return;

    await markActive(challengeId);
    this.activeMatches.add(challengeId);
    logger.info({ matchId: challengeId, position }, 'match.question_opened');
    this.io
      .to(this.room(challengeId))
      .emit(MATCH_EVENTS.QUESTION_START, this.questionStartPayload(meta, q));
  }

  /** Validate + score a single answer. Throws on invalid attempts. */
  async submitAnswer(
    challengeId: string,
    sessionId: string,
    position: number,
    selectedIndex: number,
  ): Promise<{ accepted: boolean; selectedIndex: number }> {
    const meta = await getMeta(challengeId);
    if (!meta) throw new MatchEngineError('Match not found', 'NOT_FOUND');
    if (meta.phase !== 'QUESTION' || meta.currentPosition !== position) {
      throw new MatchEngineError('Question is not open', 'CLOSED');
    }
    const now = Date.now();
    if (meta.endsAt && now > meta.endsAt) {
      throw new MatchEngineError('Too late', 'CLOSED');
    }
    if (await hasAnswered(challengeId, position, sessionId)) {
      throw new MatchEngineError('Already answered', 'DUPLICATE');
    }

    const questions = await this.getQuestions(challengeId);
    const q = questions[position];
    if (!q) throw new MatchEngineError('Question unavailable', 'CLOSED');

    const responseMs = meta.startedAt ? now - meta.startedAt : meta.timerSeconds * 1000;
    const deadlineMs = meta.timerSeconds * 1000;
    const isCorrect = selectedIndex === q.correctIndex;
    const points = calculateScore(isCorrect, responseMs, deadlineMs);

    await recordAnswer(challengeId, position, sessionId, { selectedIndex, responseMs, isCorrect, points });
    await incrScore(challengeId, sessionId, points);
    logger.info(
      { matchId: challengeId, sessionId, position, isCorrect, points, responseMs },
      'match.answer_submitted',
    );

    // Auto-close once every *connected* player has answered — but never close on
    // an empty room (guards against a disconnect race, per readiness P2).
    const players = await getPlayers(challengeId);
    const connected = players.filter((p) => p.connected);
    if (connected.length > 0 && (await answerCount(challengeId, position)) >= connected.length) {
      await this.endQuestion(challengeId, position);
    }

    return { accepted: true, selectedIndex };
  }

  private async endQuestion(challengeId: string, position: number): Promise<void> {
    const meta = await getMeta(challengeId);
    if (!meta || meta.phase !== 'QUESTION' || meta.currentPosition !== position) return;

    const questions = await this.getQuestions(challengeId);
    const q = questions[position];
    if (!q) return;

    await patchMeta(challengeId, { phase: 'REVEAL', endsAt: null });
    await removeActive(challengeId);
    this.activeMatches.delete(challengeId);
    logger.info({ matchId: challengeId, position }, 'match.question_closed');

    const [answers, players, scores] = await Promise.all([
      getAnswers(challengeId, position),
      getPlayers(challengeId),
      getScores(challengeId),
    ]);

    // Durable write-behind: flush this question's answers to Postgres.
    await this.flushAnswers(challengeId, q.questionId, answers, players);

    const results: PlayerQuestionResult[] = players.map((p) => {
      const a = answers[p.sessionId];
      return {
        sessionId: p.sessionId,
        username: p.username,
        selectedIndex: a ? a.selectedIndex : null,
        isCorrect: a ? a.isCorrect : false,
        pointsAwarded: a ? a.points : 0,
      };
    });

    const isLastQuestion = position >= meta.questionCount - 1;
    const payload: QuestionEndPayload = {
      position,
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      results,
      leaderboard: buildLeaderboard(players, scores),
      isLastQuestion,
    };

    // Cache for clients that reconnect during REVEAL (rejoin, §P1.4).
    await saveRevealSnapshot(challengeId, payload);
    this.io.to(this.room(challengeId)).emit(MATCH_EVENTS.QUESTION_END, payload);
  }

  private async flushAnswers(
    challengeId: string,
    questionId: string,
    answers: Record<string, { selectedIndex: number; responseMs: number; isCorrect: boolean; points: number }>,
    players: StoredPlayer[],
  ): Promise<void> {
    const participants = await db.matchParticipant.findMany({ where: { challengeId } });
    const bySession = new Map(participants.map((p) => [p.sessionId, p]));

    for (const [sessionId, a] of Object.entries(answers)) {
      const participant = bySession.get(sessionId);
      if (!participant) continue;
      await db.matchAnswer.create({
        data: {
          challengeId,
          questionId,
          participantId: participant.id,
          selectedIndex: a.selectedIndex,
          isCorrect: a.isCorrect,
          responseMs: a.responseMs,
          pointsAwarded: a.points,
        },
      });
    }

    // Keep persisted participant scores in sync with the live Redis totals.
    const scores = await getScores(challengeId);
    for (const p of players) {
      const participant = bySession.get(p.sessionId);
      if (!participant) continue;
      await db.matchParticipant.update({
        where: { id: participant.id },
        data: { score: scores[p.sessionId] ?? 0 },
      });
    }
  }

  async advance(challengeId: string, sessionId: string): Promise<void> {
    const meta = await getMeta(challengeId);
    if (!meta) throw new MatchEngineError('Match not found', 'NOT_FOUND');
    if (sessionId !== meta.hostSessionId) {
      throw new MatchEngineError('Only the host can advance the match', 'FORBIDDEN');
    }
    if (meta.phase !== 'REVEAL') {
      throw new MatchEngineError('Not ready to advance', 'INVALID_STATE');
    }

    const next = meta.currentPosition + 1;
    if (next >= meta.questionCount) {
      await this.endMatch(challengeId);
    } else {
      await this.openQuestion(challengeId, next);
    }
  }

  /** Compute per-player summary stats for the final screen from durable answers. */
  private async buildMatchStats(
    challengeId: string,
    questionCount: number,
    leaderboard: ReturnType<typeof buildLeaderboard>,
  ): Promise<PlayerMatchStats[]> {
    const [participants, answers] = await Promise.all([
      db.matchParticipant.findMany({ where: { challengeId } }),
      db.matchAnswer.findMany({ where: { challengeId } }),
    ]);
    const sessionByParticipant = new Map(participants.map((p) => [p.id, p.sessionId]));

    const agg = new Map<string, { correct: number; correctMs: number }>();
    for (const a of answers) {
      const sessionId = sessionByParticipant.get(a.participantId);
      if (!sessionId) continue;
      const cur = agg.get(sessionId) ?? { correct: 0, correctMs: 0 };
      if (a.isCorrect) {
        cur.correct += 1;
        cur.correctMs += a.responseMs;
      }
      agg.set(sessionId, cur);
    }

    return leaderboard.map((entry) => {
      const a = agg.get(entry.sessionId) ?? { correct: 0, correctMs: 0 };
      return {
        sessionId: entry.sessionId,
        username: entry.username,
        score: entry.score,
        rank: entry.rank,
        correctCount: a.correct,
        totalQuestions: questionCount,
        accuracy: questionCount > 0 ? Math.round((a.correct / questionCount) * 100) : 0,
        avgResponseMs: a.correct > 0 ? Math.round(a.correctMs / a.correct) : 0,
      };
    });
  }

  private async endMatch(challengeId: string): Promise<void> {
    const meta = await patchMeta(challengeId, {
      phase: 'ENDED',
      status: 'FINISHED',
      endsAt: null,
      countdownEndsAt: null,
    });
    await db.challenge.update({ where: { id: challengeId }, data: { status: 'FINISHED' } });

    const [players, scores] = await Promise.all([getPlayers(challengeId), getScores(challengeId)]);
    const leaderboard = buildLeaderboard(players, scores);
    const stats = await this.buildMatchStats(
      challengeId,
      meta?.questionCount ?? 0,
      leaderboard,
    );
    const payload: MatchEndPayload = { leaderboard, stats };

    // Persist the final payload for late rejoins (§P1.4) before pruning live state.
    await saveEndSnapshot(challengeId, payload);
    this.io.to(this.room(challengeId)).emit(MATCH_EVENTS.MATCH_END, payload);
    logger.info({ matchId: challengeId, playerCount: players.length }, 'match.ended');

    // Roll each identified player's final match score into their persistent
    // global-leaderboard total. endMatch runs exactly once per match (advance()
    // guards on the REVEAL phase), so this never double-counts.
    await this.accumulateGlobalScores(challengeId, scores);

    // Prune the bulk live state now rather than waiting on the 6h TTL (§P2).
    // The meta (phase ENDED) and end snapshot are retained so reconnecting
    // clients still receive the results screen.
    await removeActive(challengeId);
    this.questionCache.delete(challengeId);
  }

  /**
   * Add this match's per-player scores to each soft-account's running global
   * total. Participants without a `playerId` (legacy / API-only joins) are
   * simply skipped. Best-effort and fully isolated: a leaderboard write failure
   * must never break match completion for the players.
   */
  private async accumulateGlobalScores(
    challengeId: string,
    scores: Record<string, number>,
  ): Promise<void> {
    try {
      const participants = await db.matchParticipant.findMany({
        where: { challengeId, playerId: { not: null } },
        select: { sessionId: true, playerId: true },
      });
      if (participants.length === 0) return;

      // Aggregate by playerId so a player who somehow occupies two seats in one
      // match (e.g. two tabs sharing localStorage) is counted once.
      const gained = new Map<string, number>();
      for (const p of participants) {
        if (!p.playerId) continue;
        const delta = scores[p.sessionId] ?? 0;
        if (delta <= 0) continue;
        gained.set(p.playerId, (gained.get(p.playerId) ?? 0) + delta);
      }

      for (const [playerId, delta] of gained) {
        await db.playerProfile.update({
          where: { playerId },
          data: { totalScore: { increment: BigInt(delta) }, lastSeen: new Date() },
        });
      }
      logger.info(
        { matchId: challengeId, playersScored: gained.size },
        'leaderboard.scores_accumulated',
      );
    } catch (err) {
      logger.error({ err, matchId: challengeId }, 'leaderboard.accumulate_failed');
      captureException(err, { matchId: challengeId, event: 'accumulateGlobalScores' });
    }
  }


  // --- rejoin --------------------------------------------------------------

  /** Payload to catch up a client that (re)joins mid-question. */
  async currentQuestionForRejoin(challengeId: string): Promise<QuestionStartPayload | null> {
    const meta = await getMeta(challengeId);
    if (!meta || meta.phase !== 'QUESTION') return null;
    const q = (await this.getQuestions(challengeId))[meta.currentPosition];
    if (!q) return null;
    return this.questionStartPayload(meta, q);
  }

  /**
   * Return whatever phase-specific catch-up payload a reconnecting client needs
   * (BUILD_DIRECTIVE §P1.4): the open question, the last reveal, or the final
   * results. Lobby state is broadcast separately by the gateway.
   */
  async rejoinSnapshot(challengeId: string): Promise<
    | { kind: 'countdown'; payload: CountdownPayload }
    | { kind: 'question'; payload: QuestionStartPayload }
    | { kind: 'reveal'; payload: QuestionEndPayload }
    | { kind: 'end'; payload: MatchEndPayload }
    | null
  > {
    const meta = await getMeta(challengeId);
    if (!meta) return null;

    if (meta.phase === 'STARTING' && meta.countdownEndsAt) {
      return { kind: 'countdown', payload: { startsAt: meta.countdownEndsAt } };
    }
    if (meta.phase === 'QUESTION') {
      const q = (await this.getQuestions(challengeId))[meta.currentPosition];
      if (q) return { kind: 'question', payload: this.questionStartPayload(meta, q) };
    }
    if (meta.phase === 'REVEAL') {
      const payload = await getRevealSnapshot(challengeId);
      if (payload) return { kind: 'reveal', payload };
    }
    if (meta.phase === 'ENDED') {
      const payload = await getEndSnapshot(challengeId);
      if (payload) return { kind: 'end', payload };
    }
    return null;
  }
}
