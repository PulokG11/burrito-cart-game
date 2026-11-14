import type { Scenario } from './types'

export function drawDeterministic(scn: Scenario): Record<string, number> {
  return Object.fromEntries(scn.buildings.map((b) => [b.id, b.demand]))
}

export function drawTriangular(
  scn: Scenario,
  seedBytes: Uint8Array,
): Record<string, number> {
  const seed = Number(
    new DataView(seedBytes.buffer).getBigUint64(0, false) & BigInt(0xffffffffffff),
  )
  const rng = seededRandom(seed)

  return Object.fromEntries(
    scn.buildings.map((b) => {
      if (!scn.isUncertain || b.errMin == null || b.errMax == null || b.forecast == null) {
        return [b.id, b.demand]
      }
      return [b.id, Math.round(triangular(rng, b.errMin, b.errMax, b.forecast))]
    }),
  )
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

function triangular(rng: () => number, min: number, max: number, mode: number): number {
  const u = rng()
  const fc = (mode - min) / (max - min)
  if (u < fc) return min + Math.sqrt(u * (max - min) * (mode - min))
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
}
