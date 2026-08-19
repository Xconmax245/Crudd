import { Timer, Crown, Circle, ArrowRight, CheckCircle, Zap } from 'lucide-react'

const leaderboard = [
  { rank: 1, name: 'zara_99',   score: 1840, color: 'bg-yellow',  delta: '+180' },
  { rank: 2, name: 'dev_mode',  score: 1620, color: 'bg-lime',    delta: '+160' },
  { rank: 3, name: 'priya_k',   score: 1340, color: 'bg-cyan',    delta: '+140' },
  { rank: 4, name: 'mrchills',  score:  980, color: 'bg-orange',  delta: '+100' },
  { rank: 5, name: 'lostbrain', score:  540, color: 'bg-pink',    delta: '+0'   },
]

const question = {
  text:    'Which planet has the most moons in our solar system?',
  options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
  correct: 1, // Saturn — revealed only after time expires
}

/**
 * The competitive loop steps — this communicates CRUDD's actual gameplay model,
 * not a generic quiz dashboard.
 */
const loopSteps = [
  { label: 'Question',      icon: Circle,       color: 'bg-purple text-cream',  desc: 'Same question, all players' },
  { label: 'Timer',         icon: Timer,        color: 'bg-orange text-ink',    desc: '5–30 second window' },
  { label: 'Answer',        icon: CheckCircle,  color: 'bg-lime text-ink',      desc: 'Server receives & timestamps' },
  { label: 'Speed + Score', icon: Zap,          color: 'bg-yellow text-ink',    desc: 'Faster correct = more points' },
  { label: 'Leaderboard',   icon: Crown,        color: 'bg-pink text-ink',      desc: 'Updates after every question' },
]

