import highsLoader from 'highs'
import { describe, expect, it } from 'vitest'
import { drawActuals } from '../src/engine/demand'
import { greedy } from '../src/engine/greedy'
import { buildLp, openSitesFromColumns } from '../src/engine/lp'
import { expectedDemand, forecastDemand, gapPct, score } from '../src/engine/score'
import { buildTips } from '../src/engine/tips'
import type { Scenario } from '../src/engine/types'
import { alpha } from '../src/engine/walk'
import { SCENARIOS } from '../src/scenarios'

const byId = (id: string) => SCENARIOS.find((s) => s.id === id) as Scenario

describe('walking profile', () => {
  const w = { type: 'linear' as const, plateau: 0.8, maxDistance: 5 }
  it('is 1 inside the plateau, 0 beyond the limit, linear between', () => {
    expect(alpha(0.5, w)).toBe(1)
    expect(alpha(5, w)).toBe(0)
    expect(alpha(2.9, w)).toBe(0.5)
  })
})

describe('scoring', () => {
  it('reproduces every stored optimum (golden values)', () => {
    for (const scn of SCENARIOS) {
      expect(score(scn, scn.optimal.sites, expectedDemand(scn)).profit).toBeCloseTo(scn.optimal.plannedProfit, 1)
    }
  })

  it('charges trucks even when they serve nobody', () => {
    const scn = byId('v1-r1-d1')
    const s = score(scn, [], forecastDemand(scn))
    expect(s.profit).toBe(0)
    const lonely = scn.sites.find((t) => !scn.reach.some((r) => r.s === t.id))
    if (lonely) expect(score(scn, [lonely.id], forecastDemand(scn)).profit).toBe(-scn.economics.truckCost)
  })

  it('assigns each building to its nearest open truck', () => {
    const scn = byId('v1-r1-d2')
    const res = score(scn, scn.optimal.sites, forecastDemand(scn))
    for (const b of scn.buildings) {
      const options = scn.reach.filter((r) => r.b === b.id && scn.optimal.sites.includes(r.s))
      const best = Math.max(0, ...options.map((o) => o.a))
      expect(res.won[b.id]).toBeCloseTo(best * b.demand, 6)
    }
  })

  it('gap is relative to the optimum and never negative', () => {
    expect(gapPct(75, 100)).toBe(25)
    expect(gapPct(120, 100)).toBe(0)
  })
})

describe('demand draws', () => {
  it('are deterministic for a seed and stay inside the error bars', () => {
    for (const scn of SCENARIOS.filter((s) => s.uncertain)) {
      const a = drawActuals(scn, 'seed-1')
      expect(drawActuals(scn, 'seed-1')).toEqual(a)
      for (const b of scn.buildings) {
        expect(a[b.id]).toBeGreaterThanOrEqual(b.min!)
        expect(a[b.id]).toBeLessThanOrEqual(b.max!)
      }
    }
  })

  it('differ between seeds and equal the demand in Round 1', () => {
    const r2 = byId('v1-r2-d1')
    expect(drawActuals(r2, 'a')).not.toEqual(drawActuals(r2, 'b'))
    const r1 = byId('v1-r1-d3')
    expect(drawActuals(r1, 'anything')).toEqual(forecastDemand(r1))
  })
})

describe('solver', async () => {
  const highs = await highsLoader()
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s: HiGHS finds the stored optimum', (_id, scn) => {
    const sol = highs.solve(buildLp(scn, expectedDemand(scn)), { mip_rel_gap: 0 })
    expect(sol.Status).toBe('Optimal')
    expect(sol.ObjectiveValue).toBeCloseTo(scn.optimal.plannedProfit, 1)
    // The LP rounds coefficients to 1e-6, so allow a tiny difference against exact scoring.
    expect(score(scn, openSitesFromColumns(scn, sol.Columns), expectedDemand(scn)).profit).toBeCloseTo(sol.ObjectiveValue, 4)
  })

  it('greedy never beats the optimum, and loses on at least some days', () => {
    let losses = 0
    for (const scn of SCENARIOS) {
      const g = greedy(scn, expectedDemand(scn))
      expect(g.plannedProfit).toBeLessThanOrEqual(scn.optimal.plannedProfit + 1e-6)
      if (g.plannedProfit < scn.optimal.plannedProfit - 1) losses++
    }
    expect(losses).toBeGreaterThanOrEqual(3)
  })

  it('teaching days move the optimum the documented way', () => {
    const n = (id: string) => byId(id).optimal.sites.length
    expect(n('v1-r1-d3')).toBeLessThan(n('v1-r1-d2'))
    expect(n('v1-r1-d4')).toBeGreaterThan(n('v1-r1-d2'))
  })
})

describe('tips', () => {
  it('always explain the wrinkle first and do not nag an optimal player', () => {
    const scn = byId('v1-r1-d5')
    const d = expectedDemand(scn)
    const tips = buildTips(scn, scn.optimal.sites, scn.optimal.sites, d, d, scn.greedy.sites)
    expect(tips[0].kind).toBe('wrinkle')
    expect(tips.some((t) => t.kind === 'movable' || t.kind === 'underserved')).toBe(false)
  })

  it('point out the algorithm when the player played greedy', () => {
    const scn = byId('v1-r1-d3')
    const d = expectedDemand(scn)
    const tips = buildTips(scn, scn.greedy.sites, scn.optimal.sites, d, d, scn.greedy.sites)
    expect(tips.some((t) => t.kind === 'algorithm')).toBe(true)
  })
})
