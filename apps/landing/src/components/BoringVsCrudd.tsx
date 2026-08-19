import { XCircle, CheckCircle } from 'lucide-react'
import { motion } from 'motion/react'

const problems = [
  'You finish alone, nobody cares',
  'Score appears after 48 hours',
  'One correct answer, no tension',
  'Share results? Nobody opens the link',
  'Feels like homework, not a game',
]

const solutions = [
  'Compete live against up to 9 others — 10 total including host',
  'Leaderboard updates after every single question',
  'Speed + accuracy = bragging rights',
  'Share a link in WhatsApp — friends join in seconds',
  'Game-show energy, not classroom energy',
]

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function BoringVsCrudd() {
  return (
    <section className="section-padding py-24 px-6">
      <div className="container mx-auto max-w-7xl">
        {/* Section heading */}
        <div className="section-title title-gap text-center mb-14">
          <p className="text-subheadline font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            The difference
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-ink">
            Normal quizzes are{' '}
            <span className="text-ink/40 line-through decoration-pink decoration-4">boring</span>.
            <br />
            CRUDD is not.
          </h2>
        </div>

        <div className="grid-2-col grid md:grid-cols-2 gap-6">
          {/* Problem card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="card-problem bg-ink border-3 border-ink rounded-crudd-lg shadow-hard-lg p-8"
          >
            <div className="ps-card_header flex items-center gap-3 mb-6">
              <div className="ps-icon ps-icon--problem w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <XCircle size={22} className="text-pink" />
              </div>
              <div>
                <p className="ps-card_subtitle font-display font-bold text-xs uppercase tracking-widest text-white/40 mb-0.5">
                  The old way
                </p>
                <h3 className="ps-card_title font-display font-bold text-xl text-cream">
                  Regular quiz apps
                </h3>
              </div>
            </div>
            <ul className="ps-card_list flex flex-col gap-3">
              {problems.map((p) => (
                <li key={p} className="ps-card_item flex items-start gap-3">
                  <XCircle size={16} className="text-pink flex-shrink-0 mt-0.5" />
                  <span className="ps-card_text font-body text-sm text-cream/60 leading-snug">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
            <div className="ps-divider border-t border-white/10 my-6" />
            <p className="ps-card_emphasis font-display font-bold text-lg text-cream/30 italic">
              "Great quiz! ...anyone there?"
            </p>
          </motion.div>

          {/* Solution card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.12 }}
            className="card-solution bg-purple border-3 border-ink rounded-crudd-lg shadow-hard-lg p-8 relative overflow-hidden"
          >
            {/* background pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.5" fill="#FFF4E0" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
            </div>

            <div className="ps-card_header relative flex items-center gap-3 mb-6">
              <div className="ps-icon ps-icon--solution w-10 h-10 rounded-full bg-cream/20 flex items-center justify-center">
                <CheckCircle size={22} className="text-lime" />
              </div>
              <div>
                <p className="ps-card_subtitle font-display font-bold text-xs uppercase tracking-widest text-cream/60 mb-0.5">
                  The CRUDD way
                </p>
                <h3 className="ps-card_title font-display font-bold text-xl text-cream">
                  Real-time battle
                </h3>
              </div>
            </div>
            <ul className="ps-card_list relative flex flex-col gap-3">
              {solutions.map((s) => (
                <li key={s} className="ps-card_item flex items-start gap-3">
                  <CheckCircle size={16} className="text-lime flex-shrink-0 mt-0.5" />
                  <span className="ps-card_text font-body text-sm text-cream leading-snug font-semibold">
                    {s}
                  </span>
                </li>
              ))}
            </ul>
            <div className="ps-divider border-t border-cream/20 my-6" />
            <p className="ps-card_emphasis relative font-display font-bold text-lg text-cream italic">
              "Loser buys coffee. Final answer."
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
