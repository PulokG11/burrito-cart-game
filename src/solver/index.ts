import type { Scenario } from '../engine/types'

interface SolveResult {
  openSiteIds: string[]
  objVal: number
  solveMs: number
}

let worker: Worker | null = null
let pending = new Map<string, { resolve: (r: SolveResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, error, ...result } = e.data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (error) p.reject(new Error(error))
      else p.resolve(result as SolveResult)
    }
  }
  return worker
}

let seq = 0

export function solveDay(scenario: Scenario, demand: Record<string, number>): Promise<SolveResult> {
  return new Promise((resolve, reject) => {
    const id = String(++seq)
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, scenario, demand })
  })
}
