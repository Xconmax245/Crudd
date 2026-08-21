import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '@crudd/database';
import type {
  GlobalLeaderboardResponse,
  GlobalLeaderboardEntry,
  LeaderboardMeResponse,
  LeaderboardPeriod,
} from '@crudd/shared';
import { logger } from './logger';

/**
 * Global leaderboard (Phase 2.5).
 *
 * Public, unauthenticated endpoints backed by the soft-account `player_id`.
 * - `alltime` reads the denormalized `player_profiles.total_score` (indexed).
 * - `today` / `week` aggregate `match_participants.score` by `joined_at`, which
 *   is a good proxy for "points earned in a period" since matches are short.
 *
 * Results are cached in-process for a few seconds so a spike of viewers can't
 * hammer the database; each replica keeps its own cache, which is fine for a
 * read-only board that tolerates a little staleness.
 */

const TOP_N = 100;
/** Hard cap on rows pulled into memory for ranking (protects the process). */
const RANK_SCAN_LIMIT = 10_000;
const CACHE_TTL_MS = 15_000;

type Ordered = { playerId: string; score: number }[];

interface CacheEntry {
  expires: number;
  ordered: Ordered;
}

const cache = new Map<LeaderboardPeriod, CacheEntry>();

/** Epoch-ms lower bound for a period, or null for all-time (no filter). */
function periodStart(period: LeaderboardPeriod): Date | null {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return null; // alltime
}

/** Build (or reuse a cached) descending list of {playerId, score} for a period. */
async function getOrdered(period: LeaderboardPeriod): Promise<Ordered> {
  const cached = cache.get(period);
  if (cached && cached.expires > Date.now()) return cached.ordered;

  let ordered: Ordered;

  if (period === 'alltime') {
    const rows = await db.playerProfile.findMany({
      where: { totalScore: { gt: 0 } },
      orderBy: { totalScore: 'desc' },
      take: RANK_SCAN_LIMIT,
      select: { playerId: true, totalScore: true },
    });
    ordered = rows.map((r) => ({ playerId: r.playerId, score: Number(r.totalScore) }));
  } else {
    const start = periodStart(period)!;
    const grouped = await db.matchParticipant.groupBy({
      by: ['playerId'],
      where: { playerId: { not: null }, joinedAt: { gte: start } },
      _sum: { score: true },
      orderBy: { _sum: { score: 'desc' } },
      take: RANK_SCAN_LIMIT,
    });
    ordered = grouped
      .filter((g) => g.playerId && (g._sum.score ?? 0) > 0)
      .map((g) => ({ playerId: g.playerId as string, score: g._sum.score ?? 0 }));
  }

  cache.set(period, { expires: Date.now() + CACHE_TTL_MS, ordered });
  return ordered;
}

/** Attach a friendly display name to the top slice of an ordered list. */
async function toEntries(ordered: Ordered, limit: number): Promise<GlobalLeaderboardEntry[]> {
  const top = ordered.slice(0, limit);
  if (top.length === 0) return [];

  const profiles = await db.playerProfile.findMany({
    where: { playerId: { in: top.map((t) => t.playerId) } },
    select: { playerId: true, username: true },
  });
  const nameById = new Map(profiles.map((p) => [p.playerId, p.username]));

  return top.map((t, i) => ({
    rank: i + 1,
    playerId: t.playerId,
    username: nameById.get(t.playerId) ?? 'Guest',
    score: t.score,
    isYou: false, // the client marks itself by comparing playerId
  }));
}

const periodSchema = z.enum(['today', 'week', 'alltime']).default('alltime');

export const leaderboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Public board: top players for a period. Cached + rate-limited.
  fastify.get(
    '/api/leaderboard',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        querystring: z.object({
          period: periodSchema,
          limit: z.coerce.number().int().min(1).max(TOP_N).default(TOP_N),
        }),
      },
    },
    async (request): Promise<GlobalLeaderboardResponse> => {
      const { period, limit } = request.query as { period: LeaderboardPeriod; limit: number };
      const ordered = await getOrdered(period);
      const entries = await toEntries(ordered, limit);
      return { period, generatedAt: new Date().toISOString(), entries };
    },
  );

  // A single player's own rank/score for a period (for the "your rank" peek).
  fastify.get(
    '/api/leaderboard/me',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: z.object({
          playerId: z.string().min(1).max(64),
          period: periodSchema,
        }),
      },
    },
    async (request, reply): Promise<LeaderboardMeResponse | { error: string }> => {
      const { playerId, period } = request.query as { playerId: string; period: LeaderboardPeriod };

      const ordered = await getOrdered(period);
      const idx = ordered.findIndex((o) => o.playerId === playerId);

      const profile = await db.playerProfile.findUnique({
        where: { playerId },
        select: { username: true },
      });
      const username = profile?.username ?? 'You';

      if (idx === -1) {
        // Not ranked in this period (no qualifying points yet).
        return reply.status(404).send({ error: 'No ranking yet for this period' });
      }

      return { rank: idx + 1, score: ordered[idx].score, period, username };
    },
  );

  logger.debug('leaderboard.routes_registered');
};
