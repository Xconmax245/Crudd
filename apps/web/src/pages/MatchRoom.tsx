

import { useParams, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Users, Clock, Crown, Check, X, Wifi, WifiOff, Trophy, Target, Zap } from 'lucide-react';
import type { LeaderboardEntry, PlayerMatchStats } from '@crudd/shared';

import { useMatchEngine } from '../hooks/useMatchEngine';
import { useSyncedTimer } from '../hooks/useSyncedTimer';
import { getUsername } from '../lib/session';
import LoadingBlob from '../components/LoadingBlob';
import { useTitle } from '../hooks/useTitle';

// --- Avatar Assignment -----------------------------------------------------

function getAvatarIndex(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 7;
}

function PlayerAvatar({ sessionId, className = "w-8 h-8" }: { sessionId: string; className?: string }) {
  const index = getAvatarIndex(sessionId);
  return (
    <img
      src={`/avatars/avatar-${index}.jpg`}
      alt="Avatar"
      className={`${className} object-cover rounded-full border-2 border-ink bg-cream shrink-0`}
    />
  );
}


// Full, static class strings (no interpolation) so Tailwind's JIT keeps them.
const OPTION_STYLES = [
  { hover: 'hover:bg-cyan', picked: 'bg-cyan' },
  { hover: 'hover:bg-pink', picked: 'bg-pink' },
  { hover: 'hover:bg-yellow', picked: 'bg-yellow' },
  { hover: 'hover:bg-lime', picked: 'bg-lime' },
  { hover: 'hover:bg-orange', picked: 'bg-orange' },
  { hover: 'hover:bg-purple hover:text-cream', picked: 'bg-purple text-cream' },
];
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];


