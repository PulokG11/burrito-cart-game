import { distance } from './walk.ts'
import { score } from './score.ts'
import type { Demand, Scenario, Wrinkle } from './types.ts'

export type TipKind = 'wrinkle' | 'great' | 'movable' | 'underserved' | 'algorithm' | 'uncertainty' | 'count'

export interface Tip {
  kind: TipKind
  text: string
  at?: { x: number; y: number }
  to?: { x: number; y: number }
}

const WRINKLE_TEXT: Record<Wrinkle, string> = {
  opening: 'Every truck costs money, so a truck only pays off if enough customers can walk to it.',
  growth: 'More customers and bigger crowds: a truck that did not pay yesterday might pay today.',
  cost: 'Ingredients cost more today, so each customer earns less and every extra truck needs more customers to pay off.',
  rain: 'In the rain, customers will not walk as far. Each truck covers a smaller area, so more trucks can pay off.',
  festival: 'With this many possible spots there are more combinations than anyone could check by hand.',
  forecast: 'The numbers are forecasts. Actual demand can land anywhere inside the error bars.',
  volatile: 'A big forecast with wide error bars is a gamble. Plan for the average, not the best case.',
  critic: 'Trucks cost more today, so marginal spots are less likely to pay off.',
  upside: 'Some error bars stretch further up than down. Those buildings tend to beat their forecasts.',
  downside: 'Some error bars stretch further down than up. Those forecasts are optimistic.',
}

function direction(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const ns = Math.abs(dy) > 0.4 ? (dy < 0 ? 'north' : 'south') : ''
  const ew = Math.abs(dx) > 0.4 ? (dx < 0 ? 'west' : 'east') : ''
  return ns && ew ? `${ns}${ew}` : ns || ew || 'over'
}

export function buildTips(
  scn: Scenario,
  playerSites: string[],
  optimalSites: string[],
  demand: Demand,
  planned: Demand,
  greedySites: string[],
): Tip[] {
  const tips: Tip[] = [{ kind: 'wrinkle', text: WRINKLE_TEXT[scn.wrinkle] }]
  const site = new Map(scn.sites.map((s) => [s.id, s]))
  const opt = new Set(optimalSites)
  const base = score(scn, playerSites, planned)
  const f = scn.economics.truckCost

  // Great truck: an optimal site whose removal costs a lot.
  let great: { id: string; drop: number } | null = null
  for (const s of playerSites) {
    if (!opt.has(s)) continue
    const drop = base.profit - score(scn, playerSites.filter((p) => p !== s), planned).profit
    if (drop >= Math.max(f * 0.6, Math.abs(base.profit) * 0.15) && (!great || drop > great.drop)) great = { id: s, drop }
  }
  if (great) {
    tips.push({ kind: 'great', text: 'Great truck. It serves customers no other truck reaches.', at: site.get(great.id) })
  }

  // Good but could move: best single move within a short radius.
  let move: { from: string; to: string; gain: number } | null = null
  for (const s of playerSites) {
    if (opt.has(s)) continue
    const from = site.get(s)!
    for (const t of scn.sites) {
      if (playerSites.includes(t.id) || distance(from, t) > 3) continue
      const gain = score(scn, playerSites.map((p) => (p === s ? t.id : p)), planned).profit - base.profit
      if (gain > 1 && (!move || gain > move.gain)) move = { from: s, to: t.id, gain }
    }
  }
  if (move) {
    const dir = direction(site.get(move.from)!, site.get(move.to)!)
    tips.push({
      kind: 'movable',
      text: `Good spot, but moving this truck a little ${dir} would earn about $${Math.round(move.gain)} more.`,
      at: site.get(move.from),
      to: site.get(move.to),
    })
  }

  // Underserved area: an optimal site the player skipped that would add a lot on its own.
  let under: { id: string; gain: number } | null = null
  for (const s of optimalSites) {
    if (playerSites.includes(s)) continue
    const gain = score(scn, [...playerSites, s], planned).profit - base.profit
    if (gain > f * 0.2 && (!under || gain > under.gain)) under = { id: s, gain }
  }
  if (under) {
    tips.push({
      kind: 'underserved',
      text: 'This part of the city is underserved. A truck here would win many customers.',
      at: site.get(under.id),
    })
  }

  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
  if (sameSet(playerSites, greedySites) && !sameSet(playerSites, optimalSites)) {
    tips.push({
      kind: 'algorithm',
      text: 'You added the best truck one at a time. That works well, but it can miss better combinations, which is what a solver checks.',
    })
  } else if (playerSites.length >= optimalSites.length + 2) {
    tips.push({ kind: 'count', text: 'Diminishing returns: past a point, an extra truck mostly steals customers from your other trucks.' })
  } else if (playerSites.length + 2 <= optimalSites.length) {
    tips.push({ kind: 'count', text: 'There was room for more trucks today. Some areas had enough customers to pay for their own.' })
  }

  if (scn.uncertain) {
    const actual = score(scn, playerSites, demand)
    let worst: { id: string; short: number } | null = null
    for (const s of playerSites) {
      let exp = 0
      let got = 0
      for (const b of scn.buildings) {
        if (base.assign[b.id] !== s) continue
        exp += base.won[b.id]
        got += actual.won[b.id]
      }
      const short = exp - got
      if (exp > 0 && short / exp >= 0.2 && (!worst || short > worst.short)) worst = { id: s, short }
    }
    if (worst) {
      tips.push({ kind: 'uncertainty', text: 'This truck looked good on the forecast, but real demand nearby came in lower.', at: site.get(worst.id) })
    }
  }

  return tips.slice(0, 5)
}
