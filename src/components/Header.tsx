import { useGame } from '../store/game'
import { SCENARIOS } from '../scenarios'

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="var(--accent)" />
      <g transform="rotate(-28 20 20)">
        <rect x="7" y="14" width="26" height="12" rx="6" fill="var(--tortilla)" />
        <path d="M27 14 h0 a6 6 0 0 1 0 12" fill="var(--tortilla-dark)" />
        <circle cx="13" cy="20" r="1.6" fill="var(--good)" />
        <circle cx="18" cy="18.5" r="1.3" fill="var(--accent)" />
        <circle cx="22" cy="21" r="1.4" fill="var(--good)" />
      </g>
    </svg>
  )
}

export function Header() {
  const { screen, dayIndex, setNewsOpen, restart } = useGame()
  const scn = SCENARIOS[dayIndex]
  const inGame = screen === 'play' || screen === 'results'
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Logo className="h-8 w-8" />
        <span className="font-display text-lg font-bold tracking-tight">Burrito Cart</span>
      </div>
      {inGame && (
        <span className="rounded-full bg-chip px-3 py-1 text-sm font-semibold">
          Round {scn.round} · Day {scn.day} <span className="font-normal text-muted">· {scn.title}</span>
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {screen === 'play' && (
          <button className="btn-ghost" onClick={() => setNewsOpen(true)}>
            News
          </button>
        )}
        {screen !== 'home' && (
          <button
            className="btn-ghost"
            onClick={() => {
              if (screen === 'final' || confirm('Restart from Round 1, Day 1? Your progress will be lost.')) restart()
            }}
          >
            {screen === 'final' ? 'Home' : 'Restart'}
          </button>
        )}
      </div>
    </header>
  )
}