export default function MatchRoom() {
  useTitle('Live Match');
  const { slug } = useParams();
  const navigate = useNavigate();
  const engine = useMatchEngine(slug!);

  // A player must set a username before entering; bounce back to the join page.
  useEffect(() => {
    if (!getUsername()) navigate(`/challenge/${slug}`);
  }, [slug, navigate]);

  const { connection, lobby, countdown, question, reveal, ended, cancelled, error } = engine;

  // A lobby cancelled before it starts (e.g. the host left) is terminal.
  if (cancelled) {
    return (
      <NoticeCard
        title="Match cancelled"
        message={cancelled}
        actionLabel="Browse Challenges"
        onAction={() => navigate('/browse')}
      />
    );
  }

  if (error && !lobby) {
    return (
      <NoticeCard
        title="Can't join match"
        message={error}
        actionLabel="Back to Challenge"
        onAction={() => navigate(`/challenge/${slug}`)}
      />
    );
  }

  if (!lobby && connection !== 'disconnected') return <LoadingBlob text="Joining Match" />;

  return (
    <div className="min-h-screen pb-20 flex flex-col">
      <ConnectionBar connection={connection} />

      <AnimatePresence mode="wait">
        {ended ? (
          <ResultsView
            key="results"
            leaderboard={ended.leaderboard}
            stats={ended.stats}
            sessionId={engine.sessionId}
            isHost={engine.isHost}
            onRematch={() => navigate(`/challenge/${slug}`)}
            onExit={() => navigate('/browse')}
          />
        ) : reveal ? (
          <RevealView key={`reveal-${reveal.position}`} engine={engine} />
        ) : countdown ? (
          <CountdownView key="countdown" countdown={countdown} />
        ) : question ? (
          <QuestionView key={`q-${question.position}`} engine={engine} />
        ) : (
          <LobbyView key="lobby" engine={engine} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Shared notice / cancelled screen --------------------------------------

function NoticeCard({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white border-3 border-ink rounded-crudd p-12 shadow-hard max-w-md w-full">
        <div className="w-16 h-16 bg-pink rounded-full border-3 border-ink mx-auto mb-6 flex items-center justify-center">
          <X size={28} />
        </div>
        <h1 className="text-2xl font-display font-black mb-3">{title}</h1>
        <p className="opacity-70 font-medium mb-8">{message}</p>
        <button
          onClick={onAction}
          className="w-full bg-cream text-ink font-bold py-3 rounded-crudd border-3 border-ink hover:bg-ink/5 transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

// --- Countdown (STARTING phase) --------------------------------------------

function CountdownView({ countdown }: { countdown: { startsAt: number } }) {
  const reduceMotion = useReducedMotion();
  const remaining = useSyncedTimer(countdown.startsAt);
  // Show "Go!" the instant the clock hits zero, then the question replaces this.
  const label = remaining <= 0 ? 'Go!' : String(remaining);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center text-center px-6"
    >
      <p className="text-sm font-bold uppercase tracking-widest opacity-50 mb-6">Get ready…</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-40 h-40 rounded-full bg-purple text-cream border-3 border-ink shadow-hard flex items-center justify-center font-display font-black text-7xl"
        >
          {label}
        </motion.div>
      </AnimatePresence>
    </motion.main>
  );
}


// ---------------------------------------------------------------------------

function ConnectionBar({ connection }: { connection: string }) {
  if (connection === 'connected') return null;
  const disconnected = connection === 'disconnected';
  return (
    <div
      className={`w-full text-center py-2 text-sm font-bold border-b-3 border-ink flex items-center justify-center gap-2 ${
        disconnected ? 'bg-pink text-ink' : 'bg-yellow text-ink'
      }`}
    >
      {disconnected ? <WifiOff size={16} /> : <Wifi size={16} />}
      {disconnected ? 'Reconnecting…' : 'Connecting…'}
    </div>
  );
}

// --- Lobby -----------------------------------------------------------------

function LobbyView({ engine }: { engine: ReturnType<typeof useMatchEngine> }) {
  const { lobby, isHost, start } = engine;
  const reduceMotion = useReducedMotion();
  if (!lobby) return null;

  const canStart = isHost && lobby.players.length >= 1;

  return (
    <motion.main
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-6 max-w-2xl mt-10 flex-1 w-full"
    >

      <div className="text-center mb-8">
        <div className="inline-block px-3 py-1 bg-purple text-cream text-xs font-bold uppercase tracking-widest rounded-crudd border-2 border-ink mb-4">
          Lobby
        </div>
        <h1 className="text-4xl font-display font-black mb-2">{lobby.bankTitle}</h1>
        <div className="flex justify-center gap-6 text-sm font-bold opacity-70">
          <span className="flex items-center gap-1"><Users size={16} /> {lobby.players.length}/{lobby.maxPlayers}</span>
          <span className="flex items-center gap-1"><Clock size={16} /> {lobby.timerSeconds}s</span>
          <span>{lobby.questionCount} questions</span>
        </div>
      </div>

      <div className="bg-white border-3 border-ink rounded-crudd shadow-hard p-6 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-4">Players</h2>
        <div className="space-y-3">
          <AnimatePresence>
            {lobby.players.map((p) => (
              <motion.div
                key={p.sessionId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between bg-cream border-2 border-ink rounded-crudd px-4 py-3"
              >
                <div className="flex items-center gap-3 font-bold">
                  <div className="relative">
                    <PlayerAvatar sessionId={p.sessionId} className="w-10 h-10" />
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-ink ${p.connected ? 'bg-lime' : 'bg-ink/20'}`}
                    />
                  </div>
                  <span className="text-lg">{p.username || 'Guest'}</span>
                </div>
                {p.role === 'HOST' && (
                  <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-purple">
                    <Crown size={14} /> Host
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {isHost ? (
        <button
          onClick={start}
          disabled={!canStart}
          className="w-full bg-purple text-cream font-display font-black text-xl py-5 rounded-crudd border-3 border-ink shadow-hard hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#0A0A0A] transition-all disabled:opacity-50"
        >
          Start Match
        </button>
      ) : (
        <div className="text-center font-bold opacity-60 py-5 animate-pulse">
          Waiting for the host to start…
        </div>
      )}
    </motion.main>
  );
}

// --- Question --------------------------------------------------------------

function QuestionView({ engine }: { engine: ReturnType<typeof useMatchEngine> }) {
  const { question, selectedIndex, answerRejected, submit } = engine;
  const reduceMotion = useReducedMotion();
  const remaining = useSyncedTimer(question?.endsAt ?? null);
  if (!question) return null;

  const totalMs = question.timerSeconds;
  const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
  const locked = selectedIndex !== null;

  return (
    <motion.main
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
      className="container mx-auto px-6 max-w-3xl mt-8 flex-1 w-full"
    >

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold uppercase tracking-widest opacity-50">
          Question {question.position + 1} / {question.totalQuestions}
        </div>
        <div
          className={`w-14 h-14 rounded-full border-3 border-ink flex items-center justify-center font-display font-black text-2xl ${
            remaining <= 3 ? 'bg-pink text-ink animate-pulse' : 'bg-yellow text-ink'
          }`}
        >
          {remaining}
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full h-3 border-3 border-ink rounded-full bg-cream overflow-hidden mb-8">
        <motion.div
          className="h-full bg-cyan"
          animate={{ width: `${pct}%` }}
          transition={{ ease: 'linear', duration: 0.2 }}
        />
      </div>

      <div className="bg-white border-3 border-ink rounded-crudd shadow-hard p-8 mb-8">
        <h1 className="text-2xl md:text-3xl font-display font-black leading-tight">{question.questionText}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((opt, i) => {
          const isPicked = selectedIndex === i;
          const style = OPTION_STYLES[i % OPTION_STYLES.length];
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => submit(i)}
              className={`text-left p-5 rounded-crudd border-3 border-ink font-bold text-lg flex items-center gap-4 transition-all disabled:cursor-not-allowed ${
                isPicked
                  ? `${style.picked} shadow-[2px_2px_0px_#0A0A0A] translate-y-[-2px]`
                  : locked
                    ? 'bg-cream opacity-50'
                    : `bg-cream ${style.hover} hover:shadow-hard hover:translate-y-[-2px]`
              }`}
            >
              <span className="w-9 h-9 shrink-0 rounded-full bg-ink text-cream flex items-center justify-center font-display font-black">
                {OPTION_LETTERS[i]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      <div className="text-center mt-8 font-bold">
        {answerRejected ? (
          <span className="text-red-500">{answerRejected}</span>
        ) : locked ? (
          <span className="text-lime-700 flex items-center justify-center gap-2">
            <Check size={18} /> Answer locked in — waiting for others…
          </span>
        ) : (
          <span className="opacity-50">Tap an answer. Faster = more points.</span>
        )}
      </div>
    </motion.main>
  );
}

// --- Reveal ----------------------------------------------------------------

function RevealView({ engine }: { engine: ReturnType<typeof useMatchEngine> }) {
  const { reveal, isHost, next, sessionId } = engine;
  const reduceMotion = useReducedMotion();
  if (!reveal) return null;

  const myResult = reveal.results.find((r) => r.sessionId === sessionId);
  // Use the reveal payload's own options + my recorded pick so this renders
  // correctly even for a client that reconnected during the REVEAL phase.
  const options = reveal.options;
  const mySelectedIndex = myResult?.selectedIndex ?? null;


  return (
    <motion.main
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
      className="container mx-auto px-6 max-w-3xl mt-8 flex-1 w-full"
    >

      <div className="text-center mb-6">
        {myResult?.isCorrect ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime text-ink font-display font-black text-xl rounded-crudd border-3 border-ink">
            <Check size={22} /> Correct! +{myResult.pointsAwarded}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink text-ink font-display font-black text-xl rounded-crudd border-3 border-ink">
            <X size={22} /> {myResult?.selectedIndex == null ? 'No answer' : 'Incorrect'}
          </div>
        )}
      </div>

      {options.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {options.map((opt, i) => {
            const isCorrect = i === reveal.correctIndex;
            const isMine = mySelectedIndex === i;

            return (
              <div
                key={i}
                className={`text-left p-5 rounded-crudd border-3 border-ink font-bold text-lg flex items-center gap-4 ${
                  isCorrect ? 'bg-lime text-ink shadow-hard' : isMine ? 'bg-pink text-ink' : 'bg-cream opacity-60'
                }`}
              >
                <span className="w-9 h-9 shrink-0 rounded-full bg-ink text-cream flex items-center justify-center font-display font-black">
                  {OPTION_LETTERS[i]}
                </span>
                {opt}
                {isCorrect && <Check size={20} className="ml-auto" />}
              </div>
            );
          })}
        </div>
      )}

      <Leaderboard entries={reveal.leaderboard} sessionId={sessionId} compact />

      <div className="mt-8">
        {isHost ? (
          <button
            onClick={next}
            className="w-full bg-purple text-cream font-display font-black text-xl py-5 rounded-crudd border-3 border-ink shadow-hard hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#0A0A0A] transition-all"
          >
            {reveal.isLastQuestion ? 'See Final Results' : 'Next Question'}
          </button>
        ) : (
          <div className="text-center font-bold opacity-60 py-5 animate-pulse">
            Waiting for the host to continue…
          </div>
        )}
      </div>
    </motion.main>
  );
}

// --- Results ---------------------------------------------------------------

function ResultsView({
  leaderboard,
  stats,
  sessionId,
  isHost,
  onRematch,
  onExit,
}: {
  leaderboard: LeaderboardEntry[];
  stats: PlayerMatchStats[];
  sessionId: string;
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<'scores' | 'stats'>('scores');
  const winner = leaderboard[0];
  const iWon = winner?.sessionId === sessionId;

  return (
    <motion.main
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="container mx-auto px-6 max-w-2xl mt-10 flex-1 w-full"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { rotate: -8, scale: 0.8 }}
          animate={reduceMotion ? { opacity: 1 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-20 h-20 bg-yellow rounded-full border-3 border-ink mx-auto mb-4 flex items-center justify-center shadow-hard"
        >
          <Trophy size={36} />
        </motion.div>
        <h1 className="text-4xl font-display font-black mb-1">Match Over</h1>
        {winner && (
          <p className="text-xl font-bold opacity-70">
            {iWon ? 'You win! 🎉' : `${winner.username || 'Guest'} wins!`}
          </p>
        )}
      </div>

      {/* Scores / Stats toggle */}
      <div className="flex gap-2 mb-4">
        {(['scores', 'stats'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-crudd border-3 border-ink font-bold uppercase text-sm tracking-wider transition-colors ${
              tab === t ? 'bg-ink text-cream' : 'bg-cream hover:bg-ink/5'
            }`}
          >
            {t === 'scores' ? 'Scores' : 'Stats'}
          </button>
        ))}
      </div>

      {tab === 'scores' ? (
        <Leaderboard entries={leaderboard} sessionId={sessionId} />
      ) : (
        <StatsBoard stats={stats} sessionId={sessionId} />
      )}

      <div className="mt-8 space-y-3">
        {isHost && (
          <button
            onClick={onRematch}
            className="w-full bg-purple text-cream font-display font-black text-xl py-4 rounded-crudd border-3 border-ink shadow-hard hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#0A0A0A] transition-all"
          >
            Rematch
          </button>
        )}
        <button
          onClick={onExit}
          className="w-full bg-cream text-ink font-bold py-4 rounded-crudd border-3 border-ink hover:bg-ink/5 transition-colors"
        >
          Back to Browse
        </button>
      </div>
    </motion.main>
  );
}

// --- Per-player stats board (final screen) ---------------------------------

function StatsBoard({ stats, sessionId }: { stats: PlayerMatchStats[]; sessionId: string }) {
  return (
    <div className="bg-white border-3 border-ink rounded-crudd shadow-hard p-6 space-y-2">
      {stats.map((s) => {
        const isMe = s.sessionId === sessionId;
        return (
          <div
            key={s.sessionId}
            className={`border-2 border-ink rounded-crudd px-4 py-3 ${isMe ? 'bg-purple text-cream' : 'bg-cream'}`}
          >
            <div className="flex items-center justify-between font-bold mb-2">
              <div className="flex items-center gap-2 truncate">
                <PlayerAvatar sessionId={s.sessionId} className="w-8 h-8" />
                <span className="truncate">{s.username || 'Guest'}{isMe && ' (you)'}</span>
              </div>
              <span className="font-display font-black text-xl">{s.score}</span>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium opacity-80">
              <span className="flex items-center gap-1">
                <Target size={14} /> {s.correctCount}/{s.totalQuestions} ({s.accuracy}%)
              </span>
              <span className="flex items-center gap-1">
                <Zap size={14} /> {s.avgResponseMs > 0 ? `${(s.avgResponseMs / 1000).toFixed(1)}s avg` : '—'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// --- Shared leaderboard ----------------------------------------------------

function Leaderboard({
  entries,
  sessionId,
  compact = false,
}: {
  entries: LeaderboardEntry[];
  sessionId: string;
  compact?: boolean;
}) {
  const medals = ['bg-yellow', 'bg-ink/10', 'bg-orange'];
  const reduceMotion = useReducedMotion();
  return (
    <div className={`bg-white border-3 border-ink rounded-crudd shadow-hard p-6 ${compact ? '' : 'p-8'}`}>
      {!compact && <h2 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-4">Leaderboard</h2>}
      <div className="space-y-2">
        <AnimatePresence>
          {entries.map((e) => {
            const isMe = e.sessionId === sessionId;
            return (
              <motion.div
                key={e.sessionId}
                layout={!reduceMotion}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}

                className={`flex items-center gap-3 border-2 border-ink rounded-crudd px-4 py-3 font-bold ${
                  isMe ? 'bg-purple text-cream' : 'bg-cream'
                }`}
              >
                <span
                  className={`w-8 h-8 shrink-0 rounded-full border-2 border-ink flex items-center justify-center font-display font-black text-sm ${
                    e.rank <= 3 ? medals[e.rank - 1] : 'bg-cream'
                  } ${isMe && e.rank > 3 ? 'text-ink' : ''}`}
                >
                  {e.rank}
                </span>
                <PlayerAvatar sessionId={e.sessionId} className="w-8 h-8" />
                <span className="flex-1 truncate">{e.username || 'Guest'}{isMe && ' (you)'}</span>
                <span className="font-display font-black">{e.score}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
