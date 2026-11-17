import { dayCsv, download } from '../lib/csv'
import { SCENARIOS } from '../scenarios'
import { useGame } from '../store/game'

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden>
      <circle cx="28" cy="28" r="27" fill="#1C3A8A" />
      <g transform="rotate(-24 28 28)">
        <rect x="11" y="21" width="34" height="15" rx="7.5" fill="#F3D9A4" stroke="#B8892E" strokeWidth="2" />
        <circle cx="19" cy="28.5" r="2.2" fill="#2E8B57" />
        <circle cx="26" cy="27" r="1.8" fill="#CF2E22" />
        <circle cx="32" cy="29.5" r="2" fill="#2E8B57" />
      </g>
    </svg>
  )
}

export function Header() {
  const { screen, dayIndex, setNewsOpen, restart } = useGame()
  const scn = SCENARIOS[dayIndex]
  const inGame = screen === 'play' || screen === 'results'
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-line bg-bg px-4 py-2 lg:px-6">
      <div className="flex items-center gap-2.5">
        <Logo className="h-9 w-9" />
        <span className="font-display text-xl text-accent">Burrito Cart</span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {screen === 'play' && (
          <button type="button" className="btn-ghost" aria-label="Today's news" onClick={() => setNewsOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5" />
            </svg>
            <span className="hidden sm:inline">Today's news</span>
          </button>
        )}
        {inGame && (
          <button
            type="button"
            className="btn-ghost"
            aria-label="Download today's data"
            onClick={() => Object.entries(dayCsv(scn)).forEach(([name, text], i) => setTimeout(() => download(`${scn.id}-${name}`, text), i * 250))}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            <span className="hidden sm:inline">Download data</span>
          </button>
        )}
        {screen !== 'home' && (
          <button
            type="button"
            className="btn-ghost"
            aria-label={screen === 'final' ? 'Home' : 'Restart'}
            onClick={() => {
              if (screen === 'final' || confirm('Restart from round 1, day 1? Your progress will be lost.')) restart()
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" />
            </svg>
            <span className="hidden sm:inline">{screen === 'final' ? 'Home' : 'Restart'}</span>
          </button>
        )}
      </div>
    </header>
  )
}
