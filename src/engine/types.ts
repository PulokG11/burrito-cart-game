export type Mode = 'normal' | 'championship'

export type Wrinkle =
  | 'opening'
  | 'growth'
  | 'cost'
  | 'rain'
  | 'festival'
  | 'forecast'
  | 'volatile'
  | 'critic'
  | 'upside'
  | 'downside'

export interface Economics {
  revenue: number
  ingredient: number
  truckCost: number
}

export interface WalkProfile {
  type: 'linear'
  plateau: number
  maxDistance: number
}

// Round 1: `demand` is exact. Round 2: `demand` is the forecast (triangular mode), min/max are the error bars.
export interface Building {
  id: string
  name: string
  x: number
  y: number
  demand: number
  min?: number
  max?: number
}

export interface Site {
  id: string
  x: number
  y: number
}

export interface Reach {
  b: string
  s: string
  d: number
  a: number
}

export interface Plan {
  sites: string[]
  plannedProfit: number
}

export interface Scenario {
  id: string
  version: string
  mode: Mode
  round: 1 | 2
  day: number
  title: string
  news: string
  wrinkle: Wrinkle
  economics: Economics
  walk: WalkProfile
  uncertain: boolean
  buildings: Building[]
  sites: Site[]
  reach: Reach[]
  contentHash: string
}

// Pre-solved plans. Kept on the server and in test fixtures, never shipped to browsers.
export interface SolvedScenario extends Scenario {
  optimal: Plan
  greedy: Plan
}

export interface Score {
  revenue: number
  ingredient: number
  truckCost: number
  profit: number
  won: Record<string, number>
  assign: Record<string, string | null>
}

export type Demand = Record<string, number>
