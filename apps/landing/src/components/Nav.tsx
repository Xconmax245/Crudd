import { useState, useEffect } from 'react'
import { Menu, X, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Question Banks', href: '#question-banks' },
  { label: 'FAQ', href: '#faq' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleNavClick = (href: string) => {
    setOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={cn(
        'nav_component fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        scrolled
          ? 'bg-cream/95 backdrop-blur-sm border-b-3 border-ink shadow-hard-sm'
          : 'bg-transparent',
      )}
    >
      {/* Skip link — first focusable element, jumps keyboard users past the nav */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-purple focus:text-cream focus:border-3 focus:border-ink focus:shadow-hard focus:px-4 focus:py-2 focus:rounded-crudd focus:font-display focus:font-bold focus:text-sm"
      >
        Skip to content
      </a>

      <div className="container mx-auto px-6 max-w-7xl">
        <nav className="nav_menu flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <a
            href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
            className="nav_logo flex items-center gap-2 group"
            aria-label="CRUDD home"
          >
            <div className="w-9 h-9 bg-purple border-3 border-ink shadow-hard-sm rounded-crudd flex items-center justify-center group-hover:shadow-none group-hover:translate-x-[3px] group-hover:translate-y-[3px] transition-all duration-150">
              <Zap size={18} className="text-cream fill-cream" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-ink">
              CRUDD
            </span>
          </a>

          {/* Desktop nav links */}
          <ul className="nav_list hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <button
                  onClick={() => handleNavClick(link.href)}
                  className="nav_link px-4 py-2 rounded-pill font-body font-semibold text-sm text-ink hover:bg-ink hover:text-cream transition-colors duration-150"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop CTA */}
          <a
            href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
            data-destination="browse"
            className="btn-primary press hidden md:flex items-center gap-2 bg-purple text-cream border-3 border-ink shadow-hard px-5 py-2.5 rounded-crudd font-display font-bold text-sm hover:shadow-hard-sm hover:translate-x-[3px] hover:translate-y-[3px]"
          >
            Start a Challenge
          </a>


          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="nav_hamburger md:hidden w-10 h-10 flex items-center justify-center border-3 border-ink rounded-crudd bg-cream hover:bg-ink hover:text-cream transition-colors duration-150"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t-3 border-ink bg-cream md:hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="text-left px-4 py-3 rounded-crudd font-body font-semibold text-ink hover:bg-ink hover:text-cream transition-colors duration-150"
                >
                  {link.label}
                </button>
              ))}
              <a
                href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
                data-destination="browse"
                className="press mt-2 flex items-center justify-center gap-2 bg-purple text-cream border-3 border-ink shadow-hard px-5 py-3 rounded-crudd font-display font-bold"
              >
                Start a Challenge
              </a>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
