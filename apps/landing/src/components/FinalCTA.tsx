import { useEffect, useRef } from 'react'
import { ArrowRight, Link } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null)
  const headRef    = useRef<HTMLHeadingElement>(null)
  const ctaRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || !sectionRef.current) return

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start:   'top 75%',
      },
      defaults: { ease: 'power3.out' },
    })

    tl.fromTo(headRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
      .fromTo(ctaRef.current,  { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, '-=0.3')
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative py-28 px-6 bg-purple overflow-hidden"
    >
      {/* Background dot pattern */}
      <div className="absolute inset-0 opacity-15 pointer-events-none" aria-hidden="true">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="cta-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#FFF4E0" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cta-dots)" />
        </svg>
      </div>

      {/* Decorative corner badges */}
      <div className="absolute top-8 left-8 bg-yellow border-3 border-ink px-3 py-1.5 rounded-crudd shadow-hard font-display font-bold text-sm text-ink -rotate-6 hidden md:block" aria-hidden="true">
        10 spots. 1 winner.
      </div>
      <div className="absolute bottom-8 right-8 bg-lime border-3 border-ink px-3 py-1.5 rounded-crudd shadow-hard font-display font-bold text-sm text-ink rotate-3 hidden md:block" aria-hidden="true">
        No mercy.
      </div>

      <div className="relative container mx-auto max-w-3xl text-center">
        <h2
          ref={headRef}
          className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-cream leading-tight tracking-tight mb-6"
        >
          Ready to settle this?
        </h2>
        <p className="font-body text-lg text-cream/70 max-w-xl mx-auto mb-10">
          Create a challenge in under a minute. Share the link. Find out who actually knows their stuff.
        </p>

        <div ref={ctaRef} className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={import.meta.env.VITE_APP_URL || "https://crudd-web.vercel.app"}
            data-destination="browse"
            className="press group flex items-center gap-2 bg-cream text-ink border-3 border-ink shadow-hard px-7 py-4 rounded-crudd font-display font-bold text-lg hover:shadow-hard-sm hover:translate-x-[3px] hover:translate-y-[3px]"
          >
            Start a Challenge
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform duration-150" />
          </a>
          <a
            href={import.meta.env.VITE_APP_URL || "https://crudd-web.vercel.app"}
            data-destination="join"
            className="flex items-center gap-2 bg-purple text-cream border-3 border-cream/30 px-7 py-4 rounded-crudd font-display font-bold text-lg hover:bg-white/10 active:bg-white/20 transition-colors duration-150"
          >
            <Link size={20} />
            Join a Match
          </a>

        </div>
      </div>
    </section>
  )
}
