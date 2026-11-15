import type { Demand, Scenario } from './types.ts'

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function triangular(u: number, min: number, max: number, mode: number): number {
  if (max <= min) return mode
  const fc = (mode - min) / (max - min)
  if (u < fc) return min + Math.sqrt(u * (max - min) * (mode - min))
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
}

// Same seed + same scenario => same draws on client and server (and for every Championship player).
export function drawActuals(scn: Scenario, seed: string): Demand {
  const rng = mulberry32(hashString(`${seed}|${scn.contentHash}`))
  const out: Demand = {}
  for (const b of [...scn.buildings].sort((p, q) => (p.id < q.id ? -1 : 1))) {
    const u = rng()
    out[b.id] =
      scn.uncertain && b.min != null && b.max != null
        ? Math.round(triangular(u, b.min, b.max, b.demand))
        : b.demand
  }
  return out
}

export function randomSeed(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
