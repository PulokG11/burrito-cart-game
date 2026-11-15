import type { Building, Reach, Site, WalkProfile } from './types.ts'

export const round3 = (v: number) => Math.round(v * 1000) / 1000

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function alpha(d: number, w: WalkProfile): number {
  if (d <= w.plateau) return 1
  if (d >= w.maxDistance) return 0
  return round3(1 - (d - w.plateau) / (w.maxDistance - w.plateau))
}

export function buildReach(buildings: Building[], sites: Site[], w: WalkProfile): Reach[] {
  const out: Reach[] = []
  for (const b of buildings) {
    for (const s of sites) {
      const d = round3(distance(b, s))
      const a = alpha(d, w)
      if (a > 0) out.push({ b: b.id, s: s.id, d, a })
    }
  }
  return out
}
