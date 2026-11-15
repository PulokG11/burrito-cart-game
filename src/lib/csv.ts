import type { Scenario } from '../engine/types'

const row = (cells: (string | number)[]) =>
  cells.map((c) => (typeof c === 'string' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(',')

// CSV contract from TADD §4.4. Round 2 never includes actual demand.
export function dayCsv(scn: Scenario): Record<string, string> {
  const e = scn.economics
  return {
    'parameters.csv': [row(['day', 'revenue_per_burrito', 'ingredient_cost_per_burrito', 'truck_cost']), row([scn.id, e.revenue, e.ingredient, e.truckCost])].join('\n'),
    'customers.csv': [
      row(scn.uncertain ? ['customer_id', 'name', 'x', 'y', 'forecast', 'min', 'max'] : ['customer_id', 'name', 'x', 'y', 'demand']),
      ...scn.buildings.map((b) => row(scn.uncertain ? [b.id, b.name, b.x, b.y, b.demand, b.min ?? '', b.max ?? ''] : [b.id, b.name, b.x, b.y, b.demand])),
    ].join('\n'),
    'sites.csv': [row(['site_id', 'x', 'y', 'fixed_cost']), ...scn.sites.map((s) => row([s.id, s.x, s.y, e.truckCost]))].join('\n'),
    'distances.csv': [row(['customer_id', 'site_id', 'distance', 'demand_multiplier']), ...scn.reach.map((r) => row([r.b, r.s, r.d, r.a]))].join('\n'),
  }
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
