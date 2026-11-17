import { money, pct } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { useGame } from '../store/game'
import { Leaderboard } from './Leaderboard'

export function FinalScreen() {
  const { records, displayName, remote, restart, matchCode } = useGame()
  const total = records.reduce((s, r) => s + r.player.profit, 0)
  const optimal = records.reduce((s, r) => s + r.optimal.profit, 0)
  const share = optimal > 0 ? (total / optimal) * 100 : 0
  const saved = remote && records.length === SCENARIOS.length && records.every((r) => r.verification === 'verified')
  const pendingAny = records.some((r) => r.verification === 'pending')

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-3 lg:grid-cols-[1.3fr_1fr] lg:p-6">
      <section className="panel">
        <p className="text-sm font-bold text-muted">All 10 days complete</p>
        <h1 className="font-display text-3xl font-bold">
          {displayName}, you earned {money(total)}
        </h1>
        <p className="mt-1 text-muted">
          That is {pct(Math.max(0, share))} of the {money(optimal)} the optimal plans earned on the same demand.
        </p>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">You</th>
              <th className="py-1 text-right font-medium">Optimal</th>
              <th className="py-1 text-right font-medium">Gap</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const s = SCENARIOS.find((x) => x.id === r.scenarioId)!
              return (
                <tr key={r.scenarioId} className="border-t border-line">
                  <td className="py-1.5">
                    R{s.round}·D{s.day} <span className="text-muted">{s.title}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.player.profit)}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.optimal.profit)}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.player.profit > r.optimal.profit ? 'won' : pct(r.gapPct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="btn-primary mt-5" onClick={restart}>
          Play again
        </button>
      </section>

      <section className="panel">
        <h2 className="mb-1 font-semibold">{matchCode ? `Championship ${matchCode}` : 'Leaderboard'}</h2>
        <p className="mb-3 text-xs text-muted">
          {saved ? 'Your game was saved.' : pendingAny ? 'Saving your last day…' : remote ? 'Some days were not saved, so this game is not ranked.' : 'Offline games are not ranked.'}{' '}
          {matchCode
            ? 'Ranked by total profit: everyone in this championship played the same demand.'
            : 'Ranked by share of the optimal profit, because Round 2 demand is random for each player.'}
        </p>
        <Leaderboard limit={matchCode ? 50 : 15} highlight={{ name: displayName, total }} refreshKey={pendingAny} matchCode={matchCode} />
      </section>
    </div>
  )
}
