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
