import type { Scenario, Score } from './types'

export function score(
  scn: Scenario,
  openSiteIds: string[],
  demand: Record<string, number>,
): Score {
  const openSet = new Set(openSiteIds)
  const alphaMap = new Map(
    scn.reachPairs.map((rp) => [`${rp.buildingId}:${rp.siteId}`, rp.alpha]),
  )

  let revenue = 0
  let ingredientCost = 0
  const customersByBuilding: Record<string, number> = {}

  for (const b of scn.buildings) {
    let bestAlpha = 0
    for (const siteId of openSiteIds) {
      const a = alphaMap.get(`${b.id}:${siteId}`) ?? 0
      if (a > bestAlpha) bestAlpha = a
    }
    const customers = bestAlpha * (demand[b.id] ?? 0)
    customersByBuilding[b.id] = customers
    revenue += scn.revenueR * customers
    ingredientCost += scn.ingredientK * customers
  }

  const truckCost = scn.sites
    .filter((s) => openSet.has(s.id))
    .reduce((sum, s) => sum + s.fixedCost, 0)

  return {
    revenue,
    ingredientCost,
    truckCost,
    profit: revenue - ingredientCost - truckCost,
    customersByBuilding,
  }
}

export function profitGapPct(playerProfit: number, optimalProfit: number): number {
  if (optimalProfit === 0) return 0
  return ((optimalProfit - playerProfit) / Math.abs(optimalProfit)) * 100
}
