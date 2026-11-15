// Generates scenario data (src/scenarios/v1.json) and the DB seed (backend/seed/010_scenarios.sql),
// pre-solving every day with HiGHS. Run: npm run scenarios
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import highsLoader from 'highs'
import { hashString, mulberry32 } from '../src/engine/demand.ts'
import { greedy } from '../src/engine/greedy.ts'
import { buildLp, openSitesFromColumns } from '../src/engine/lp.ts'
import { expectedDemand, score } from '../src/engine/score.ts'
import type { Building, Economics, Scenario, Site, WalkProfile, Wrinkle } from '../src/engine/types.ts'
import { buildReach } from '../src/engine/walk.ts'

const VERSION = 'v1'

const NAMES = [
  'Simplex Station', 'Branch & Bound Books', 'Gradient Descent Ski Shop', 'Lagrange Gym',
  'Dual Diner', 'Knapsack Outfitters', 'Monte Carlo Casino', 'Markov Chain Hardware',
  'Bayes Bakery', 'Heuristic Hostel', 'Pareto Porch Cafe', 'Convex Hull Shipyard',
  'Big-M Mall', 'Slack Variable Yoga', 'Shadow Price Thrift', 'Kernel Trick Magic Shop',
  'Random Forest Lodge', 'Stochastic Stadium', 'Newsvendor Newsstand', 'Queueing Cinema',
  'Hessian Hospital', 'Eigenvalue Elementary', 'Sigmoid Salon', 'Backprop Bistro',
  'Cutting Plane Woodshop', 'Column Generation Tower', 'Benders Brewery', 'Dijkstra Depot',
  'Min-Cut Barbers', 'Max-Flow Waterpark', 'Gaussian Gallery', 'Bootstrap Boots',
  'Lasso Ranch Supply', 'Ridge Rec Center', 'Epsilon Apartments', 'Feasible Region Hall',
  'Objective Office Park', 'Annealing Forge', 'Tabu Search Library', 'Genetic Garden Center',
  'Duality Gap Bridge Club', 'Warm Start Coffee', 'Presolve Pharmacy', 'Interior Point Plaza',
  'Basis Barn', 'Polytope Pottery', 'Integrality Arcade', 'Pivot Rule Pizza',
]

const STREETS_X = [1, 4, 7, 10, 13, 16, 19]
const STREETS_Y = [1, 4, 7, 10, 13]

const r1 = (v: number) => Math.round(v * 10) / 10

// 48 building slots: two per city block.
const SLOTS = (() => {
  const out: { x: number; y: number }[] = []
  for (let j = 0; j < STREETS_Y.length - 1; j++) {
    for (let i = 0; i < STREETS_X.length - 1; i++) {
      const cx = (STREETS_X[i] + STREETS_X[i + 1]) / 2
      const cy = (STREETS_Y[j] + STREETS_Y[j + 1]) / 2
      out.push({ x: r1(cx - 0.7), y: r1(cy - 0.5) }, { x: r1(cx + 0.7), y: r1(cy + 0.5) })
    }
  }
  return out.map((p, i) => ({ ...p, id: `B${String(i + 1).padStart(2, '0')}`, name: NAMES[i] }))
})()

// 93 curbside spots: intersections plus mid-block points on every street.
const SPOTS = (() => {
  const out: { x: number; y: number }[] = []
  for (const x of STREETS_X) for (const y of STREETS_Y) out.push({ x, y })
  for (const y of STREETS_Y) for (let i = 0; i < STREETS_X.length - 1; i++) out.push({ x: (STREETS_X[i] + STREETS_X[i + 1]) / 2, y })
  for (const x of STREETS_X) for (let j = 0; j < STREETS_Y.length - 1; j++) out.push({ x, y: (STREETS_Y[j] + STREETS_Y[j + 1]) / 2 })
  return out
})()

function shuffled<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const spotOrder = { 1: shuffled(SPOTS, 'spots-r1'), 2: shuffled(SPOTS, 'spots-r2') }
const slotOrder = { 1: shuffled(SLOTS, 'slots-r1'), 2: shuffled(SLOTS, 'slots-r2') }

