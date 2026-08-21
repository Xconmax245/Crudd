import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowLeft, Trophy, Medal, Award } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';
import type {
  GlobalLeaderboardResponse,
  LeaderboardMeResponse,
  LeaderboardPeriod,
} from '@crudd/shared';

import LoadingBlob from '../components/LoadingBlob';
import { useTitle } from '../hooks/useTitle';
import { peekPlayerId } from '../lib/session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'alltime', label: 'All Time' },
];

/** Rank badge: medals for the top 3, plain number otherwise. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={22} className="text-yellow" fill="currentColor" />;
  if (rank === 2) return <Medal size={22} className="text-ink/50" fill="currentColor" />;
  if (rank === 3) return <Award size={22} className="text-purple" fill="currentColor" />;
  return <span className="font-display font-black text-lg tabular-nums">{rank}</span>;
}

export default function Leaderboard() {
  useTitle('Leaderboard');
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime');
  const myPlayerId = peekPlayerId();

  const { data, isLoading, isError } = useQuery<GlobalLeaderboardResponse>({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/leaderboard?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
    // The board tolerates mild staleness; refetch when the tab regains focus.
    staleTime: 15_000,
  });

  // The player's own rank — only meaningful once they have a soft-account id.
  const { data: me } = useQuery<LeaderboardMeResponse | null>({
    queryKey: ['leaderboard-me', period, myPlayerId],
    enabled: !!myPlayerId,
    queryFn: async () => {
      const res = await fetch(
        `${API_URL}/api/leaderboard/me?playerId=${encodeURIComponent(myPlayerId!)}&period=${period}`,
      );
      if (res.status === 404) return null; // unranked this period
      if (!res.ok) throw new Error('Failed to fetch rank');
      return res.json();
    },
    staleTime: 15_000,
  });

  const entries = data?.entries ?? [];
  // True when the player is ranked but sits outside the visible top-N slice.
  const showMyRankFooter =
    !!me && !entries.some((e) => e.playerId === myPlayerId);

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b-3 border-ink bg-cream sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center max-w-4xl">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-ink/5 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div className="font-display font-black text-2xl tracking-tight">CRUDD</div>
          </div>
          <div className="text-sm font-bold opacity-50">Global Leaderboard</div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-w-4xl mt-12">
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight">
            Hall of Fame
          </h1>
          <p className="text-xl max-w-2xl mx-auto opacity-70">
            The sharpest minds on CRUDD. Play more matches to climb.
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex justify-center gap-3 mb-10">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-5 py-2.5 font-bold rounded-crudd border-3 border-ink transition-all duration-150 ${
                period === p.key
                  ? 'bg-purple text-cream shadow-hard'
                  : 'bg-white text-ink hover:bg-ink/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingBlob text="Loading Rankings" />
        ) : isError ? (
          <div className="text-center text-red-500 font-bold p-8 border-3 border-red-500 rounded-crudd bg-red-50">
            Failed to load the leaderboard. Make sure the API is running.
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center font-bold text-lg opacity-60 p-16 border-4 border-ink border-dashed rounded-crudd max-w-2xl mx-auto">
            No scores yet for this period. Be the first to make the board!
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const isYou = entry.playerId === myPlayerId;
              return (
                <motion.div
                  key={entry.playerId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className={`flex items-center gap-4 px-5 py-4 border-3 border-ink rounded-crudd ${
                    isYou ? 'bg-lime shadow-hard' : 'bg-white'
                  } ${entry.rank <= 3 ? 'shadow-hard' : ''}`}
                >
                  <div className="w-8 flex items-center justify-center shrink-0">
                    <RankBadge rank={entry.rank} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg truncate">
                      {entry.username}
                      {isYou && (
                        <span className="ml-2 text-xs font-black uppercase tracking-wider bg-ink text-cream px-2 py-0.5 rounded-crudd">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-display font-black text-xl tabular-nums shrink-0">
                    {entry.score.toLocaleString()}
                  </div>
                </motion.div>
              );
            })}

            {/* The player's own rank when they fall outside the visible slice. */}
            {showMyRankFooter && me && (
              <>
                <div className="text-center text-ink/40 font-black tracking-widest py-1">···</div>
                <div className="flex items-center gap-4 px-5 py-4 border-3 border-ink rounded-crudd bg-lime shadow-hard">
                  <div className="w-8 flex items-center justify-center shrink-0">
                    <span className="font-display font-black text-lg tabular-nums">{me.rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg truncate">
                      {me.username}
                      <span className="ml-2 text-xs font-black uppercase tracking-wider bg-ink text-cream px-2 py-0.5 rounded-crudd">
                        You
                      </span>
                    </div>
                  </div>
                  <div className="font-display font-black text-xl tabular-nums shrink-0">
                    {me.score.toLocaleString()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
