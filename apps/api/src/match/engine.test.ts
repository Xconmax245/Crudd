import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatchEngine, MatchEngineError } from './engine';
import { db } from '@crudd/database';
import * as store from './store';

// Silence structured logger in tests
vi.mock('../logger', () => ({
  logger: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));
// Suppress Sentry in tests
vi.mock('../observability', () => ({
  Sentry: {},
  captureException: vi.fn(),
}));


// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@crudd/database', () => ({
  db: {
    challenge: { findUnique: vi.fn(), update: vi.fn() },
    matchParticipant: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    challengeQuestion: { findMany: vi.fn() },
    matchAnswer: { create: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('./store', () => ({
  saveMeta: vi.fn(),
  getMeta: vi.fn(),
  patchMeta: vi.fn(),
  metaExists: vi.fn(),
  upsertPlayer: vi.fn(),
  getPlayers: vi.fn(),
  setPlayerConnected: vi.fn(),
  setPlayerRole: vi.fn(),
  incrScore: vi.fn(),
  getScores: vi.fn(),
  recordAnswer: vi.fn(),
  hasAnswered: vi.fn(),
  getAnswers: vi.fn(),
  answerCount: vi.fn(),
  buildLeaderboard: vi.fn(),
  saveRevealSnapshot: vi.fn(),
  getRevealSnapshot: vi.fn(),
  saveEndSnapshot: vi.fn(),
  getEndSnapshot: vi.fn(),
  markActive: vi.fn(),
  removeActive: vi.fn(),
  getActiveMatchIds: vi.fn(),
  clearMatch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
} as any;

/** Build a stub MatchMeta object with sensible defaults, overridable per-test. */
function makeMeta(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    challengeId: 'c1',
    slug: 'test-slug',
    bankTitle: 'Test Bank',
    hostSessionId: 'host',
    status: 'LOBBY',
    phase: 'LOBBY',
    questionCount: 3,
    timerSeconds: 10,
    maxPlayers: 5,
    currentPosition: -1,
    startedAt: null,
    endsAt: null,
    countdownEndsAt: null,
    ...overrides,
  } as any;
}

/** Build a stub question set injected directly into the engine's cache. */
const QUESTIONS = [
  { questionId: 'q1', questionText: 'Q1', options: ['A', 'B', 'C', 'D'], correctIndex: 2 },
  { questionId: 'q2', questionText: 'Q2', options: ['W', 'X', 'Y', 'Z'], correctIndex: 0 },
  { questionId: 'q3', questionText: 'Q3', options: ['P', 'Q', 'R', 'S'], correctIndex: 3 },
];

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MatchEngine', () => {
  let engine: MatchEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Baseline stubs — each test overrides only what it cares about
    vi.mocked(db.matchParticipant.findMany).mockResolvedValue([]);
    vi.mocked(db.matchAnswer.findMany).mockResolvedValue([]);
    vi.mocked(store.buildLeaderboard).mockReturnValue([]);
    vi.mocked(store.getAnswers).mockResolvedValue({});
    vi.mocked(store.getScores).mockResolvedValue({});
    vi.mocked(store.getPlayers).mockResolvedValue([]);
    vi.mocked(store.patchMeta).mockImplementation(async (_id, patch) =>
      makeMeta(patch),
    );

    engine = new MatchEngine(mockIo);
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  // =========================================================================
  // LOBBY / ensureLobby
  // =========================================================================

  describe('ensureLobby', () => {
    it('throws NOT_FOUND when challenge does not exist', async () => {
      vi.mocked(db.challenge.findUnique).mockResolvedValue(null);
      await expect(engine.ensureLobby('no-such-slug')).rejects.toThrow('Challenge not found');
    });

    it('throws CANCELLED when challenge is cancelled', async () => {
      vi.mocked(db.challenge.findUnique).mockResolvedValue({
        id: 'c1', shareSlug: 'slug', status: 'CANCELLED', bank: { title: 'T' },
      } as any);
      await expect(engine.ensureLobby('slug')).rejects.toMatchObject({ code: 'CANCELLED' });
    });

    it('returns existing meta without re-saving when lobby already initialised', async () => {
      const existing = makeMeta({ phase: 'LOBBY' });
      vi.mocked(db.challenge.findUnique).mockResolvedValue({
        id: 'c1', shareSlug: 'slug', status: 'LOBBY', bank: { title: 'T' },
      } as any);
      vi.mocked(store.getMeta).mockResolvedValue(existing);

      const result = await engine.ensureLobby('slug');
      expect(result).toBe(existing);
      expect(store.saveMeta).not.toHaveBeenCalled();
    });

    it('creates LOBBY meta and rehydrates participants on first call', async () => {
      vi.mocked(db.challenge.findUnique).mockResolvedValue({
        id: 'c1', shareSlug: 'slug', status: 'LOBBY', questionCount: 5,
        timerSeconds: 15, maxPlayers: 8, createdBy: 'host', bank: { title: 'Bio' },
      } as any);
      vi.mocked(store.getMeta).mockResolvedValue(null);
      vi.mocked(db.matchParticipant.findMany).mockResolvedValue([
        { challengeId: 'c1', sessionId: 'host', username: 'Host', role: 'HOST' } as any,
      ]);

      const meta = await engine.ensureLobby('slug');

      expect(meta.phase).toBe('LOBBY');
      expect(meta.hostSessionId).toBe('host');
      expect(store.saveMeta).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'LOBBY', currentPosition: -1 }),
      );
      expect(store.upsertPlayer).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ sessionId: 'host', role: 'HOST' }),
      );
    });

    it('sets phase to ENDED for a previously FINISHED challenge', async () => {
      vi.mocked(db.challenge.findUnique).mockResolvedValue({
        id: 'c1', shareSlug: 'slug', status: 'FINISHED', questionCount: 3,
        timerSeconds: 10, maxPlayers: 5, createdBy: 'host', bank: { title: 'T' },
      } as any);
      vi.mocked(store.getMeta).mockResolvedValue(null);
      vi.mocked(db.matchParticipant.findMany).mockResolvedValue([]);

      const meta = await engine.ensureLobby('slug');
      expect(meta.phase).toBe('ENDED');
    });
  });

  // =========================================================================
  // JOINING
  // =========================================================================

  describe('join', () => {
    it('throws NOT_FOUND when match meta is missing', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(null);
      await expect(engine.join('c1', 'p1', 'Player')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lets a brand-new player join an open lobby', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ status: 'LOBBY', maxPlayers: 5 }));
      vi.mocked(db.matchParticipant.findFirst).mockResolvedValue(null);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.join('c1', 'p1', 'Player One');

      expect(db.matchParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: 'p1', username: 'Player One', role: 'PLAYER' }),
        }),
      );
    });

    it('marks a returning player as connected without re-creating', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ status: 'ACTIVE', maxPlayers: 5 }));
      vi.mocked(db.matchParticipant.findFirst).mockResolvedValue({
        id: 'part1', sessionId: 'p1', username: 'Player One',
      } as any);

      await engine.join('c1', 'p1', 'Player One');

      expect(db.matchParticipant.create).not.toHaveBeenCalled();
      expect(store.upsertPlayer).toHaveBeenCalledWith('c1', expect.objectContaining({
        sessionId: 'p1', connected: true,
      }));
    });

    it('rejects a new player trying to join a match that already started', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ status: 'ACTIVE', maxPlayers: 5 }));
      vi.mocked(db.matchParticipant.findFirst).mockResolvedValue(null);

      await expect(engine.join('c1', 'outsider', 'Outsider')).rejects.toMatchObject({
        code: 'IN_PROGRESS',
      });
      expect(db.matchParticipant.create).not.toHaveBeenCalled();
    });

    it('rejects join when lobby is at capacity', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ status: 'LOBBY', maxPlayers: 2 }));
      vi.mocked(db.matchParticipant.findFirst).mockResolvedValue(null);
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1' } as any, { sessionId: 'p2' } as any,
      ]);

      await expect(engine.join('c1', 'p3', 'Extra')).rejects.toMatchObject({ code: 'FULL' });
    });

    it('assigns HOST role to the session that owns the challenge', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', maxPlayers: 5, hostSessionId: 'host' }),
      );
      vi.mocked(db.matchParticipant.findFirst).mockResolvedValue({
        id: 'p_host', sessionId: 'host', username: 'Host',
      } as any);

      await engine.join('c1', 'host', 'Host');

      expect(store.upsertPlayer).toHaveBeenCalledWith('c1', expect.objectContaining({
        sessionId: 'host', role: 'HOST',
      }));
    });
  });

  // =========================================================================
  // HOST AUTHORIZATION — startMatch
  // =========================================================================

  describe('startMatch', () => {
    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
    });

    it('allows the designated host to start', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );

      await engine.startMatch('c1', 'host');

      expect(db.challenge.update).toHaveBeenCalledWith({
        where: { id: 'c1' }, data: { status: 'ACTIVE' },
      });
      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({ phase: 'STARTING' }));
    });

    it('rejects a non-host session with FORBIDDEN', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );
      await expect(engine.startMatch('c1', 'impersonator')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(db.challenge.update).not.toHaveBeenCalled();
    });

    it('rejects a crafted session that looks similar to the host ID', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'abc-host-123' }),
      );
      for (const forged of ['abc-host-124', 'ABC-HOST-123', 'abc-host-12', ' abc-host-123', 'abc-host-123 ']) {
        await expect(engine.startMatch('c1', forged)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      }
    });

    it('rejects if match is already active', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'ACTIVE', hostSessionId: 'host' }),
      );
      await expect(engine.startMatch('c1', 'host')).rejects.toMatchObject({ code: 'IN_PROGRESS' });
    });

    it('rejects if question set is empty', async () => {
      engine['questionCache'].set('c1', []);
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );
      vi.mocked(db.challengeQuestion.findMany).mockResolvedValue([]);

      await expect(engine.startMatch('c1', 'host')).rejects.toMatchObject({ code: 'EMPTY' });
    });

    it('emits countdown event after host starts', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );

      await engine.startMatch('c1', 'host');

      expect(mockIo.emit).toHaveBeenCalledWith('match:countdown', expect.objectContaining({
        startsAt: expect.any(Number),
      }));
    });
  });

  // =========================================================================
  // ADVANCE — host-only guard
  // =========================================================================

  describe('advance', () => {
    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
    });

    it('rejects non-host from advancing', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 0, hostSessionId: 'host' }),
      );
      await expect(engine.advance('c1', 'other')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects advancing when not in REVEAL phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'QUESTION', currentPosition: 0, hostSessionId: 'host' }),
      );
      await expect(engine.advance('c1', 'host')).rejects.toMatchObject({ code: 'INVALID_STATE' });
    });

    it('opens the next question when not on the last question', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 0, questionCount: 3, hostSessionId: 'host' }),
      );

      await engine.advance('c1', 'host');

      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({ phase: 'QUESTION', currentPosition: 1 }));
    });

    it('ends the match when advancing beyond the last question', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 2, questionCount: 3, hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.advance('c1', 'host');

      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({
        phase: 'ENDED', status: 'FINISHED',
      }));
      expect(mockIo.emit).toHaveBeenCalledWith('match:end', expect.any(Object));
    });
  });

  // =========================================================================
  // ANSWER VALIDATION
  // =========================================================================

  describe('submitAnswer', () => {
    function openQuestionMeta(overrides: Record<string, unknown> = {}) {
      const now = Date.now();
      return makeMeta({
        phase: 'QUESTION',
        currentPosition: 0,
        timerSeconds: 10,
        startedAt: now - 2000,
        endsAt: now + 8000,
        ...overrides,
      });
    }

    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
    });

    // --- correct answer ---

    it('accepts a correct answer, records it, and returns accepted:true', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      const result = await engine.submitAnswer('c1', 'p1', 0, 2); // Q1 correctIndex = 2

      expect(result.accepted).toBe(true);
      expect(store.recordAnswer).toHaveBeenCalledWith(
        'c1', 0, 'p1',
        expect.objectContaining({ isCorrect: true, selectedIndex: 2 }),
      );
      expect(store.incrScore).toHaveBeenCalledWith('c1', 'p1', expect.any(Number));
    });

    it('awards a positive score for a correct answer', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta({ startedAt: Date.now() - 500 }));
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.submitAnswer('c1', 'p1', 0, 2);

      const [, , , answerData] = vi.mocked(store.recordAnswer).mock.calls[0];
      expect((answerData as any).points).toBeGreaterThan(0);
    });

    // --- incorrect answer ---

    it('accepts an incorrect answer and records zero points', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      const result = await engine.submitAnswer('c1', 'p1', 0, 0); // Q1 correctIndex = 2, selecting 0 = wrong

      expect(result.accepted).toBe(true);
      expect(store.recordAnswer).toHaveBeenCalledWith(
        'c1', 0, 'p1',
        expect.objectContaining({ isCorrect: false, points: 0 }),
      );
    });

    it('does not increase score for an incorrect answer', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.submitAnswer('c1', 'p1', 0, 0);

      expect(store.incrScore).toHaveBeenCalledWith('c1', 'p1', 0);
    });

    // --- late answer ---

    it('rejects a late answer and does not record it', async () => {
      const now = Date.now();
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta({
        startedAt: now - 12000,
        endsAt: now - 2000, // deadline has passed
      }));

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'CLOSED' });
      expect(store.recordAnswer).not.toHaveBeenCalled();
      expect(store.incrScore).not.toHaveBeenCalled();
    });

    it('late answer does not corrupt player score', async () => {
      const now = Date.now();
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta({
        endsAt: now - 1,
      }));

      try { await engine.submitAnswer('c1', 'p1', 0, 2); } catch { /* expected */ }
      expect(store.incrScore).not.toHaveBeenCalled();
    });

    // --- duplicate answer ---

    it('rejects a second answer for the same player/question', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(true); // already answered

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'DUPLICATE' });
      expect(store.recordAnswer).not.toHaveBeenCalled();
    });

    it('cannot award score twice via duplicate submission', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      // First call: not answered; second call: already answered
      vi.mocked(store.hasAnswered)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.submitAnswer('c1', 'p1', 0, 2); // accepted
      try { await engine.submitAnswer('c1', 'p1', 0, 2); } catch { /* expected */ }

      // incrScore called exactly once
      expect(store.incrScore).toHaveBeenCalledTimes(1);
    });

    // --- wrong question position ---

    it('rejects answer for a previous question', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta({ currentPosition: 1 }));

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    it('rejects answer for a future question', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta({ currentPosition: 0 }));

      await expect(engine.submitAnswer('c1', 'p1', 2, 2)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    // --- wrong match phase ---

    it('rejects answer when match is in LOBBY phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'LOBBY', currentPosition: -1 }));

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    it('rejects answer when match is in REVEAL phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 0 }),
      );

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    it('rejects answer when match has ENDED', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'ENDED', currentPosition: 2 }));

      await expect(engine.submitAnswer('c1', 'p1', 2, 3)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    it('rejects answer when match meta does not exist (unknown match)', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(null);

      await expect(engine.submitAnswer('c1', 'p1', 0, 2)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(store.recordAnswer).not.toHaveBeenCalled();
    });

    // --- auto-close when all connected players have answered ---

    it('auto-closes question when every connected player has answered', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1', connected: true } as any,
      ]);
      vi.mocked(store.answerCount).mockResolvedValue(1); // now equals connected count
      vi.mocked(store.getAnswers).mockResolvedValue({
        p1: { selectedIndex: 2, isCorrect: true, points: 160, responseMs: 2500 },
      });

      await engine.submitAnswer('c1', 'p1', 0, 2);

      // Question should have been ended — REVEAL patch emitted
      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({ phase: 'REVEAL' }));
    });

    it('does not auto-close when not all connected players have answered', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1', connected: true } as any,
        { sessionId: 'p2', connected: true } as any,
      ]);
      vi.mocked(store.answerCount).mockResolvedValue(1); // only 1 of 2 answered

      await engine.submitAnswer('c1', 'p1', 0, 2);

      // patchMeta may have been called for score updates but not for REVEAL
      const revealCall = vi.mocked(store.patchMeta).mock.calls.find(
        (c) => c[1] && (c[1] as any).phase === 'REVEAL',
      );
      expect(revealCall).toBeUndefined();
    });

    it('does not auto-close when room is fully disconnected', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(openQuestionMeta());
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1', connected: false } as any,
      ]);
      vi.mocked(store.answerCount).mockResolvedValue(1);

      await engine.submitAnswer('c1', 'p1', 0, 2);

      const revealCall = vi.mocked(store.patchMeta).mock.calls.find(
        (c) => c[1] && (c[1] as any).phase === 'REVEAL',
      );
      expect(revealCall).toBeUndefined();
    });
  });

  // =========================================================================
  // SCORING FORMULA — boundary values
  // =========================================================================

  describe('scoring boundary values', () => {
    function openMeta(startedMsAgo: number) {
      const now = Date.now();
      return makeMeta({
        phase: 'QUESTION',
        currentPosition: 0,
        timerSeconds: 10,
        startedAt: now - startedMsAgo,
        endsAt: now + (10000 - startedMsAgo),
      });
    }

    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);
    });

    async function recordedPoints(startedMsAgo: number, index: number): Promise<number> {
      vi.mocked(store.getMeta).mockResolvedValue(openMeta(startedMsAgo));
      vi.clearAllMocks();
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([]);
      await engine.submitAnswer('c1', 'p1', 0, index);
      const call = vi.mocked(store.recordAnswer).mock.calls[0];
      return (call[3] as any).points;
    }

    it('instant correct answer (<1 s) = 200 pts', async () => {
      expect(await recordedPoints(100, 2)).toBe(200);
    });

    it('fast correct answer (1–2 s) = 180 pts', async () => {
      expect(await recordedPoints(1500, 2)).toBe(180);
    });

    it('moderate correct answer (2–4 s) = 160 pts', async () => {
      expect(await recordedPoints(3000, 2)).toBe(160);
    });

    it('slow correct answer (4–6 s) = 140 pts', async () => {
      expect(await recordedPoints(5000, 2)).toBe(140);
    });

    it('very slow correct answer (6–8 s) = 120 pts', async () => {
      expect(await recordedPoints(7000, 2)).toBe(120);
    });

    it('last-second correct answer (8–10 s) = 100 pts', async () => {
      expect(await recordedPoints(9000, 2)).toBe(100);
    });

    it('incorrect answer = 0 pts regardless of speed', async () => {
      expect(await recordedPoints(200, 0)).toBe(0); // index 0 is wrong
    });
  });

  // =========================================================================
  // TIMER / QUESTION LIFECYCLE — sweeper
  // =========================================================================

  describe('sweeper — question lifecycle', () => {
    it('sweeper transitions QUESTION → REVEAL when deadline has passed', async () => {
      const now = Date.now();
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['c1']);
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({
        challengeId: 'c1',
        phase: 'QUESTION',
        currentPosition: 0,
        questionCount: 3,
        timerSeconds: 10,
        startedAt: now - 11000,
        endsAt: now - 1,
      }));
      vi.mocked(store.patchMeta).mockResolvedValue(makeMeta({ phase: 'REVEAL' }));
      engine['questionCache'].set('c1', QUESTIONS);

      engine.stop(); // run sweep manually
      await engine['sweep']();

      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({ phase: 'REVEAL' }));
      expect(mockIo.emit).toHaveBeenCalledWith('question:end', expect.any(Object));
    });

    it('sweeper does NOT close question if deadline has not yet passed', async () => {
      const now = Date.now();
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['c1']);
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({
        phase: 'QUESTION',
        currentPosition: 0,
        endsAt: now + 5000, // still open
      }));

      engine.stop();
      await engine['sweep']();

      const revealCall = vi.mocked(store.patchMeta).mock.calls.find(
        (c) => c[1] && (c[1] as any).phase === 'REVEAL',
      );
      expect(revealCall).toBeUndefined();
    });

    it('sweeper transitions STARTING → QUESTION once countdown elapses', async () => {
      const now = Date.now();
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['c1']);
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({
        phase: 'STARTING',
        countdownEndsAt: now - 100, // has elapsed
        questionCount: 3,
        timerSeconds: 10,
      }));
      vi.mocked(store.patchMeta).mockResolvedValue(makeMeta({ phase: 'QUESTION', currentPosition: 0 }));
      engine['questionCache'].set('c1', QUESTIONS);

      engine.stop();
      await engine['sweep']();

      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({ phase: 'QUESTION' }));
      expect(mockIo.emit).toHaveBeenCalledWith('question:start', expect.any(Object));
    });

    it('sweeper is re-entrant safe — concurrent ticks do not double-advance', async () => {
      const now = Date.now();
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['c1']);
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({
        phase: 'QUESTION',
        currentPosition: 0,
        endsAt: now - 1,
      }));
      vi.mocked(store.patchMeta).mockResolvedValue(makeMeta({ phase: 'REVEAL' }));
      engine['questionCache'].set('c1', QUESTIONS);

      engine.stop();
      // Fire two sweeps "simultaneously"
      await Promise.all([engine['sweep'](), engine['sweep']()]);

      const revealCalls = vi.mocked(store.patchMeta).mock.calls.filter(
        (c) => c[1] && (c[1] as any).phase === 'REVEAL',
      );
      expect(revealCalls.length).toBe(1);
    });

    it('sweeper removes stale entry when meta is missing', async () => {
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['ghost-id']);
      vi.mocked(store.getMeta).mockResolvedValue(null);

      engine.stop();
      await engine['sweep']();

      expect(store.removeActive).toHaveBeenCalledWith('ghost-id');
    });

    it('closing an already-closed question is idempotent', async () => {
      // endQuestion should bail out if phase is no longer QUESTION
      const meta = makeMeta({ phase: 'REVEAL', currentPosition: 0 });
      vi.mocked(store.getMeta).mockResolvedValue(meta);

      engine.stop();
      // Call endQuestion directly twice
      await engine['endQuestion']('c1', 0);
      await engine['endQuestion']('c1', 0);

      // patchMeta to REVEAL should never be called because guard fires
      const revealCalls = vi.mocked(store.patchMeta).mock.calls.filter(
        (c) => c[1] && (c[1] as any).phase === 'REVEAL',
      );
      expect(revealCalls.length).toBe(0);
    });

    it('correct answer is revealed only after question closes, not before', async () => {
      const now = Date.now();
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({
        phase: 'QUESTION',
        currentPosition: 0,
        timerSeconds: 10,
        startedAt: now - 2000,
        endsAt: now + 8000,
      }));
      vi.mocked(store.hasAnswered).mockResolvedValue(false);
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1', connected: true } as any,
        { sessionId: 'p2', connected: true } as any,
      ]);
      vi.mocked(store.answerCount).mockResolvedValue(1); // not all answered yet
      engine['questionCache'].set('c1', QUESTIONS);

      await engine.submitAnswer('c1', 'p1', 0, 2);

      // question:start should not carry correctIndex
      const startCalls = mockIo.emit.mock.calls.filter((c: any) => c[0] === 'question:start');
      for (const call of startCalls) {
        expect(call[1]).not.toHaveProperty('correctIndex');
      }
    });
  });

  // =========================================================================
  // MATCH COMPLETION
  // =========================================================================

  describe('match completion', () => {
    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
    });

    it('finalises match with ENDED phase and emits match:end', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 2, questionCount: 3, hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.advance('c1', 'host');

      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({
        phase: 'ENDED', status: 'FINISHED',
      }));
      expect(db.challenge.update).toHaveBeenCalledWith({
        where: { id: 'c1' }, data: { status: 'FINISHED' },
      });
      expect(mockIo.emit).toHaveBeenCalledWith('match:end', expect.any(Object));
    });

    it('match:end payload contains a leaderboard', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 2, questionCount: 3, hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'p1', username: 'Player', connected: true } as any,
      ]);
      vi.mocked(store.buildLeaderboard).mockReturnValue([
        { sessionId: 'p1', username: 'Player', score: 200, rank: 1 } as any,
      ]);

      await engine.advance('c1', 'host');

      const endEmit = mockIo.emit.mock.calls.find((c: any) => c[0] === 'match:end');
      expect(endEmit).toBeDefined();
      expect(endEmit[1].leaderboard.length).toBeGreaterThan(0);
    });

    it('players cannot submit answers after match ends', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'ENDED', currentPosition: 2 }));
      engine['questionCache'].set('c1', QUESTIONS);

      await expect(engine.submitAnswer('c1', 'p1', 2, 3)).rejects.toMatchObject({ code: 'CLOSED' });
    });

    it('host cannot start a finished match', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'FINISHED', phase: 'ENDED', hostSessionId: 'host' }),
      );

      await expect(engine.startMatch('c1', 'host')).rejects.toMatchObject({ code: 'IN_PROGRESS' });
    });

    it('host cannot advance a finished match', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'ENDED', currentPosition: 2, hostSessionId: 'host' }),
      );

      await expect(engine.advance('c1', 'host')).rejects.toMatchObject({ code: 'INVALID_STATE' });
    });

    it('endMatch is idempotent (calling twice does not double-emit)', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 2, questionCount: 3, hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.advance('c1', 'host');
      const firstEndEmitCount = mockIo.emit.mock.calls.filter((c: any) => c[0] === 'match:end').length;

      // Sweeper cannot re-end because phase is now ENDED; removeActive is called
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'ENDED' }));
      vi.mocked(store.getActiveMatchIds).mockResolvedValue(['c1']);
      engine.stop();
      await engine['sweep']();

      const totalEndEmits = mockIo.emit.mock.calls.filter((c: any) => c[0] === 'match:end').length;
      expect(totalEndEmits).toBe(firstEndEmitCount); // no extra emissions
    });

    it('saves end snapshot for reconnecting clients', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'REVEAL', currentPosition: 2, questionCount: 3, hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([]);

      await engine.advance('c1', 'host');

      expect(store.saveEndSnapshot).toHaveBeenCalledWith('c1', expect.objectContaining({
        leaderboard: expect.any(Array),
      }));
    });
  });

  // =========================================================================
  // HOST-LEFT LOBBY HANDLING
  // =========================================================================

  describe('markDisconnected — host-left-lobby logic', () => {
    it('cancels lobby when host leaves and no other players are connected', async () => {
      vi.mocked(store.metaExists).mockResolvedValue(true);
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'host', connected: false } as any, // after disconnect
      ]);
      vi.mocked(db.matchParticipant.findMany).mockResolvedValue([
        { id: 'p_host', sessionId: 'host', joinedAt: new Date() } as any,
      ]);

      await engine.markDisconnected('c1', 'host');

      expect(db.challenge.update).toHaveBeenCalledWith({
        where: { id: 'c1' }, data: { status: 'CANCELLED' },
      });
      expect(mockIo.emit).toHaveBeenCalledWith('lobby:cancelled', expect.any(Object));
    });

    it('promotes the next connected player to host when host leaves the lobby', async () => {
      vi.mocked(store.metaExists).mockResolvedValue(true);
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'LOBBY', hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'host', connected: false } as any,
        { sessionId: 'p2', connected: true } as any,
      ]);
      vi.mocked(db.matchParticipant.findMany).mockResolvedValue([
        { id: 'p_host', sessionId: 'host', joinedAt: new Date(1000) } as any,
        { id: 'p_p2', sessionId: 'p2', joinedAt: new Date(2000) } as any,
      ]);

      await engine.markDisconnected('c1', 'host');

      expect(store.setPlayerRole).toHaveBeenCalledWith('c1', 'p2', 'HOST');
      expect(store.patchMeta).toHaveBeenCalledWith('c1', expect.objectContaining({
        hostSessionId: 'p2',
      }));
    });

    it('is a no-op when the challenge does not exist in Redis', async () => {
      vi.mocked(store.metaExists).mockResolvedValue(false);

      await expect(engine.markDisconnected('c1', 'p1')).resolves.toBeUndefined();
      expect(store.getMeta).not.toHaveBeenCalled();
    });

    it('host disconnect during active match does not cancel the match', async () => {
      vi.mocked(store.metaExists).mockResolvedValue(true);
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ status: 'ACTIVE', phase: 'QUESTION', hostSessionId: 'host' }),
      );
      vi.mocked(store.getPlayers).mockResolvedValue([
        { sessionId: 'host', connected: false } as any,
      ]);

      await engine.markDisconnected('c1', 'host');

      expect(db.challenge.update).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalledWith('lobby:cancelled', expect.any(Object));
    });
  });

  // =========================================================================
  // REJOIN SNAPSHOT
  // =========================================================================

  describe('rejoinSnapshot', () => {
    beforeEach(() => {
      engine['questionCache'].set('c1', QUESTIONS);
    });

    it('returns null when no meta exists', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(null);
      expect(await engine.rejoinSnapshot('c1')).toBeNull();
    });

    it('returns countdown snapshot during STARTING phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'STARTING', countdownEndsAt: Date.now() + 2000 }),
      );
      const snap = await engine.rejoinSnapshot('c1');
      expect(snap?.kind).toBe('countdown');
    });

    it('returns question snapshot during QUESTION phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(
        makeMeta({ phase: 'QUESTION', currentPosition: 0, startedAt: Date.now(), endsAt: Date.now() + 8000 }),
      );
      const snap = await engine.rejoinSnapshot('c1');
      expect(snap?.kind).toBe('question');
      // Must not expose correctIndex
      expect((snap?.payload as any).correctIndex).toBeUndefined();
    });

    it('returns reveal snapshot during REVEAL phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'REVEAL' }));
      vi.mocked(store.getRevealSnapshot).mockResolvedValue({ position: 0 } as any);
      const snap = await engine.rejoinSnapshot('c1');
      expect(snap?.kind).toBe('reveal');
    });

    it('returns end snapshot during ENDED phase', async () => {
      vi.mocked(store.getMeta).mockResolvedValue(makeMeta({ phase: 'ENDED' }));
      vi.mocked(store.getEndSnapshot).mockResolvedValue({ leaderboard: [] } as any);
      const snap = await engine.rejoinSnapshot('c1');
      expect(snap?.kind).toBe('end');
    });
  });
});
