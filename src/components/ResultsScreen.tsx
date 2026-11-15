import { forecastDemand } from '../engine/score'
import type { Score } from '../engine/types'
import { combos, cost, money, pct } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { useGame, type Verification } from '../store/game'
import { CityMap } from './CityMap'

const BADGE: Record<Verification, [string, string]> = {
  pending: ['Checking score on the server…', 'bg-chip text-muted'],
  verified: ['Score verified and saved on the server', 'bg-good/15 text-good'],
  offline: ['Playing offline: this score is not saved', 'bg-chip text-muted'],
  mismatch: ['The server scored this day differently', 'bg-bad/15 text-bad'],
}

function Breakdown({ s, trucks, fee }: { s: Score; trucks: number; fee: number }) {
  return (
    <dl className="grid grid-cols-4 gap-1 text-center text-sm">
      <div>
        <dt className="text-xs text-muted">Sales</dt>
        <dd className="font-semibold tabular-nums">{money(s.revenue)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Ingredients</dt>
        <dd className="font-semibold tabular-nums">{cost(s.ingredient)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">
          {trucks} × {money(fee)}
        </dt>
        <dd className="font-semibold tabular-nums">{cost(s.truckCost)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Profit</dt>
        <dd className={`font-bold tabular-nums ${s.profit >= 0 ? 'text-good' : 'text-bad'}`}>{money(s.profit)}</dd>
      </div>
    </dl>
  )
}

export function ResultsScreen() {
  const { records, dayIndex, nextDay } = useGame()
  const scn = SCENARIOS[dayIndex]
  const rec = records[records.length - 1]
  if (!rec || rec.scenarioId !== scn.id) return null

  const forecast = scn.uncertain ? forecastDemand(scn) : undefined
  const share = rec.optimal.profit > 0 ? (rec.player.profit / rec.optimal.profit) * 100 : 100
  const beat = rec.player.profit > rec.optimal.profit + 0.5
  const matched = !beat && rec.gapPct < 0.05
  const [badge, badgeClass] = BADGE[rec.verification]
  const last = dayIndex === SCENARIOS.length - 1
  const endOfRound = scn.day === 5

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 p-3 lg:p-4">
      <section className="panel mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Round {scn.round} · Day {scn.day} results
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {beat
              ? 'Lucky draw: you beat the solver today!'
              : matched
                ? 'You matched the optimal solution!'
                : rec.player.profit < 0
                  ? `Your trucks lost ${money(-rec.player.profit)} today`
                  : `${pct(rec.gapPct)} below optimal`}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {rec.solveMs != null
              ? `HiGHS searched ${combos(scn.sites.length)} possible placements and proved the best one in ${Math.max(1, Math.round(rec.solveMs))} ms, right in your browser.`
              : 'The optimal plan was pre-computed with the HiGHS solver.'}
            {scn.uncertain && ' Both plans were scored on the same actual demand; the solver planned for the average of each range.'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">You earned</p>
          <p className="font-display text-3xl font-bold tabular-nums">{pct(Math.max(0, share), 0)}</p>
          <p className="text-xs text-muted">of the optimal profit</p>
        </div>
        <button className="btn-primary" onClick={nextDay} autoFocus>
          {last ? 'See final results' : endOfRound ? 'Start Round 2' : `Next: Day ${scn.day + 1}`}
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="mb-2 font-semibold">Your trucks</h2>
          <CityMap scn={scn} open={rec.open} demand={rec.actual} result={rec.player} forecast={forecast} tips={rec.tips} showLinks label="Your truck placement" />
          <div className="mt-3">
            <Breakdown s={rec.player} trucks={rec.open.length} fee={scn.economics.truckCost} />
          </div>
        </section>
        <section className="panel">
          <h2 className="mb-2 font-semibold">Optimal plan</h2>
          <CityMap scn={scn} open={rec.optimalSites} demand={rec.actual} result={rec.optimal} forecast={forecast} showLinks label="Optimal truck placement" />
          <div className="mt-3">
            <Breakdown s={rec.optimal} trucks={rec.optimalSites.length} fee={scn.economics.truckCost} />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="panel lg:col-span-2">
          <h2 className="mb-2 font-semibold">Tips</h2>
          <ol className="space-y-2">
            {rec.tips.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bulb text-xs font-extrabold text-[#3b2a00]" aria-hidden>
                  {t.at ? i + 1 : '💡'}
                </span>
                <span className="text-sm leading-relaxed">{t.text}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel text-sm">
          <p className={`rounded-lg px-3 py-2 font-medium ${badgeClass}`}>{badge}</p>
          <p className="mt-3 text-muted">
            Rings show the share of each building's customers won. Dashed lines show which truck each building walks to.
            {scn.uncertain && ' Numbers are actual demand; "fcst" is what was forecast.'}
          </p>
        </section>
      </div>
    </div>
  )
}
