import type { Demand, Scenario, Score } from './types.ts'

type Option = { s: string; a: number }

const indexCache = new WeakMap<Scenario, Map<string, Option[]>>()

// Per building, reachable sites ordered best-first: largest multiplier, ties to the lowest site id.
export function reachIndex(scn: Scenario): Map<string, Option[]> {
  let idx = indexCache.get(scn)
  if (idx) return idx
  idx = new Map()
  for (const b of scn.buildings) idx.set(b.id, [])
  for (const r of scn.reach) idx.get(r.b)?.push({ s: r.s, a: r.a })
  for (const list of idx.values()) {
    list.sort((p, q) => q.a - p.a || (p.s < q.s ? -1 : p.s > q.s ? 1 : 0))
  }
  indexCache.set(scn, idx)
  return idx
}

export function score(scn: Scenario, openSites: Iterable<string>, demand: Demand): Score {
  const open = new Set(openSites)
  const idx = reachIndex(scn)
  const { revenue: r, ingredient: k, truckCost: f } = scn.economics
  const won: Record<string, number> = {}
  const assign: Record<string, string | null> = {}
  let customers = 0

  for (const b of scn.buildings) {
    const best = idx.get(b.id)?.find((o) => open.has(o.s))
    const c = best ? best.a * (demand[b.id] ?? 0) : 0
    won[b.id] = c
    assign[b.id] = best ? best.s : null
    customers += c
  }

  const revenue = r * customers
  const ingredient = k * customers
  const truckCost = f * open.size
  return { revenue, ingredient, truckCost, profit: revenue - ingredient - truckCost, won, assign }
}

export function gapPct(playerProfit: number, optimalProfit: number): number {
  if (optimalProfit <= 0) return 0
  return Math.max(0, ((optimalProfit - playerProfit) / optimalProfit) * 100)
}

export function forecastDemand(scn: Scenario): Demand {
  return Object.fromEntries(scn.buildings.map((b) => [b.id, b.demand]))
}

// Mean of the triangular distribution; profit is linear in demand, so planning on the mean maximizes expected profit.
export function expectedDemand(scn: Scenario): Demand {
  return Object.fromEntries(
    scn.buildings.map((b) => [
      b.id,
      scn.uncertain && b.min != null && b.max != null ? (b.min + b.max + b.demand) / 3 : b.demand,
    ]),
  )
}
