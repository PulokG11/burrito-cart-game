export interface Scenario {
  scenarioId: string
  version: string
  mode: 'normal' | 'championship'
  round: 1 | 2
  day: 1 | 2 | 3 | 4 | 5
  newsText: string
  revenueR: number
  ingredientK: number
  truckCostF: number
  isUncertain: boolean
  contentHash: string
  buildings: Building[]
  sites: Site[]
  reachPairs: ReachPair[]
}

export interface Building {
  id: string
  demand: number
  forecast?: number
  errMin?: number
  errMax?: number
  x: number
  y: number
  label: string
}

export interface Site {
  id: string
  fixedCost: number
  x: number
  y: number
  label: string
}

export interface ReachPair {
  buildingId: string
  siteId: string
  alpha: number
}

export interface Score {
  revenue: number
  ingredientCost: number
  truckCost: number
  profit: number
  customersByBuilding: Record<string, number>
}

export interface DayResult {
  openSiteIds: string[]
  demand: Record<string, number>
  playerScore: Score
  optimalScore: Score | null
  gapPct: number | null
}
