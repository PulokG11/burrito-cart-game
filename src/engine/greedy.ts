import { score } from './score.ts'
import type { Demand, Plan, Scenario } from './types.ts'

// Add the single most profitable truck until no addition helps: the "obvious" hand strategy.
export function greedy(scn: Scenario, demand: Demand): Plan {
  const open: string[] = []
  let best = score(scn, open, demand).profit
  for (;;) {
    let pick: string | null = null
    let pickProfit = best
    for (const s of scn.sites) {
      if (open.includes(s.id)) continue
      const p = score(scn, [...open, s.id], demand).profit
      if (p > pickProfit + 1e-9) {
        pick = s.id
        pickProfit = p
      }
    }
    if (!pick) break
    open.push(pick)
    best = pickProfit
  }
  return { sites: open.sort(), plannedProfit: best }
}
