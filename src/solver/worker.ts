import type { Scenario } from '../engine/types'

interface SolveRequest {
  id: string
  scenario: Scenario
  demand: Record<string, number>
}

interface SolveResult {
  id: string
  openSiteIds: string[]
  objVal: number
  solveMs: number
}

// HiGHS WASM is loaded lazily on first solve
let highsReady: Promise<typeof import('highs')['default']> | null = null

function getHighs() {
  if (!highsReady) {
    highsReady = import('highs').then((m) => m.default({ locateFile: () => '/highs.wasm' }))
  }
  return highsReady
}

self.onmessage = async (e: MessageEvent<SolveRequest>) => {
  const { id, scenario: scn, demand } = e.data
  const t0 = performance.now()

  try {
    const HiGHS = await getHighs()

    const buildings = scn.buildings.map((b) => b.id)
    const sites = scn.sites.map((s) => s.id)
    const alphaMap = new Map(scn.reachPairs.map((rp) => [`${rp.buildingId}:${rp.siteId}`, rp.alpha]))
    const fMap = new Map(scn.sites.map((s) => [s.id, s.fixedCost]))
    const margin = scn.revenueR - scn.ingredientK

    // Variable naming: x_<siteIdx> (open site), y_<bIdx>_<sIdx> (assign building i to site j)
    const xVars = sites.map((s) => `x_${s}`)
    const yVars: string[] = []
    const yCoeff: number[] = []

    for (const rp of scn.reachPairs) {
      yVars.push(`y_${rp.buildingId}_${rp.siteId}`)
      yCoeff.push(margin * rp.alpha * (demand[rp.buildingId] ?? 0))
    }

    // Build LP/MIP model in HiGHS LP format
    const objTerms = [
      ...xVars.map((v, i) => `-${fMap.get(sites[i]) ?? 0} ${v}`),
      ...yVars.map((v, i) => `${yCoeff[i]} ${v}`),
    ].join(' + ')

    const rows: string[] = []

    // Each building assigned to at most one site
    for (const bId of buildings) {
      const terms = scn.reachPairs
        .filter((rp) => rp.buildingId === bId)
        .map((rp) => `y_${rp.buildingId}_${rp.siteId}`)
      if (terms.length > 0) rows.push(`c_b_${bId}: ${terms.join(' + ')} <= 1`)
    }

    // Linking: y_ij <= x_j
    for (const rp of scn.reachPairs) {
      rows.push(`c_link_${rp.buildingId}_${rp.siteId}: y_${rp.buildingId}_${rp.siteId} - x_${rp.siteId} <= 0`)
    }

    const allVars = [...xVars, ...yVars]
    const bounds = allVars.map((v) => `0 <= ${v} <= 1`).join('\n')
    const generals = allVars.join(' ')

    const lp = `Minimize\n obj: ${objTerms.length ? objTerms : '0'}\nSubject To\n${rows.join('\n')}\nBounds\n${bounds}\nGenerals\n${generals}\nEnd`

    const sol = HiGHS.solve(lp, { mip_gap: 0 })

    const openSiteIds = sites.filter(
      (s) => (sol.Columns[`x_${s}`]?.Primal ?? 0) > 0.5,
    )

    const result: SolveResult = {
      id,
      openSiteIds,
      objVal: -sol.ObjectiveValue,
      solveMs: Math.round(performance.now() - t0),
    }
    self.postMessage(result)
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}
