import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

const faqs = [
  {
    q: 'Do players need to create an account to join?',
    a: 'No. Anyone with the link enters a username and jumps straight into the lobby. No sign-up, no email, no friction.',
  },
  {
    q: 'How many people can play in one match?',
    a: 'Up to 10 participants total — that includes the host. The host plays as a regular competitor and occupies one of the 10 slots.',
  },
  {
    q: 'Who controls which questions appear?',
    a: 'The host picks a question bank and configures how many questions to include. CRUDD randomizes the subset and locks the order at challenge creation — every player sees the exact same sequence.',
  },
  {
    q: 'What stops someone from cheating on the timer?',
    a: 'The server issues every question start and end timestamp. Answers submitted after the deadline are rejected server-side, regardless of what the client reports. Client timestamps are never trusted.',
  },
  {
    q: 'What happens if the host leaves mid-match?',
    a: 'If the host leaves before the match starts, ownership transfers to another participant in the lobby, or the lobby closes if nobody is left. If the host disconnects during an active match, the match continues unaffected — everyone else keeps playing.',
  },
  {
    q: 'Can I play the same question bank more than once?',
    a: 'Absolutely. Each challenge is a new randomized draw from the bank. Generate as many challenges as you want from the same bank — different questions, different order, same competitive chaos.',
  },
  {
    q: 'How is the score calculated?',
    a: 'Correctness first, speed second. A correct answer always beats an incorrect one. Among correct answers, the fastest response earns the most points. Wrong or unanswered questions score zero.',
  },
  {
    q: 'Can I create my own question bank?',
    a: 'Not in the current version. Question banks are curated and uploaded by admins. User-created banks are on the roadmap.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="faq_item border-3 border-ink rounded-crudd overflow-hidden bg-cream transition-shadow duration-150 hover:shadow-hard-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`faq_header w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 ${
          open ? 'bg-purple/10' : 'bg-cream hover:bg-ink/5'
        }`}
      >
        <span className="faq_question font-display font-bold text-base text-ink leading-snug">
          {q}
        </span>
        <span
          className={`faq_icon flex-shrink-0 w-7 h-7 rounded-full border-3 border-ink flex items-center justify-center transition-colors duration-150 ${
            open ? 'bg-purple text-cream' : 'bg-cream text-ink'
          }`}
        >
          {open ? (
            <Minus size={14} strokeWidth={3} />
          ) : (
            <Plus size={14} strokeWidth={3} />
          )}
        </span>
      </button>


      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="faq_answer px-5 py-4 border-t-3 border-ink bg-ink/5">
              <p className="font-body text-sm text-ink/70 leading-relaxed">
                {a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="py-24 px-6 bg-ink">
      <div className="container mx-auto max-w-3xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-14">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            FAQ
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-cream">
            Good questions. Obviously.
          </h2>
        </div>

        {/* Accordion */}
        <div className="faq_list flex flex-col gap-3">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>

        {/* Footer link */}
        <div className="faq_footer text-center mt-10">
          <p className="font-body text-sm text-cream/40">
            Still confused?{' '}
            <a href={import.meta.env.VITE_APP_URL || "http://localhost:3000"} className="faq_link text-purple font-semibold hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
