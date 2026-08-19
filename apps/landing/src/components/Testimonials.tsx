import { Star } from 'lucide-react'
import { motion } from 'motion/react'

const testimonials = [
  {
    quote:  'Set it up in two minutes, wrecked all my friends in three. 10/10 would destroy again.',
    name:   'Jordan M.',
    role:   'Definitely not a nerd',
    color:  'bg-yellow',
    stars:  5,
  },
  {
    quote:  'The leaderboard updated so fast I nearly threw my phone. My ego has not recovered.',
    name:   'Priya K.',
    role:   'Current world record holder (disputed)',
    color:  'bg-pink',
    stars:  5,
  },
  {
    quote:  'I sent the link in our group chat at 11pm. We played until 2am. Nobody apologised.',
    name:   'Marcus T.',
    role:   'Group chat instigator',
    color:  'bg-cyan',
    stars:  5,
  },
  {
    quote:  'Came last. Blamed the timer. Will be back tomorrow.',
    name:   'Sasha B.',
    role:   'Work in progress',
    color:  'bg-lime',
    stars:  4,
  },
]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}
const item = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function Testimonials() {
  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-7xl">
        {/* Heading */}
        <div className="section-title title-gap text-center mb-14">
          <p className="font-display font-bold text-xs uppercase tracking-widest text-purple mb-3">
            From the battlefield
          </p>
          <h2 className="font-display font-bold text-4xl md:text-5xl text-ink">
            Real people. Real losses.
          </h2>
        </div>

        {/* Grid */}
        <motion.div
          className="testimonials_grid grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {testimonials.map((t) => (
            <motion.article
              key={t.name}
              variants={item}
              className="testimonial_card bg-cream border-3 border-ink shadow-hard rounded-crudd p-5 flex flex-col gap-4"
            >
              {/* Stars */}
              <div className="testimonial_stars flex gap-0.5" aria-label={`${t.stars} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < t.stars ? 'text-yellow fill-yellow' : 'text-ink/20'}
                    strokeWidth={1.5}
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="testimonial_quote font-body text-sm text-ink/80 leading-relaxed flex-1">
                "{t.quote}"
              </blockquote>

              {/* Author */}
              <div className="testimonial_author flex items-center gap-3 pt-3 border-t-3 border-ink">
                <div className={`testimonial_avatar-wrap w-9 h-9 ${t.color} border-3 border-ink rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="font-display font-bold text-xs text-ink">
                    {t.name[0]}
                  </span>
                </div>
                <div className="testimonial_author-info">
                  <p className="testimonial_name font-display font-bold text-sm text-ink leading-none mb-0.5">
                    {t.name}
                  </p>
                  <p className="testimonial_role font-body text-xs text-ink/50">
                    {t.role}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