function sitesFor(round: 1 | 2, n: number): Site[] {
  return spotOrder[round]
    .slice(0, n)
    .map((p) => ({ x: p.x, y: p.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((p, i) => ({ id: `S${String(i + 1).padStart(2, '0')}`, ...p }))
}

type DemandFn = (slot: (typeof SLOTS)[number], rng: () => number) => { demand: number; min?: number; max?: number }

const between = (rng: () => number, lo: number, hi: number) => Math.round(lo + rng() * (hi - lo))

function buildingsFor(round: 1 | 2, n: number, seed: string, fn: DemandFn, force: string[] = []): Building[] {
  const rng = mulberry32(hashString(seed))
  const picked = [...slotOrder[round].filter((s) => force.includes(s.name)), ...slotOrder[round].filter((s) => !force.includes(s.name))].slice(0, n)
  return picked
    .map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y, ...fn(s, rng) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

const sym = (spread: number): DemandFn => (_s, rng) => {
  const d = between(rng, 20, 60)
  return { demand: d, min: Math.max(0, Math.floor(d * (1 - spread))), max: Math.ceil(d * (1 + spread)) }
}

const NORMAL_WALK: WalkProfile = { type: 'linear', plateau: 0.8, maxDistance: 5 }
const RAIN_WALK: WalkProfile = { type: 'linear', plateau: 0.6, maxDistance: 3.4 }
const BASE_ECON: Economics = { revenue: 10, ingredient: 5, truckCost: 250 }

const econLine = (e: Economics) =>
  `Each truck costs $${e.truckCost} for the day. Each burrito sells for $${e.revenue} and costs $${e.ingredient} in ingredients.`

interface DaySpec {
  round: 1 | 2
  day: number
  title: string
  story: string
  wrinkle: Wrinkle
  sites: number
  buildings: Building[]
  economics: Economics
  walk: WalkProfile
}

// Round 1, Days 2-4 share one city so the cost shock and the rain are clean comparisons.
const r1d1 = buildingsFor(1, 12, 'r1d1', (_s, rng) => ({ demand: between(rng, 20, 60) }))
const r1city = buildingsFor(1, 20, 'r1city', (_s, rng) => ({ demand: between(rng, 40, 90) }))
const r1d5 = buildingsFor(1, 30, 'r1d5', (s, rng) => {
  const near = Math.hypot(s.x - 10, s.y - 7) < 4
  return { demand: near ? between(rng, 60, 110) : between(rng, 15, 50) }
})

const r2d2 = buildingsFor(2, 22, 'r2d2', (s, rng) =>
  s.name === 'Stochastic Stadium' ? { demand: 120, min: 15, max: 140 } : sym(0.25)(s, rng),
  ['Stochastic Stadium'],
)
const r2d4 = buildingsFor(2, 26, 'r2d4', (s, rng) => {
  const d = between(rng, 15, 45)
  return s.x > 10
    ? { demand: d, min: Math.floor(d * 0.85), max: Math.ceil(d * 1.7) }
    : { demand: d, min: Math.floor(d * 0.8), max: Math.ceil(d * 1.2) }
})
const r2d5 = buildingsFor(2, 30, 'r2d5', (s, rng) => {
  const d = between(rng, 15, 50)
  return s.y < 7
    ? { demand: d, min: Math.floor(d * 0.35), max: Math.ceil(d * 1.1) }
    : { demand: d, min: Math.floor(d * 0.75), max: Math.ceil(d * 1.25) }
})

const SPECS: DaySpec[] = [
  { round: 1, day: 1, title: 'Grand opening', wrinkle: 'opening', sites: 16, buildings: r1d1, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'Burrito Cart Co. opens in Salsa Springs! Customers in each building will walk to the nearest truck, but the farther they have to go, the fewer of them make the trip.' },
  { round: 1, day: 2, title: 'Business is picking up', wrinkle: 'growth', sites: 24, buildings: r1city, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'Word is out. More buildings want burritos today, and the crowds are bigger.' },
  { round: 1, day: 3, title: 'Cheese shortage', wrinkle: 'cost', sites: 32, buildings: r1city, economics: { ...BASE_ECON, ingredient: 7 }, walk: NORMAL_WALK,
    story: 'A cheese-supply disruption pushes ingredient costs up. Same city as yesterday. Should you open more trucks, or fewer?' },
  { round: 1, day: 4, title: 'Rainy day', wrinkle: 'rain', sites: 44, buildings: r1city, economics: BASE_ECON, walk: RAIN_WALK,
    story: 'It is pouring. Customers will not walk nearly as far for a burrito today. Same city and costs as Day 2.' },
  { round: 1, day: 5, title: 'Festival weekend', wrinkle: 'festival', sites: 56, buildings: r1d5, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'The downtown festival draws huge crowds to the city center. With 56 possible spots, there are about 72 quadrillion ways to place trucks.' },
  { round: 2, day: 1, title: 'Forecasts only', wrinkle: 'forecast', sites: 24, buildings: buildingsFor(2, 18, 'r2d1', sym(0.3)), economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'From now on the numbers are forecasts. Actual demand is random and revealed after you click Done. The error bars show the range it will fall in.' },
  { round: 2, day: 2, title: 'Concert night', wrinkle: 'volatile', sites: 32, buildings: r2d2, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'A concert at Stochastic Stadium might sell out, or it might rain out. The forecast is huge, but so is the uncertainty.' },
  { round: 2, day: 3, title: 'Permit fees up', wrinkle: 'critic', sites: 40, buildings: buildingsFor(2, 24, 'r2d3', sym(0.3)), economics: { ...BASE_ECON, truckCost: 320 }, walk: NORMAL_WALK,
    story: 'The city raised street-vending permit fees, so every truck costs more today.' },
  { round: 2, day: 4, title: 'Heat wave', wrinkle: 'upside', sites: 48, buildings: r2d4, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'A heat wave hits the east side. People there may come out in bigger numbers than forecast. Notice the lopsided error bars.' },
  { round: 2, day: 5, title: 'Marathon morning', wrinkle: 'downside', sites: 56, buildings: r2d5, economics: BASE_ECON, walk: NORMAL_WALK,
    story: 'A marathon closes streets in the north. Forecasts there are probably too optimistic: demand is more likely to come in below them.' },
]

function hashOf(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16)
}

const highs = await highsLoader()

function solve(scn: Scenario): { sites: string[]; objective: number; ms: number } {
  const t0 = performance.now()
  const sol = highs.solve(buildLp(scn, expectedDemand(scn)), { mip_rel_gap: 0 })
  const ms = performance.now() - t0
  if (sol.Status !== 'Optimal') throw new Error(`${scn.id}: solver status ${sol.Status}`)
  return { sites: openSitesFromColumns(scn, sol.Columns), objective: sol.ObjectiveValue, ms }
}

function bruteForce(scn: Scenario): number {
  const demand = expectedDemand(scn)
  let best = -Infinity
  const n = scn.sites.length
  for (let mask = 0; mask < 1 << n; mask++) {
    const open = scn.sites.filter((_, i) => mask & (1 << i)).map((s) => s.id)
    best = Math.max(best, score(scn, open, demand).profit)
  }
  return best
}

const scenarios: Scenario[] = []
for (const spec of SPECS) {
  const sites = sitesFor(spec.round, spec.sites)
  const uncertain = spec.round === 2
  const core = {
    version: VERSION, mode: 'normal' as const, round: spec.round, day: spec.day,
    economics: spec.economics, walk: spec.walk, buildings: spec.buildings, sites,
  }
  const scn: Scenario = {
    id: `${VERSION}-r${spec.round}-d${spec.day}`,
    ...core,
    title: spec.title,
    news: `${spec.story} ${econLine(spec.economics)}`,
    wrinkle: spec.wrinkle,
    uncertain,
    reach: buildReach(spec.buildings, sites, spec.walk),
    contentHash: hashOf(core),
    optimal: { sites: [], plannedProfit: 0 },
    greedy: { sites: [], plannedProfit: 0 },
  }

  const sol = solve(scn)
  const check = score(scn, sol.sites, expectedDemand(scn)).profit
  if (Math.abs(check - sol.objective) > 1e-4) throw new Error(`${scn.id}: solver ${sol.objective} != engine ${check}`)
  if (spec.round === 1 && spec.day === 1) {
    const bf = bruteForce(scn)
    if (Math.abs(bf - check) > 1e-6) throw new Error(`${scn.id}: brute force ${bf} != solver ${check}`)
    console.log(`  brute force over ${2 ** sites.length} subsets agrees: ${bf.toFixed(2)}`)
  }
  scn.optimal = { sites: sol.sites, plannedProfit: Math.round(check * 100) / 100 }
  const g = greedy(scn, expectedDemand(scn))
  scn.greedy = { sites: g.sites, plannedProfit: Math.round(g.plannedProfit * 100) / 100 }
  scenarios.push(scn)

  console.log(
    `${scn.id.padEnd(9)} sites=${String(sites.length).padStart(2)} bldg=${String(spec.buildings.length).padStart(2)} reach=${String(scn.reach.length).padStart(4)} ` +
      `opt=${scn.optimal.sites.length} trucks $${scn.optimal.plannedProfit.toFixed(0).padStart(5)}  ` +
      `greedy=${scn.greedy.sites.length} trucks $${scn.greedy.plannedProfit.toFixed(0).padStart(5)}  ${sol.ms.toFixed(0)}ms`,
  )
}

mkdirSync('src/scenarios', { recursive: true })
writeFileSync('src/scenarios/v1.json', JSON.stringify(scenarios) + '\n')

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const sql: string[] = [
  '-- Generated by scripts/build-scenarios.ts. Do not edit by hand.',
  '-- Scenarios are immutable once released, so re-running is a no-op.',
  'BEGIN;',
]
for (const s of scenarios) {
  const e = s.economics
  sql.push(
    `INSERT INTO scenario (scenario_id, version, mode, round, day, title, news_text, wrinkle, revenue_r, ingredient_k, truck_cost_f, walk_plateau, walk_max, is_uncertain, content_hash) VALUES (` +
      [q(s.id), q(s.version), q(s.mode), s.round, s.day, q(s.title), q(s.news), q(s.wrinkle), e.revenue, e.ingredient, e.truckCost, s.walk.plateau, s.walk.maxDistance, s.uncertain, q(s.contentHash)].join(', ') +
      `) ON CONFLICT (scenario_id) DO NOTHING;`,
  )
  sql.push(
    `INSERT INTO scenario_building (scenario_id, building_id, name, x, y, demand, err_min, err_max) VALUES\n` +
      s.buildings.map((b) => `  (${[q(s.id), q(b.id), q(b.name), b.x, b.y, b.demand, b.min ?? 'NULL', b.max ?? 'NULL'].join(', ')})`).join(',\n') +
      `\nON CONFLICT DO NOTHING;`,
  )
  sql.push(
    `INSERT INTO scenario_site (scenario_id, site_id, x, y) VALUES\n` +
      s.sites.map((t) => `  (${[q(s.id), q(t.id), t.x, t.y].join(', ')})`).join(',\n') +
      `\nON CONFLICT DO NOTHING;`,
  )
  sql.push(
    `INSERT INTO scenario_reach (scenario_id, building_id, site_id, distance, alpha) VALUES\n` +
      s.reach.map((r) => `  (${[q(s.id), q(r.b), q(r.s), r.d, r.a].join(', ')})`).join(',\n') +
      `\nON CONFLICT DO NOTHING;`,
  )
  sql.push(
    `INSERT INTO optimal_solution (scenario_id, content_hash, open_sites, planned_profit, greedy_sites, greedy_profit, solver) VALUES (` +
      [q(s.id), q(s.contentHash), `ARRAY[${s.optimal.sites.map(q).join(', ')}]::text[]`, s.optimal.plannedProfit, `ARRAY[${s.greedy.sites.map(q).join(', ')}]::text[]`, s.greedy.plannedProfit, q('highs-1.15.4')].join(', ') +
      `) ON CONFLICT (scenario_id) DO NOTHING;`,
  )
}
sql.push('COMMIT;', '')
mkdirSync('backend/seed', { recursive: true })
writeFileSync('backend/seed/010_scenarios.sql', sql.join('\n'))
console.log(`wrote src/scenarios/v1.json and backend/seed/010_scenarios.sql (${scenarios.length} scenarios)`)
