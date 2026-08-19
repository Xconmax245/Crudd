import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'

const LETTERS = ['C', 'R', 'U', 'D', 'D']

/**
 * Intro / splash animation shown once before the landing page is revealed.
 * Reuses the Hero "blob mascot" (purple, morphing via `animate-blob-pulse`)
 * as the centrepiece, then lifts away like a curtain to reveal the page.
 *
 * Fully reduced-motion aware: springs/pulse are swapped for quick fades and
 * the whole sequence is shortened.
 */
export default function Preloader({ onComplete }: { onComplete: () => void }) {
  const reduce = useReducedMotion()

  useEffect(() => {
    const DISPLAY_MS = reduce ? 800 : 2600
    const t = setTimeout(onComplete, DISPLAY_MS)
    return () => clearTimeout(t)
  }, [onComplete, reduce])

  // Shared transition presets
  const blobIn = reduce
    ? { duration: 0.25 }
    : { type: 'spring' as const, stiffness: 260, damping: 18, delay: 0.1 }

  return (
    <motion.div
      className="preloader fixed inset-0 z-[100] flex flex-col items-center justify-center bg-cream overflow-hidden"
      initial={{ y: 0 }}
      exit={{ y: '-100%' }}
      transition={{ duration: reduce ? 0.4 : 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Dot-grid texture — subtle brutalist background */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="intro-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#16161D" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#intro-dots)" />
        </svg>
      </div>

      {/* Blob mascot + floating stickers */}
      <motion.div
        className="relative flex items-center justify-center mb-12"
        initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -14, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, rotate: 0, opacity: 1 }}
        transition={blobIn}
      >
        <div
          className="relative w-40 h-40 bg-purple border-3 border-ink shadow-hard-lg animate-blob-pulse"
          aria-hidden="true"
          style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
        >
          {/* Eyes */}
          <div className="absolute top-[38%] left-[28%] w-7 h-7 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-ink rounded-full" />
          </div>
          <div className="absolute top-[38%] right-[28%] w-7 h-7 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-ink rounded-full" />
          </div>
          {/* Mouth */}
          <div
            className="absolute bottom-[30%] left-1/2 -translate-x-1/2 w-9 h-4 border-b-3 border-ink"
            style={{ borderRadius: '0 0 20px 20px' }}
          />
        </div>

        {/* Floating stickers */}
        <motion.div
          className="absolute -top-5 -left-10 bg-yellow border-3 border-ink shadow-hard-sm px-2.5 py-1 rounded-crudd font-display font-bold text-xs text-ink -rotate-6 select-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0.2, delay: 0.2 } : { type: 'spring', stiffness: 320, damping: 16, delay: 0.7 }}
        >
          10 players
        </motion.div>
        <motion.div
          className="absolute -bottom-4 -right-10 bg-lime border-3 border-ink shadow-hard-sm px-2.5 py-1 rounded-crudd font-display font-bold text-xs text-ink rotate-3 select-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0.2, delay: 0.25 } : { type: 'spring', stiffness: 320, damping: 16, delay: 0.85 }}
        >
          Live scoring
        </motion.div>
      </motion.div>

      {/* Wordmark */}
      <div className="flex items-end mb-5" role="img" aria-label="CRUDD">
        {LETTERS.map((letter, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="font-display font-bold text-6xl md:text-7xl text-ink tracking-tight"
            initial={reduce ? { opacity: 0 } : { y: 44, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0.2, delay: 0.15 }
                : { type: 'spring', stiffness: 300, damping: 20, delay: 0.5 + i * 0.08 }
            }
          >
            {letter}
          </motion.span>
        ))}
      </div>

      {/* Tagline pill */}
      <motion.div
        className="inline-flex items-center gap-2 border-3 border-ink bg-purple px-4 py-1.5 rounded-pill shadow-hard-sm mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.2 : 0.4, delay: reduce ? 0.3 : 1 }}
      >
        <span className="font-display font-bold text-xs uppercase tracking-widest text-cream">
          Real-time Quiz Battles
        </span>
      </motion.div>

      {/* Loading bar */}
      <div className="w-56 h-3.5 border-3 border-ink rounded-pill bg-cream overflow-hidden shadow-hard-sm">
        <motion.div
          className="h-full bg-purple"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: reduce ? 0.6 : 2.1, ease: 'easeInOut', delay: reduce ? 0 : 0.3 }}
        />
      </div>

      {/* Curtain edge accent — reads as the bottom lip of the lifting panel */}
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-lime border-t-3 border-ink" aria-hidden="true" />
    </motion.div>
  )
}
