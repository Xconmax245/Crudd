import { useEffect, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import Lenis from 'lenis'

import Preloader      from '@/components/Preloader'
import Nav            from '@/components/Nav'
import Hero           from '@/components/Hero'
import TrustStrip     from '@/components/TrustStrip'
import BoringVsCrudd  from '@/components/BoringVsCrudd'
import HowItWorks     from '@/components/HowItWorks'
import MatchPreview   from '@/components/MatchPreview'
import QuestionBanks  from '@/components/QuestionBanks'
import WhyPeoplePlay  from '@/components/WhyPeoplePlay'
import FAQ            from '@/components/FAQ'
import FinalCTA       from '@/components/FinalCTA'
import Footer         from '@/components/Footer'

import { useKonamiCode } from '@/hooks/useKonamiCode'
import { motion } from 'motion/react'

function KonamiToast() {
  const isTriggered = useKonamiCode()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isTriggered) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isTriggered])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-cream border-3 border-ink rounded-crudd shadow-[8px_8px_0px_#0A0A0A] p-4 text-ink font-bold"
        >
          🕹️ You found it. Built by Ademola — <a href="https://x.com/rynyxxx" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink/70">@rynyxxx</a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)

  // Lock body scroll while the intro is on screen so the page can't be
  // scrolled behind the curtain. Released the moment the intro completes.
  useEffect(() => {
    document.body.style.overflow = loading ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [loading])

  useEffect(() => {
    // Wait for the intro to finish before wiring smooth scroll — otherwise
    // Lenis fights the locked body. Also respect reduced-motion.
    if (loading) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const lenis = new Lenis({
      lerp:     0.08,
      smoothWheel: true,
    })

    let rafId: number
    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [loading])

  return (
    <>
      <AnimatePresence>
        {loading && <Preloader onComplete={() => setLoading(false)} />}
      </AnimatePresence>
      <KonamiToast />

      <Nav />
      <main id="main-content">
        <Hero />

        <TrustStrip />
        <BoringVsCrudd />
        <HowItWorks />
        <MatchPreview />
        <QuestionBanks />
        <WhyPeoplePlay />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
