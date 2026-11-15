import type { Scenario } from '../engine/types'

export interface LiveSolve {
  status: string
  sites: string[]
  objective: number
  ms: number
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, (r: LiveSolve | null) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, error, ...rest } = e.data
      const done = pending.get(id)
      pending.delete(id)
      done?.(error ? null : (rest as LiveSolve))
    }
    worker.onerror = () => {
      for (const done of pending.values()) done(null)
      pending.clear()
      worker = null
    }
  }
  return worker
}

// Live solve on the player's device. Resolves null on failure or timeout; callers fall back to the pre-solved optimum.
export function solveLive(scenario: Scenario, timeoutMs = 15000): Promise<LiveSolve | null> {
  return new Promise((resolve) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve(null)
    }, timeoutMs)
    pending.set(id, (r) => {
      clearTimeout(timer)
      resolve(r)
    })
    try {
      getWorker().postMessage({ id, scenario })
    } catch {
      clearTimeout(timer)
      pending.delete(id)
      resolve(null)
    }
  })
}

export function warmUpSolver() {
  try {
    getWorker()
  } catch {
    /* solver stays optional */
  }
}
