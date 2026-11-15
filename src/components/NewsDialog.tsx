import { useEffect, useRef } from 'react'
import { blocks, combos, money } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { useGame } from '../store/game'

export function NewsDialog() {
  const { newsOpen, setNewsOpen, dayIndex } = useGame()
  const scn = SCENARIOS[dayIndex]
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!newsOpen) return
    btn.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNewsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newsOpen, setNewsOpen])

  if (!newsOpen) return null
  const e = scn.economics
  const roundStart = scn.day === 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNewsOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          {roundStart ? `Round ${scn.round} begins` : 'Salsa Springs Daily'} · Day {scn.day} of 5
        </p>
        <h2 id="news-title" className="mt-1 font-display text-2xl font-bold">
          {scn.title}
        </h2>
        <p className="mt-3 leading-relaxed text-ink/90">{scn.news.replace(/ Each truck costs.*$/, '')}</p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['Truck', money(e.truckCost), scn.wrinkle === 'critic'],
            ['Sale price', money(e.revenue), false],
            ['Ingredients', money(e.ingredient), scn.wrinkle === 'cost'],
          ].map(([k, v, hot]) => (
            <div key={k as string} className={`rounded-xl px-2 py-2 ${hot ? 'bg-accent text-white' : 'bg-chip'}`}>
              <dt className="text-xs opacity-80">{k}</dt>
              <dd className="text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          <li>
            <strong className="text-ink">{scn.sites.length}</strong> possible truck spots, so {combos(scn.sites.length)} ways to place trucks.
          </li>
          {scn.wrinkle === 'rain' && (
            <li>
              Customers walk at most {blocks(scn.walk.maxDistance)} today (normally {blocks(5)}).
            </li>
          )}
          {scn.uncertain && <li>Numbers on buildings are forecasts. Small ranges under them show where actual demand can land.</li>}
          <li>Profit = sales − ingredients − trucks. Each building's customers go to the nearest truck.</li>
        </ul>

        <button ref={btn} className="btn-primary mt-6 w-full" onClick={() => setNewsOpen(false)}>
          Place my trucks
        </button>
      </div>
    </div>
  )
}
