import { Zap, Clock, Trophy, Users } from 'lucide-react'
import { motion } from 'motion/react'

/**
 * Illustrative player archetypes — these are fictional gameplay personalities,
 * not real users or customer testimonials.
 */
const archetypes = [
  {
    icon:     Zap,
    color:    'bg-yellow',
    tag:      'The Speed Demon',
    tagline:  'Probably already knows the answer',
    quote:    'I was winning until someone answered in 0.7 seconds.',
    trait:    'Fastest fingers. Every. Single. Round.',
  },
  {
    icon:     Clock,
    color:    'bg-pink',
    tag:      'The "One More Game" Guy',
    tagline:  'Joined for one round. Stayed for fifty.',
    quote:    'I joined for one round. I stayed for all fifty.',
    trait:    'The leaderboard refresh is their cardio.',
  },
  {
    icon:     Trophy,
    color:    'bg-cyan',
    tag:      'The Humble One',
    tagline:  'Thought they knew Biology. Then Ade joined.',
    quote:    'I thought I knew Biology. Then Ade joined.',
    trait:    'Now studies. Does not admit it.',
  },
  {
    icon:     Users,
    color:    'bg-lime',
    tag:      'The Instigator',
    tagline:  'Sends the link at 11pm. No apologies.',
    quote:    'Nobody asked me to start this. I did it anyway.',
    trait:    'Curates the question bank. Wins the match.',
  },
]

const container = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function WhyPeoplePlay() {
  return (
    <section className="py-24 px-6" aria-labelledby="why-people-play-heading">
      <div className="container mx-auto max-w-7xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-4">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            The kind of chaos we're building for
          </p>
          <h2
            id="why-people-play-heading"
            className="font-display font-bold text-4xl md:text-5xl text-ink"
          >
            Why people play
          </h2>
        </div>

        {/* Illustrative framing — explicit */}
        <p className="text-center font-body text-sm text-ink/50 mb-12 max-w-md mx-auto">
          These are illustrative gameplay personalities, not customer testimonials.
          You'll recognise them the moment you start your first match.
        </p>

        {/* Archetype grid */}
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {archetypes.map((a) => {
            const Icon = a.icon
            return (
              <motion.div
                key={a.tag}
                variants={item}
                className="bg-cream border-3 border-ink shadow-hard rounded-crudd p-5 flex flex-col gap-4"
              >
                {/* Icon badge */}
                <div className={`w-10 h-10 ${a.color} border-3 border-ink shadow-hard-sm rounded-crudd flex items-center justify-center`}>
                  <Icon size={18} className="text-ink" strokeWidth={2.5} />
                </div>

                {/* Tag + tagline */}
                <div>
                  <p className="font-display font-bold text-base text-ink leading-snug mb-1">
                    {a.tag}
                  </p>
                  <p className="font-body text-xs text-ink/50 italic leading-snug">
                    {a.tagline}
                  </p>
                </div>

                {/* Quote — clearly marked as illustrative */}
                <blockquote
                  className="font-body text-sm text-ink/70 leading-relaxed flex-1 border-l-3 border-ink pl-3 italic"
                  aria-label={`Illustrative quote: ${a.quote}`}
                >
                  "{a.quote}"
                </blockquote>

                {/* Trait */}
                <div className="pt-3 border-t-3 border-ink">
                  <span className="font-display font-bold text-xs text-ink/60 uppercase tracking-widest">
                    {a.trait}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
