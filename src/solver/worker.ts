import highsLoader from 'highs'
import wasmUrl from 'highs/runtime?url'
import { buildLp, openSitesFromColumns } from '../engine/lp'
import { expectedDemand } from '../engine/score'
import type { Scenario } from '../engine/types'

let highs: ReturnType<typeof highsLoader> | null = null

self.onmessage = async (e: MessageEvent<{ id: number; scenario: Scenario }>) => {
  const { id, scenario } = e.data
  try {
    highs ??= highsLoader({ locateFile: () => new URL(wasmUrl, self.location.href).href })
    const h = await highs
    const lp = buildLp(scenario, expectedDemand(scenario))
    const t0 = performance.now()
    const sol = h.solve(lp, { mip_rel_gap: 0 })
    const ms = performance.now() - t0
    self.postMessage({
      id,
      status: sol.Status,
      sites: openSitesFromColumns(scenario, sol.Columns),
      objective: sol.ObjectiveValue,
      ms,
    })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}
