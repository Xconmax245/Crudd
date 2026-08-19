import { useEffect, useRef } from 'react'
import { ArrowRight, Users, Timer, Trophy, Link } from 'lucide-react'
import { gsap } from 'gsap'

const trustBullets = [
  { icon: Users,  text: 'Up to 10 players per match' },
  { icon: Timer,  text: 'Server-authoritative timing — no cheating' },
  { icon: Trophy, text: 'Live leaderboard after every question' },
]

/** Floating badge sticker — rotated, neo-brutalist label */
function Sticker({
  children,
  color,
  rotate,
  className = '',
  style,
}: {
  children: React.ReactNode
  color: string
  rotate: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={style}
      className={`absolute px-3 py-1.5 border-3 border-ink shadow-hard font-display font-bold text-sm rounded-crudd text-ink select-none ${color} ${rotate} ${className}`}
    >
      {children}
    </div>
  )
}


export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const subRef      = useRef<HTMLParagraphElement>(null)
  const ctaRef      = useRef<HTMLDivElement>(null)
  const bulletsRef  = useRef<HTMLUListElement>(null)
  const artRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    tl.fromTo(
      headlineRef.current,
      { y: 48, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7 },
    )
    .fromTo(
      subRef.current,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5 },
      '-=0.35',
    )
    .fromTo(
      ctaRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4 },
      '-=0.25',
    )
    .fromTo(
      bulletsRef.current?.children ? Array.from(bulletsRef.current.children) : [],
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.4, stagger: 0.1 },
      '-=0.2',
    )
    .fromTo(
      artRef.current,
      { scale: 0.9, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' },
      '-=0.5',
    )
  }, [])

  return (
    <section className="hero min-h-screen flex items-center pt-20 pb-16 overflow-hidden">
      <div className="hero_content container mx-auto px-6 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Left — text */}
          <div className="hero_text-group">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 border-3 border-ink bg-yellow px-3 py-1 rounded-pill shadow-hard-sm mb-6">
              <span className="font-display font-bold text-xs uppercase tracking-widest text-ink">
                Real-time Quiz Battles
              </span>
            </div>

            {/* Headline */}
            <h1
              ref={headlineRef}
              className="hero_heading font-display font-bold text-5xl md:text-6xl lg:text-7xl text-ink leading-[1.05] tracking-tight mb-6"
            >
              You{' '}
              <span className="hero_heading-highlight relative inline-block">
                <span className="relative z-10 text-purple">think</span>
                {/* underline squiggle */}
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 160 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 C40 2, 80 12, 120 4 S155 8 158 6"
                    stroke="#7C5CFC"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>{' '}
              you know it.{' '}
              <span className="text-pink">Prove it.</span>
            </h1>

            {/* Subhead */}
            <p
              ref={subRef}
              className="hero_body font-body text-lg md:text-xl text-ink/70 max-w-lg mb-8 leading-relaxed"
            >
              Turn any question bank into a timed multiplayer battle. Share a
              link. Up to 10 compete live — including you. One winner. Zero mercy.
            </p>

            {/* CTA group */}
            <div ref={ctaRef} className="hero_cta-group flex flex-wrap gap-3 mb-10">
              <a
                href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
                data-destination="browse"
                className="btn-primary press group flex items-center gap-2 bg-purple text-cream border-3 border-ink shadow-hard px-6 py-3.5 rounded-crudd font-display font-bold text-base hover:shadow-hard-sm hover:translate-x-[3px] hover:translate-y-[3px]"
              >
                Start a Challenge
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-150" />
              </a>
              <a
                href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
                data-destination="join"
                className="btn-secondary press flex items-center gap-2 bg-cream text-ink border-3 border-ink shadow-hard px-6 py-3.5 rounded-crudd font-display font-bold text-base hover:shadow-hard-sm hover:translate-x-[3px] hover:translate-y-[3px]"
              >
                <Link size={18} />
                Join a Match
              </a>

            </div>

            {/* Trust bullets */}
            <ul ref={bulletsRef} className="hero_bullets flex flex-col gap-2.5">
              {trustBullets.map(({ icon: Icon, text }) => (
                <li key={text} className="hero_bullet flex items-center gap-2.5">
                  <span className="hero_bullet-icon flex-shrink-0 w-6 h-6 rounded-full bg-lime border-3 border-ink flex items-center justify-center">
                    <Icon size={12} className="text-ink" strokeWidth={3} />
                  </span>
                  <span className="hero_bullet-text font-body text-sm font-semibold text-ink/80">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — visual art */}
          <div ref={artRef} className="relative flex items-center justify-center min-h-[420px]">
            {/* Blob mascot */}
            <div
              className="relative w-56 h-56 bg-purple border-3 border-ink shadow-hard-lg animate-blob-pulse"
              aria-hidden="true"
              style={{ borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }}
            >

              {/* Eyes */}
              <div className="absolute top-[38%] left-[28%] w-8 h-8 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-ink rounded-full" />
              </div>
              <div className="absolute top-[38%] right-[28%] w-8 h-8 bg-cream border-3 border-ink rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-ink rounded-full" />
              </div>
              {/* Mouth */}
              <div className="absolute bottom-[32%] left-1/2 -translate-x-1/2 w-10 h-5 border-b-3 border-ink" style={{ borderRadius: '0 0 20px 20px' }} />
            </div>

            {/* Floating stickers */}
            <Sticker color="bg-yellow" rotate="-rotate-6" className="top-8 left-4 animate-float" style={{ animationDelay: '0s' } as React.CSSProperties}>
              10 players max
            </Sticker>
            <Sticker color="bg-lime" rotate="rotate-3" className="top-12 right-0 animate-float" style={{ animationDelay: '1.2s' } as React.CSSProperties}>
              Live scoring
            </Sticker>
            <Sticker color="bg-pink" rotate="-rotate-2" className="bottom-16 right-4 animate-float" style={{ animationDelay: '0.7s' } as React.CSSProperties}>
              Share via link
            </Sticker>
            <Sticker color="bg-cyan" rotate="rotate-6" className="bottom-8 left-6 animate-float" style={{ animationDelay: '1.8s' } as React.CSSProperties}>
              No account needed
            </Sticker>

            {/* Score pop (decorative) */}
            <div className="absolute top-20 right-8 bg-lime border-3 border-ink shadow-hard px-3 py-1.5 rounded-crudd font-display font-bold text-xl text-ink rotate-3">
              +200
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
