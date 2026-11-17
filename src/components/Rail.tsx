import type { ReactNode } from 'react'
import type { WalkProfile } from '../engine/types'
import { alpha } from '../engine/walk'
import { SCENARIOS } from '../scenarios'

export function Rail({ children }: { children: ReactNode }) {
  return <aside className="rail flex w-full flex-col gap-5 p-6 lg:w-[360px] lg:shrink-0">{children}</aside>
}

export function RailDivider() {
  return <div className="h-px bg-white/20" aria-hidden />
}

export function Progress({ current, done }: { current: number; done: number }) {
  return (
    <div className="grid grid-cols-[64px_repeat(5,24px)] items-center gap-1.5 text-[13px] text-[#C9D4F2]" aria-label={`Day ${current + 1} of ${SCENARIOS.length}`}>
      {[0, 1].map((r) => (
        <div key={r} className="contents">
          <span>Round {r + 1}</span>
          {SCENARIOS.slice(r * 5, r * 5 + 5).map((s, k) => {
            const i = r * 5 + k
            return (
              <span
                key={s.id}
                title={`${s.title}`}
                className={`h-6 w-6 rounded-[5px] ${i < done ? 'bg-[#F6B22B]' : i === current ? 'border-2 border-[#F6B22B] bg-[#F6B22B]/25' : 'bg-white/15'}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Share of customers who walk over, by distance in blocks (3 map units).
export function WalkCurve({ walk, at }: { walk: WalkProfile; at: number | null }) {
  const W = 300, top = 10, bottom = 88, left = 8
  const maxBlocks = (walk.maxDistance / 3) * 1.15
  const px = (units: number) => left + (units / 3 / maxBlocks) * (W - left - 8)
  const py = (a: number) => bottom - a * (bottom - top)
  const share = at == null ? null : alpha(at, walk)
  return (
    <svg width="100%" viewBox={`0 0 ${W} 118`} role="img" aria-label={`Walking curve: everyone comes from close by, nobody past ${(walk.maxDistance / 3).toFixed(1)} blocks${share != null ? `. This building gets ${Math.round(share * 100)} percent` : ''}`}>
      <line x1={left} y1={bottom} x2={W - 4} y2={bottom} stroke="rgba(255,255,255,0.35)" />
      <line x1={left} y1={top} x2={left} y2={bottom} stroke="rgba(255,255,255,0.35)" />
      <path d={`M${left} ${py(1)} H${px(walk.plateau)} L${px(walk.maxDistance)} ${py(0)} H${W - 4}`} fill="none" stroke="#F6B22B" strokeWidth={3} strokeLinejoin="round" />
      {at != null && share != null && (
        <>
          <line x1={px(Math.min(at, walk.maxDistance * 1.1))} y1={py(share)} x2={px(Math.min(at, walk.maxDistance * 1.1))} y2={bottom} stroke="#fff" strokeDasharray="3 3" />
          <circle cx={px(Math.min(at, walk.maxDistance * 1.1))} cy={py(share)} r={6} fill="#fff" stroke="#F6B22B" strokeWidth={3} />
          <text x={Math.min(px(at) + 10, 200)} y={Math.max(py(share) - 6, 22)} fill="#fff" fontSize={13} fontWeight={700}>
            {Math.round(share * 100)}% walk over
          </text>
        </>
      )}
      <text x={left} y={106} fill="#C9D4F2" fontSize={12}>0</text>
      <text x={px(3)} y={106} fill="#C9D4F2" fontSize={12} textAnchor="middle">1 block</text>
      <text x={Math.min(px(walk.maxDistance), W - 30)} y={106} fill="#C9D4F2" fontSize={12} textAnchor="middle">
        {(walk.maxDistance / 3).toFixed(1)}
      </text>
      <text x={left + 6} y={top + 12} fill="#C9D4F2" fontSize={12}>All</text>
    </svg>
  )
}
