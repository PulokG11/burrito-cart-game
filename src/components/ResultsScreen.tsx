import { useState } from 'react'
import { combos, cost, money } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { useGame, type Verification } from '../store/game'
import { CityMap } from './CityMap'
import { NamesSwitch, TruckIcon } from './PlayScreen'
import { Rail, RailDivider } from './Rail'

const BADGE: Record<Verification, string> = {
  pending: 'Checking your score on the server…',
  verified: 'Score checked and saved',
  offline: 'Playing offline: this score is not saved',
  mismatch: 'The server scored this day differently',
}

type View = 'mine' | 'best' | 'both'

export function ResultsScreen() {
  const { records, dayIndex, nextDay } = useGame()
  const [view, setView] = useState<View>('both')
  const [names, setNames] = useState(false)
  const scn = SCENARIOS[dayIndex]
  const rec = records[records.length - 1]
  if (!rec || rec.scenarioId !== scn.id) return null

  const share = rec.optimal.profit > 0 ? Math.max(0, (rec.player.profit / rec.optimal.profit) * 100) : 100
  const beat = rec.player.profit > rec.optimal.profit + 0.5
  const last = dayIndex === SCENARIOS.length - 1
  const f = scn.economics.truckCost
  const views: [View, string][] = [['mine', 'Your plan'], ['best', 'Best plan'], ['both', 'Both']]

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-3 lg:p-5">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-3 lg:max-w-[calc((100vh-64px-60px-40px)*20/14)]">
          <div role="group" aria-label="Show plans" className="inline-flex overflow-hidden rounded-xl border-2 border-[#1C3A8A] bg-white">
            {views.map(([v, label], i) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`min-h-[40px] px-4 text-[15px] font-bold ${i ? 'border-l-2 border-[#1C3A8A]' : ''} ${view === v ? 'bg-[#1C3A8A] text-white' : 'text-[#1C3A8A]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[15px] text-muted">
            {scn.uncertain ? 'Numbers show actual demand. ' : ''}Rings show the share of each building {view === 'best' ? 'the best plan' : 'you'} won.
          </p>
          <NamesSwitch on={names} onChange={setNames} />
        </div>
        <div className="relative mx-auto w-full overflow-x-auto rounded-2xl lg:max-w-[calc((100vh-64px-60px-40px)*20/14)]">
          <div className="min-w-[680px]">
            <CityMap
              scn={scn}
              open={rec.open}
              demand={rec.actual}
              result={view === 'best' ? rec.optimal : rec.player}
              best={view === 'mine' ? [] : rec.optimalSites}
              showTrucks={view !== 'best'}
              ranges={scn.uncertain}
              actual={scn.uncertain ? rec.actual : undefined}
              tips={view === 'best' ? [] : rec.tips}
              names={names}
              showLinks
              label="Map comparing your trucks with the best plan's trucks"
            />
          </div>
          <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-xl bg-white p-3 text-sm text-[#1A1F2E] shadow-[0_2px_0_rgba(0,0,0,0.25)]">
            <span className="flex items-center gap-2.5"><TruckIcon className="h-5 w-8" />Your truck</span>
            <span className="flex items-center gap-2.5">
              <svg viewBox="0 0 46 28" className="h-5 w-8" aria-hidden><rect x={1.5} y={2.5} width={42} height={21} rx={4} fill="rgba(246,178,43,0.25)" stroke="#F6B22B" strokeWidth={3} strokeDasharray="5 3" /></svg>
              Best plan's truck
            </span>
          </div>
        </div>
      </main>

      <Rail>
        <section className="flex flex-col gap-1">
          <p className="text-[15px] text-[#C9D4F2]">
            Round {scn.round}, day {scn.day} results
          </p>
          {beat ? (
            <>
              <p className="font-display text-[34px] leading-tight">Lucky draw!</p>
              <p className="text-[17px] text-[#E4EAFA]">You beat the solver on today's actual demand.</p>
            </>
          ) : rec.player.profit < 0 ? (
            <>
              <p className="num text-[44px] leading-none">{money(rec.player.profit)}</p>
              <p className="text-[17px] text-[#E4EAFA]">Your trucks lost money today. The best plan made {money(rec.optimal.profit)}.</p>
            </>
          ) : (
            <>
              <p className="num text-[64px] leading-none">{Math.round(share)}%</p>
              <p className="text-[17px] text-[#E4EAFA]">{share > 99.5 ? 'You matched the best plan!' : "of the best plan's profit"}</p>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          {[
            ['Your plan', rec.player.profit, Math.min(100, share), '#F6B22B'],
            ['Best plan', rec.optimal.profit, 100, '#FFFFFF'],
          ].map(([label, value, w, color]) => (
            <div key={label as string} className="flex flex-col gap-1">
              <div className="flex justify-between text-[15px]">
                <span>{label}</span>
                <span className="num">{money(value as number)}</span>
              </div>
              <div className="h-3.5 rounded-full bg-white/15">
                <div className="h-3.5 rounded-full" style={{ width: `${w}%`, background: color as string }} />
              </div>
            </div>
          ))}
        </section>

        <table className="w-full text-sm text-[#E4EAFA]">
          <thead>
            <tr className="text-right text-[#C9D4F2]">
              <th />
              <th className="pb-1.5 font-bold">You</th>
              <th className="pb-1.5 font-bold">Best</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Sales', money(rec.player.revenue), money(rec.optimal.revenue)],
              ['Ingredients', cost(rec.player.ingredient), cost(rec.optimal.ingredient)],
              ['Trucks', `${rec.open.length} × ${money(f)}`, `${rec.optimalSites.length} × ${money(f)}`],
            ].map(([k, a, b]) => (
              <tr key={k} className="border-t border-white/20 text-right">
                <td className="py-1.5 text-left">{k}</td>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
            <tr className="border-t border-white/20 text-right font-bold text-white">
              <td className="py-1.5 text-left">Profit</td>
              <td>{money(rec.player.profit)}</td>
              <td>{money(rec.optimal.profit)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm leading-relaxed text-[#C9D4F2]">
          {rec.solveMs != null
            ? `HiGHS searched ${combos(scn.sites.length)} possible placements and proved the best one in ${Math.max(1, Math.round(rec.solveMs))} ms, in your browser.`
            : 'The best plan was worked out ahead of time with the HiGHS solver.'}
          {scn.uncertain && ' Both plans were scored on the same actual demand; the solver planned for the average of each range.'}
        </p>

        <RailDivider />

        <ol className="flex flex-col gap-3">
          {rec.tips.map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              {t.at ? (
                <span className="num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-bulb text-[13px] text-[#1A1F2E]">{i + 1}</span>
              ) : (
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-bulb/25" aria-hidden>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F6C445" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
                  </svg>
                </span>
              )}
              <span className="text-[15px] leading-relaxed">{t.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          <p className="flex items-center gap-2 text-sm text-[#C9D4F2]">
            {rec.verification === 'verified' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7CD3C8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            )}
            {BADGE[rec.verification]}
          </p>
          <button type="button" className="btn-gold" onClick={nextDay} autoFocus>
            {last ? 'See final results' : scn.day === 5 ? 'Start round 2' : `Next: day ${scn.day + 1}`}
          </button>
        </div>
      </Rail>
    </div>
  )
}
