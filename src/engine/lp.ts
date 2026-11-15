import type { Demand, Scenario } from './types.ts'

const xv = (s: string) => `x_${s}`
const yv = (b: string, s: string) => `y_${b}_${s}`

function wrapTerms(terms: string[], perLine = 6): string {
  const lines: string[] = []
  for (let i = 0; i < terms.length; i += perLine) lines.push('  ' + terms.slice(i, i + perLine).join(' '))
  return lines.join('\n')
}

const signed = (c: number, v: string) => `${c < 0 ? '-' : '+'} ${Math.abs(c)} ${v}`

// Profit-maximizing uncapacitated facility location with disaggregated linking constraints (y_ij <= x_j).
export function buildLp(scn: Scenario, demand: Demand): string {
  const margin = scn.economics.revenue - scn.economics.ingredient
  const f = scn.economics.truckCost

  const obj: string[] = []
  for (const r of scn.reach) {
    const c = Math.round(margin * r.a * (demand[r.b] ?? 0) * 1e6) / 1e6
    if (c !== 0) obj.push(signed(c, yv(r.b, r.s)))
  }
  for (const s of scn.sites) obj.push(signed(-f, xv(s.id)))

  const rows: string[] = []
  const byBuilding = new Map<string, string[]>()
  for (const r of scn.reach) {
    if (!byBuilding.has(r.b)) byBuilding.set(r.b, [])
    byBuilding.get(r.b)!.push(yv(r.b, r.s))
  }
  for (const [b, vars] of byBuilding) {
    rows.push(` one_${b}:\n${wrapTerms(vars.map((v, i) => (i ? `+ ${v}` : v)))} <= 1`)
  }
  for (const r of scn.reach) rows.push(` link_${r.b}_${r.s}: ${yv(r.b, r.s)} - ${xv(r.s)} <= 0`)

  const bins = [...scn.sites.map((s) => xv(s.id)), ...scn.reach.map((r) => yv(r.b, r.s))]

  return [
    'Maximize',
    ' profit:',
    wrapTerms(obj),
    'Subject To',
    ...rows,
    'Binaries',
    wrapTerms(bins, 8),
    'End',
    '',
  ].join('\n')
}

export function openSitesFromColumns(scn: Scenario, columns: Record<string, unknown>): string[] {
  const primal = (name: string) => (columns[name] as { Primal?: number } | undefined)?.Primal ?? 0
  return scn.sites.filter((s) => primal(xv(s.id)) > 0.5).map((s) => s.id)
}
