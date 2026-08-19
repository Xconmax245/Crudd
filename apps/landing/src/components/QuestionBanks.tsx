import { HelpCircle, ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, useEffect } from 'react'

const HARDCODED_BANKS = [
  { id: '1', title: 'General Knowledge',  subject: 'Mixed',      questionCount: 80 },
  { id: '2', title: 'World History',      subject: 'History',    questionCount: 50 },
  { id: '3', title: 'Human Biology',      subject: 'Science',    questionCount: 45 },
  { id: '4', title: 'Pop Culture 2020s',  subject: 'Culture',    questionCount: 60 },
  { id: '5', title: 'Geography Blitz',    subject: 'Geography',  questionCount: 35 },
  { id: '6', title: 'Tech & Computers',   subject: 'Technology', questionCount: 55 },
]

const COLORS = ['bg-yellow', 'bg-cyan', 'bg-lime', 'bg-pink', 'bg-orange', 'bg-purple']

interface QuestionBank {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden:  { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.35, ease: 'easeOut' } },
}

export default function QuestionBanks() {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        // Use a relative URL so Vite's dev proxy forwards it to the API
        // (avoids CORS issues across different ports).
        const res = await fetch('/api/banks')
        if (res.ok) {
          const data = await res.json()
          setBanks(data.slice(0, 6))
        } else {
          setBanks(HARDCODED_BANKS)
        }
      } catch (err) {
        setBanks(HARDCODED_BANKS)
      }
    }
    fetchBanks()
  }, [])

  const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:3000'

  return (
    <section id="question-banks" className="py-24 px-6 bg-ink">
      <div className="container mx-auto max-w-7xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-14">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            Question banks
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-cream">
            Pick your battlefield
          </h2>
          <p className="font-body text-base text-cream/50 mt-4 max-w-xl mx-auto">
            Admin-curated question sets across subjects. Every bank is ready to turn into a live challenge immediately.
          </p>
        </div>

        {/* Bank grid */}
        {banks.length > 0 && (
          <motion.div
            className="banks_grid grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {banks.map((bank, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <motion.div key={bank.id || bank.title} variants={item}>
                  <a
                    href={`${appUrl}/banks/${bank.id}/configure`}
                    className="block bank-card group bg-white/5 border-3 border-white/10 rounded-crudd p-5 flex flex-col gap-3 hover:border-purple/50 hover:bg-white/8 transition-all duration-200"
                  >
                    {/* Icon + subject badge */}
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 ${color} border-3 border-ink shadow-hard-sm rounded-crudd flex items-center justify-center`}>
                        <HelpCircle size={18} className="text-ink" strokeWidth={2.5} />
                      </div>
                      <span className="font-display font-bold text-xs text-cream/40 uppercase tracking-widest border border-white/10 px-2.5 py-1 rounded-pill">
                        {bank.subject}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="bank-card_title font-display font-bold text-lg text-cream leading-snug">
                      {bank.title}
                    </h3>

                    {/* Question count */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10">
                      <span className="font-body text-sm font-semibold text-cream/50">
                        <span className="text-cream font-bold text-lg font-display">{bank.questionCount}</span> questions
                      </span>
                      <div className="w-8 h-8 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ArrowRight size={14} className="text-purple" />
                      </div>
                    </div>
                  </a>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href={import.meta.env.VITE_APP_URL || "http://localhost:3000"}
            data-destination="browse"
            className="press group inline-flex items-center gap-2 bg-purple text-cream border-3 border-cream/20 shadow-hard-purple px-6 py-3.5 rounded-crudd font-display font-bold text-base hover:shadow-hard-sm-purple hover:translate-x-[3px] hover:translate-y-[3px]"
          >
            Browse all banks
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-150" />
          </a>

        </div>
      </div>
    </section>
  )
}