export default function MatchPreview() {
  return (
    <section className="py-24 px-6 overflow-hidden">
      <div className="container mx-auto max-w-7xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-10">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            Live match preview
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-ink">
            This is what a CRUDD round looks like
          </h2>
        </div>

        {/* ─── Competitive Loop Diagram ─── */}
        <div
          className="mb-10 bg-ink rounded-crudd-lg border-3 border-ink shadow-hard p-6 overflow-x-auto"
          aria-label="CRUDD competitive round loop"
        >
          <p className="font-display font-bold text-xs text-cream/40 uppercase tracking-widest mb-5 text-center">
            One round — repeated for every question
          </p>
          <div className="flex items-start justify-center gap-2 min-w-[580px]">
            {loopSteps.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="flex items-start gap-2">
                  {/* Step */}
                  <div className="flex flex-col items-center gap-2 w-24">
                    <div className={`w-10 h-10 ${step.color} border-3 border-white/20 shadow-hard-sm rounded-crudd flex items-center justify-center`}>
                      <Icon size={16} strokeWidth={2.5} />
                    </div>
                    <span className="font-display font-bold text-xs text-cream text-center leading-tight">
                      {step.label}
                    </span>
                    <span className="font-body text-xs text-cream/40 text-center leading-snug">
                      {step.desc}
                    </span>
                  </div>

                  {/* Arrow — not after last */}
                  {i < loopSteps.length - 1 && (
                    <ArrowRight size={16} className="text-cream/20 mt-3 flex-shrink-0" />
                  )}
                </div>
              )
            })}

            {/* Loop back indicator */}
            <div className="flex items-start gap-2">
              <ArrowRight size={16} className="text-cream/20 mt-3 flex-shrink-0" />
              <div className="flex flex-col items-center gap-2 w-24">
                <div className="w-10 h-10 bg-white/5 border-3 border-white/10 rounded-crudd flex items-center justify-center">
                  <span className="font-display font-bold text-xs text-cream/40">+1</span>
                </div>
                <span className="font-display font-bold text-xs text-cream/40 text-center leading-tight">
                  Next question
                </span>
                <span className="font-body text-xs text-cream/30 text-center leading-snug">
                  Until bank ends
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Snapshot: mid-round ─── */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Question card — shows the state DURING a live question */}
          <div className="match-preview_question bg-ink border-3 border-ink shadow-hard-lg rounded-crudd-lg overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b-3 border-white/10 bg-white/5">
              <span className="font-display font-bold text-xs text-cream/60 uppercase tracking-widest">
                Question 7 / 10
              </span>
              {/* Timer — orange = urgency */}
              <div className="flex items-center gap-1.5 bg-orange border-2 border-ink px-3 py-1 rounded-pill shadow-hard-sm">
                <Timer size={13} className="text-ink" strokeWidth={3} />
                <span className="font-display font-bold text-sm text-ink">4s</span>
              </div>
            </div>

            {/* Question text */}
            <div className="p-6">
              <p className="font-display font-bold text-lg text-cream leading-snug mb-6">
                {question.text}
              </p>

              {/* Answer options — correct only revealed AFTER time, not before */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {question.options.map((opt, i) => (
                  <button
                    key={opt}
                    disabled
                    aria-label={opt}
                    className={[
                      'match-preview_option px-4 py-3 rounded-crudd border-3 border-ink font-display font-bold text-sm text-left',
                      i === question.correct
                        ? 'bg-lime text-ink shadow-hard-sm'   // correct — shown only post-round
                        : 'bg-white/5 text-cream/60',
                    ].join(' ')}
                  >
                    <span className="block text-xs font-body font-semibold opacity-50 mb-0.5 uppercase">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>

              {/* Post-round state callout */}
              <div className="flex items-start gap-2 p-3 bg-white/5 rounded-crudd border border-white/10">
                <Circle size={8} className="fill-lime text-lime mt-1 flex-shrink-0" />
                <p className="font-body text-xs text-cream/50 leading-snug">
                  <span className="text-lime font-semibold">Round resolved.</span>{' '}
                  Correct answer revealed only after time expires — never sent to clients beforehand.
                  Scoring: faster correct answers earn more points.
                </p>
              </div>
            </div>
          </div>

          {/* Leaderboard — shows live state after round 7 with per-question delta */}
          <div className="match-preview_leaderboard bg-cream border-3 border-ink shadow-hard-lg rounded-crudd-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3 bg-purple border-b-3 border-ink">
              <Crown size={16} className="text-yellow fill-yellow" />
              <span className="font-display font-bold text-sm text-cream uppercase tracking-widest">
                Live Leaderboard
              </span>
              <span className="ml-auto font-body text-xs text-cream/60 font-semibold">
                After Q7
              </span>
            </div>

            {/* Rows */}
            <ol className="flex flex-col">
              {leaderboard.map((player) => (
                <li
                  key={player.name}
                  className="match-preview_row flex items-center gap-3 px-5 py-3 border-b-3 border-ink last:border-b-0"
                >
                  {/* Rank */}
                  <span className="font-display font-bold text-xl text-ink/25 w-5 text-center flex-shrink-0">
                    {player.rank}
                  </span>

                  {/* Avatar */}
                  <div className={`w-8 h-8 ${player.color} border-3 border-ink rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className="font-display font-bold text-xs text-ink">
                      {player.name[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Name */}
                  <span className="font-body font-semibold text-sm text-ink flex-1 truncate">
                    {player.name}
                    {player.rank === 1 && (
                      <Crown size={11} className="inline ml-1.5 text-yellow fill-yellow" />
                    )}
                  </span>

                  {/* Points earned this round */}
                  <span className={`font-display font-bold text-xs px-2 py-0.5 rounded-pill border border-ink ${player.delta === '+0' ? 'text-ink/30 bg-ink/5' : 'text-ink bg-lime'}`}>
                    {player.delta}
                  </span>

                  {/* Total score */}
                  <span className="font-display font-bold text-base text-ink tabular-nums w-14 text-right">
                    {player.score.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>

            {/* Footer */}
            <div className="px-5 py-3 bg-ink/5 border-t-3 border-ink">
              <p className="font-body text-xs text-ink/50 font-semibold text-center">
                Updates after every question · Speed + correctness determines rank
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
