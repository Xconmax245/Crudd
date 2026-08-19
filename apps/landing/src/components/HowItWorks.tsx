import { Search, Settings2, Share2, Swords } from 'lucide-react'
import { motion } from 'motion/react'

const steps = [
  {
    number: '01',
    icon:   Search,
    color:  'bg-yellow',
    title:  'Browse',
    desc:   'Pick from a library of question banks across subjects. Each card shows exactly how many questions are available.',
    checks: ['No login required to browse', 'Questions verified by admins'],
  },
  {
    number: '02',
    icon:   Settings2,
    color:  'bg-cyan',
    title:  'Configure',
    desc:   'Choose how many questions, how many players (up to 10), and how long each question stays open.',
    checks: ['Question count scales to bank size', 'Timer presets: 5 / 10 / 15 / 20 / 30s', 'Host counts as one of the 10 player slots'],
  },
  {
    number: '03',
    icon:   Share2,
    color:  'bg-pink',
    title:  'Share',
    desc:   'Drop your unique link in the group chat. Friends open it, enter a username, and land straight in the lobby.',
    checks: ['No accounts needed to join', 'Works from WhatsApp, Discord, Telegram'],
  },
  {
    number: '04',
    icon:   Swords,
    color:  'bg-lime',
    title:  'Compete',
    desc:   'Questions hit every player simultaneously. Speed and correctness earn points. Live leaderboard keeps the tension alive.',
    checks: ['Server decides the winner — no client cheating', 'Leaderboard updates every round'],
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
}

const item = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="process py-24 px-6 bg-ink">
      <div className="container mx-auto max-w-7xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-14">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            The loop
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-cream">
            Four steps to total domination
          </h2>
        </div>

        {/* Steps */}
        <motion.ol
          className="process_list grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <motion.li
                key={step.number}
                variants={item}
                className="process_week bg-white/5 border-3 border-white/10 rounded-crudd p-6 flex flex-col gap-4 hover:border-purple/40 transition-colors duration-200"
              >
                {/* Badge + icon */}
                <div className="flex items-center gap-3">
                  <div className={`process_badge w-10 h-10 ${step.color} border-3 border-ink shadow-hard-sm rounded-crudd flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className="text-ink" strokeWidth={2.5} />
                  </div>
                  <span className="font-display font-bold text-3xl text-cream/20 leading-none">
                    {step.number}
                  </span>
                </div>

                {/* Title + desc */}
                <div className="process_content">
                  <h3 className="font-display font-bold text-lg text-cream mb-1.5">
                    {step.title}
                  </h3>
                  <p className="font-body text-sm text-cream/60 leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                {/* Checklist */}
                <ul className="process_checklist flex flex-col gap-1.5 mt-auto pt-4 border-t border-white/10">
                  {step.checks.map((check) => (
                    <li key={check} className="process_check-item flex items-start gap-2">
                      <span className="process_check-icon flex-shrink-0 w-4 h-4 mt-0.5 rounded-full bg-lime border-2 border-ink flex items-center justify-center">
                        <svg viewBox="0 0 8 8" fill="none" aria-hidden="true" className="w-2.5 h-2.5">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="#16161D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="font-body text-xs text-cream/60 leading-snug">
                        {check}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
    </section>
  )
}
