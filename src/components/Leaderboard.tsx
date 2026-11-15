import { useEffect, useState } from 'react'
import { apiEnabled, fetchLeaderboard, type LeaderboardEntry } from '../lib/api'
import { money, pct } from '../lib/format'

export function Leaderboard({ limit = 10, highlight, refreshKey }: { limit?: number; highlight?: { name: string; total: number }; refreshKey?: unknown }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null | undefined>(undefined)

  useEffect(() => {
    if (!apiEnabled) return
    let live = true
    setEntries(undefined)
    fetchLeaderboard(limit).then((e) => live && setEntries(e))
    return () => {
      live = false
    }
  }, [limit, refreshKey])

  if (!apiEnabled) return <p className="text-sm text-muted">The leaderboard is unavailable in offline mode.</p>
  if (entries === undefined) return <p className="text-sm text-muted">Loading leaderboard…</p>
  if (entries === null) return <p className="text-sm text-muted">The leaderboard could not be reached right now.</p>
  if (!entries.length) return <p className="text-sm text-muted">No finished games yet. Be the first!</p>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="py-1 pr-2 font-medium">#</th>
          <th className="py-1 pr-2 font-medium">Chef</th>
          <th className="py-1 pr-2 text-right font-medium">Profit</th>
          <th className="py-1 text-right font-medium" title="Total profit as a share of the optimal total">
            Of optimal
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const me = highlight && e.name === highlight.name && Math.abs(Number(e.totalProfit) - highlight.total) < 1
          return (
            <tr key={i} className={`border-t border-line ${me ? 'bg-accent/10 font-semibold' : ''}`}>
              <td className="py-1.5 pr-2 tabular-nums">{i + 1}</td>
              <td className="max-w-40 truncate py-1.5 pr-2">{e.name}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{money(Number(e.totalProfit))}</td>
              <td className="py-1.5 text-right tabular-nums">{pct(Number(e.efficiency))}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
