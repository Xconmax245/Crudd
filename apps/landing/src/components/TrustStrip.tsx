const items = [
  'Real-time. Server-authoritative. No excuses.',
  'One link. Up to 10 players. Zero accounts.',
  'Questions hit everyone simultaneously.',
  'Fastest correct answer earns the most.',
  'Leaderboard updates after every question.',
  'Host plays too — no spectator mode.',
  'Built for group chats. Not classrooms.',
  'Speed + correctness. That\'s the whole game.',
]

// Double for seamless loop
const doubled = [...items, ...items]

export default function TrustStrip() {
  return (
    <section className="redesigns_marquee-wrapper border-y-3 border-ink bg-ink py-4 overflow-hidden">
      <div
        className="redesigns_marquee-track marquee-track"
        aria-hidden="true"
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className="flex-shrink-0 flex items-center gap-3 px-6 font-display font-bold text-cream text-sm uppercase tracking-wider"
          >
            <span className="w-2 h-2 rounded-full bg-lime flex-shrink-0" />
            {item}
          </span>
        ))}
      </div>
      {/* Accessible alternative */}
      <p className="sr-only">
        CRUDD: real-time multiplayer quiz battles. One link, up to 10 players, zero accounts required. Speed and correctness determine the winner.
      </p>
    </section>
  )
}
