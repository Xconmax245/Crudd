import { Zap, Github, Twitter } from 'lucide-react'

const navGroups = [
  {
    label: 'Product',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Question Banks', href: '#question-banks' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    label: 'Play',
    links: [
      { label: 'Start a Challenge', href: '#' },
      { label: 'Join a Match', href: '#' },
      { label: 'Browse Banks', href: '#' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Privacy Policy', href: '#' },
    ],
  },
]

const socials = [
  { label: 'GitHub',  href: '#', icon: Github  },
  { label: 'Twitter', href: '#', icon: Twitter },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer bg-ink border-t-3 border-white/10">
      <div className="footer_inner container mx-auto max-w-7xl px-6">
        {/* Top */}
        <div className="footer_top grid md:grid-cols-4 gap-12 py-16">
          {/* Brand */}
          <div className="footer_brand md:col-span-1">
            <a href={import.meta.env.VITE_APP_URL || "http://localhost:3000"} className="footer_logo-link flex items-center gap-2 mb-4 w-fit">
              <div className="w-9 h-9 bg-purple border-3 border-white/20 rounded-crudd flex items-center justify-center">
                <Zap size={18} className="text-cream fill-cream" />
              </div>
              <span className="font-display font-bold text-2xl text-cream tracking-tight">
                CRUDD
              </span>
            </a>
            <p className="footer_tagline font-body text-sm text-cream/40 leading-relaxed max-w-xs">
              Real-time multiplayer quiz battles. Turn any question bank into a competitive showdown.
            </p>
          </div>

          {/* Nav groups */}
          {navGroups.map((group) => (
            <div key={group.label} className="footer_nav-group">
              <p className="footer_nav-label font-display font-bold text-xs uppercase tracking-widest text-cream/40 mb-4">
                {group.label}
              </p>
              <ul className="footer_links flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="footer_link font-body text-sm text-cream/60 hover:text-cream transition-colors duration-150"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rule */}
        <div className="footer_rule border-t border-white/10" />

        {/* Bottom */}
        <div className="footer_bottom flex flex-wrap items-center justify-between gap-4 py-6">
          <div className="footer_copyright-wrap">
            <p className="footer_copyright font-body text-xs text-cream/30">
              &copy; <span>{year}</span> CRUDD. All rights reserved.
            </p>
          </div>

          {/* Legal links */}
          <div className="footer_legal-links flex items-center gap-4">
            <a href={import.meta.env.VITE_APP_URL || "http://localhost:3000"} className="footer_legal-link font-body text-xs text-cream/30 hover:text-cream/60 transition-colors duration-150">
              Privacy
            </a>
            <span className="footer_legal-divider text-cream/20">·</span>
            <a href={import.meta.env.VITE_APP_URL || "http://localhost:3000"} className="footer_legal-link font-body text-xs text-cream/30 hover:text-cream/60 transition-colors duration-150">
              Terms
            </a>
          </div>

          {/* Socials */}
          <div className="footer_socials flex items-center gap-2">
            {socials.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="footer_social-btn w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-cream/40 hover:text-cream hover:border-white/30 transition-all duration-150"
              >
                <Icon size={16} className="footer_social-icon" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
