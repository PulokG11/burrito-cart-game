import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Tip } from '../engine/tips'
import type { Demand, Scenario, Score } from '../engine/types'
import { glyphFor, TINTS } from '../lib/glyphs'

export const MAP_W = 20
export const MAP_H = 14
const STREETS_X = [1, 4, 7, 10, 13, 16, 19]
const STREETS_Y = [1, 4, 7, 10, 13]
const HW = 0.31
const K = 0.035 // map units per customer on Round 2 range bars

export interface MapHandle {
  toMap(clientX: number, clientY: number): { x: number; y: number } | null
}

interface Props {
  scn: Scenario
  open: string[]
  demand: Demand
  result: Score
  ranges?: boolean
  actual?: Demand
  best?: string[]
  interactive?: boolean
  dragging?: boolean
  ghost?: { x: number; y: number } | null
  hiddenTruck?: string | null
  catchment?: { x: number; y: number } | null
  tips?: Tip[]
  showLinks?: boolean
  showTrucks?: boolean
  names?: boolean
  animate?: boolean
  hovered?: string | null
  onSiteActivate?: (id: string) => void
  onTruckPointerDown?: (id: string, e: ReactPointerEvent) => void
  onHover?: (buildingId: string | null) => void
  label: string
}

const onV = (x: number) => STREETS_X.includes(x)
const onH = (y: number) => STREETS_Y.includes(y)

function TruckShape({ x, y, vertical, lifted = false, ghost = false }: { x: number; y: number; vertical: boolean; lifted?: boolean; ghost?: boolean }) {
  const s = lifted ? 0.022 : 0.019
  return (
    <g transform={`translate(${x} ${y}) rotate(${vertical ? 90 : 0}) scale(${s}) translate(-23 -14)`} className="pointer-events-none">
      {ghost ? (
        <rect x={1.5} y={2.5} width={42} height={21} rx={4} fill="rgba(246,178,43,0.25)" stroke="#F6B22B" strokeWidth={3} strokeDasharray="5 3" />
      ) : (
        <>
          <rect x={lifted ? 6 : 3} y={lifted ? 12 : 5} width={32} height={21} rx={4} fill={lifted ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)'} />
          <rect x={1} y={2} width={33} height={22} rx={4} fill="#1C3A8A" />
          <rect x={1} y={2} width={33} height={6} rx={3} fill="#F6B22B" />
          <rect x={33} y={5} width={11} height={16} rx={3.5} fill="#2D55B8" />
          <rect x={40} y={7} width={3} height={12} rx={1} fill="#CFE3FF" />
          <ellipse cx={17} cy={15} rx={8} ry={4.2} fill="#F3D9A4" stroke="#B8892E" strokeWidth={1.5} />
        </>
      )}
    </g>
  )
}

export const CityMap = forwardRef<MapHandle, Props>(function CityMap(props, ref) {
  const {
    scn, open, demand, result, ranges, actual, best, interactive, dragging, ghost, hiddenTruck, catchment,
    tips, showLinks, showTrucks = true, names, animate, hovered, onSiteActivate, onTruckPointerDown, onHover, label,
  } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const siteById = useMemo(() => new Map(scn.sites.map((s) => [s.id, s])), [scn])
  const openSet = useMemo(() => new Set(open), [open])
  const bestSet = useMemo(() => new Set(best ?? []), [best])

  useImperativeHandle(ref, () => ({
    toMap(clientX, clientY) {
      const m = svgRef.current?.getScreenCTM()
      if (!m) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
      return { x: p.x, y: p.y }
    },
  }))

  const blocks = useMemo(() => {
    const xs = [0, ...STREETS_X, MAP_W]
    const ys = [0, ...STREETS_Y, MAP_H]
    const out: { x: number; y: number; w: number; h: number; inner: boolean; park: boolean }[] = []
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x0 = xs[i] === 0 ? 0 : xs[i] + HW
        const x1 = xs[i + 1] === MAP_W ? MAP_W : xs[i + 1] - HW
        const y0 = ys[j] === 0 ? 0 : ys[j] + HW
        const y1 = ys[j + 1] === MAP_H ? MAP_H : ys[j + 1] - HW
        const inner = i > 0 && i < xs.length - 2 && j > 0 && j < ys.length - 2
        const occupied = scn.buildings.some((b) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1)
        out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, inner, park: inner && !occupied })
      }
    }
    return out
  }, [scn])

  // Range bar for the upper-left building of a shared block stops before its neighbour's roof.
  const rightLimit = useMemo(() => {
    const lim = new Map<string, number>()
    for (const b of scn.buildings) {
      const n = scn.buildings.find((o) => Math.abs(o.x - (b.x + 1.4)) < 0.05 && Math.abs(o.y - (b.y + 1)) < 0.05)
      if (n) lim.set(b.id, n.x - 0.58)
    }
    return lim
  }, [scn])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const walkers: { bx: number; by: number; sx: number; sy: number; phase: number; speed: number }[] = []
    for (const b of scn.buildings) {
      const sid = result.assign[b.id]
      const won = result.won[b.id]
      if (!sid || !won || sid === hiddenTruck) continue
      const s = siteById.get(sid)!
      const n = Math.max(1, Math.min(6, Math.round(won / 10)))
      for (let k = 0; k < n; k++) walkers.push({ bx: b.x, by: b.y, sx: s.x, sy: s.y, phase: (k + Math.random()) / n, speed: 0.12 + Math.random() * 0.05 })
    }
    let raf = 0
    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const k = w / MAP_W
      for (const p of walkers) {
        const u = (t / 1000) * p.speed + p.phase
        const f = u - Math.floor(u)
        const e = f < 0.85 ? f / 0.85 : 1
        ctx.globalAlpha = f < 0.85 ? 1 : 1 - (f - 0.85) / 0.15
        ctx.beginPath()
        ctx.arc((p.bx + (p.sx - p.bx) * e) * k, (p.by + (p.sy - p.by) * e) * k, Math.max(2.5, k * 0.075), 0, Math.PI * 2)
        ctx.fillStyle = '#F6B22B'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#1C3A8A'
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [animate, scn, result, siteById, hiddenTruck])

  const anchored = (tips ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter((t) => t.at)
  const reach = scn.walk.maxDistance

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="absolute inset-0 h-full w-full rounded-2xl"
        role="group"
        aria-label={label}
        style={{ touchAction: interactive ? 'none' : 'auto' }}
      >
        <defs>
          <radialGradient id="catch">
            <stop offset="0" stopColor="#2E8B57" stopOpacity="0.45" />
            <stop offset={scn.walk.plateau / reach} stopColor="#2E8B57" stopOpacity="0.32" />
            <stop offset="1" stopColor="#2E8B57" stopOpacity="0.05" />
          </radialGradient>
          <clipPath id="mapclip">
            <rect width={MAP_W} height={MAP_H} rx={0.35} />
          </clipPath>
        </defs>
        <g clipPath="url(#mapclip)">
          <rect width={MAP_W} height={MAP_H} fill="var(--asphalt)" />
          {blocks.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.inner ? 0.23 : 0.08} fill={b.park ? 'var(--park)' : 'var(--sidewalk)'} />
          ))}
          {blocks.filter((b) => b.park).map((b, i) => (
            <g key={`t${i}`}>
              {[[0.28, 0.3, 0.29, '#2E8B57'], [0.66, 0.4, 0.37, '#3F9A63'], [0.4, 0.74, 0.25, '#2E8B57'], [0.76, 0.78, 0.21, '#3F9A63']].map(([fx, fy, r, c], k) => (
                <circle key={k} cx={b.x + b.w * (fx as number)} cy={b.y + b.h * (fy as number)} r={r as number} fill={c as string} />
              ))}
            </g>
          ))}
          {STREETS_X.map((x) => <line key={`vx${x}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="rgba(255,255,255,0.5)" strokeWidth={0.04} strokeDasharray="0.2 0.26" />)}
          {STREETS_Y.map((y) => <line key={`hy${y}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="rgba(255,255,255,0.5)" strokeWidth={0.04} strokeDasharray="0.2 0.26" />)}

          {catchment && (
            <g className="pointer-events-none">
              <circle cx={catchment.x} cy={catchment.y} r={reach} fill="url(#catch)" stroke="#2E8B57" strokeWidth={0.05} strokeDasharray="0.18 0.12" />
            </g>
          )}

          {showLinks &&
            scn.buildings.map((b) => {
              const s = result.assign[b.id] ? siteById.get(result.assign[b.id]!) : null
              return s ? <line key={`l${b.id}`} x1={b.x} y1={b.y} x2={s.x} y2={s.y} stroke="#1C3A8A" strokeOpacity={0.85} strokeWidth={0.06} strokeDasharray="0.14 0.1" /> : null
            })}

          {scn.sites.map((s) => {
            const occupied = (showTrucks && openSet.has(s.id) && s.id !== hiddenTruck) || bestSet.has(s.id)
            if (occupied) return null
            const v = onV(s.x), h = onH(s.y)
            const w = v && h ? 0.34 : v ? 0.26 : 0.5
            const ht = v && h ? 0.34 : v ? 0.5 : 0.26
            return (
              <rect
                key={`b${s.id}`}
                x={s.x - w / 2}
                y={s.y - ht / 2}
                width={w}
                height={ht}
                rx={0.06}
                fill={dragging ? 'rgba(246,178,43,0.45)' : 'rgba(246,178,43,0.16)'}
                stroke="#F6B22B"
                strokeWidth={0.045}
                opacity={interactive || dragging ? 1 : 0.55}
                className={dragging ? 'bay-pulse' : undefined}
              />
            )
          })}

          {scn.buildings.map((b, i) => {
            const isHover = hovered === b.id
            return (
              <g key={b.id} onPointerEnter={() => onHover?.(b.id)} onPointerLeave={() => onHover?.(null)}>
                <title>{b.name}</title>
                <rect x={b.x - 0.52} y={b.y - 0.44} width={1.04} height={1.04} rx={0.17} fill="rgba(28,58,138,0.3)" />
                <rect
                  x={b.x - 0.52}
                  y={b.y - 0.52}
                  width={1.04}
                  height={1.04}
                  rx={0.17}
                  fill={TINTS[i % TINTS.length]}
                  stroke={isHover ? '#F6B22B' : 'rgba(28,58,138,0.55)'}
                  strokeWidth={isHover ? 0.08 : 0.04}
                />
                <svg x={b.x - 0.27} y={b.y - 0.27} width={0.54} height={0.54} viewBox="0 0 24 24" aria-hidden="true">
                  <path d={glyphFor(b.name)} fill="none" stroke="#1C3A8A" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </g>
            )
          })}

          {ranges &&
            scn.buildings.map((b) => {
              if (b.min == null || b.max == null) return null
              const mean = (b.min + b.max + b.demand) / 3
              const tw = (b.max - b.min) * K
              const pw = tw + 0.92
              let left = b.x - 0.46 - (b.demand - b.min) * K
              const lim = rightLimit.get(b.id)
              if (lim != null) left = Math.min(left, lim - pw)
              const y = b.y + 0.64
              const t0 = left + 0.46
              return (
                <g key={`r${b.id}`} className="pointer-events-none">
                  <rect x={left} y={y} width={pw} height={0.44} rx={0.22} fill="#FFFFFF" />
                  <text x={t0 - 0.07} y={y + 0.3} textAnchor="end" fontSize={0.23} fontWeight={700} fill="#1C3A8A">{b.min}</text>
                  <text x={t0 + tw + 0.07} y={y + 0.3} fontSize={0.23} fontWeight={700} fill="#1C3A8A">{b.max}</text>
                  <rect x={t0} y={y + 0.15} width={tw} height={0.14} rx={0.07} fill="rgba(28,58,138,0.22)" />
                  <path d={`M${t0 + (mean - b.min) * K - 0.08} ${y + 0.02} h0.16 l-0.08 0.12z`} fill="#1C3A8A" />
                  <rect x={t0 + (b.demand - b.min) * K - 0.03} y={y + 0.08} width={0.06} height={0.28} fill="#CF2E22" />
                  {actual && (
                    <circle cx={t0 + (actual[b.id] - b.min) * K} cy={y + 0.22} r={0.12} fill="#F6B22B" stroke="#1C3A8A" strokeWidth={0.04} />
                  )}
                </g>
              )
            })}

          {scn.buildings.map((b) => {
            const shown = demand[b.id] ?? 0
            const frac = shown > 0 ? Math.min(1, (result.won[b.id] ?? 0) / shown) : 0
            const R = 0.4
            const C = 2 * Math.PI * R
            const cx = b.x + 0.4
            const cy = b.y - 0.42
            return (
              <g key={`d${b.id}`} className="pointer-events-none">
                <circle cx={cx} cy={cy + 0.04} r={0.46} fill="rgba(0,0,0,0.18)" />
                <circle cx={cx} cy={cy} r={0.45} fill="#FFFFFF" />
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F6B22B" strokeWidth={0.1} strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
                <circle cx={cx} cy={cy} r={0.31} fill="#CF2E22" />
                <text x={cx} y={cy + 0.1} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={0.26} fill="#FFFFFF">{shown}</text>
              </g>
            )
          })}

          {names &&
            scn.buildings.map((b) => (
              <text key={`n${b.id}`} x={b.x} y={b.y + 0.82} textAnchor="middle" fontSize={0.24} fontWeight={700} fill="#1A1F2E" stroke="#FFFFFF" strokeWidth={0.08} paintOrder="stroke" className="pointer-events-none">
                {b.name}
              </text>
            ))}

          {scn.sites.filter((s) => bestSet.has(s.id)).map((s) => (
            <g key={`g${s.id}`}>
              <TruckShape x={s.x} y={s.y} vertical={onV(s.x) && !onH(s.y)} ghost />
            </g>
          ))}
          {showTrucks &&
            scn.sites.filter((s) => openSet.has(s.id) && s.id !== hiddenTruck).map((s) => (
              <TruckShape key={`t${s.id}`} x={s.x} y={s.y} vertical={onV(s.x) && !onH(s.y)} />
            ))}

          {anchored.map((t) =>
            t.to ? (
              <g key={`arrow${t.n}`} className="pointer-events-none">
                <line x1={t.at!.x} y1={t.at!.y} x2={t.to.x} y2={t.to.y} stroke="#F6B22B" strokeWidth={0.12} strokeLinecap="round" />
                <circle cx={t.to.x} cy={t.to.y} r={0.2} fill="none" stroke="#F6B22B" strokeWidth={0.08} />
              </g>
            ) : null,
          )}
          {anchored.map((t) => (
            <g key={`tip${t.n}`} transform={`translate(${Math.min(MAP_W - 0.4, t.at!.x - 0.62)} ${Math.min(MAP_H - 0.4, t.at!.y + 0.62)})`} className="pointer-events-none">
              <circle r={0.33} fill="#F6C445" stroke="#1A1F2E" strokeWidth={0.06} />
              <text y={0.11} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={0.3} fill="#1A1F2E">{t.n}</text>
            </g>
          ))}

          {interactive &&
            scn.sites.map((s) => {
              const has = openSet.has(s.id)
              return (
                <circle
                  key={`h${s.id}`}
                  cx={s.x}
                  cy={s.y}
                  r={0.45}
                  className="site-hit cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Parking bay ${s.id}${has ? ', truck parked. Press Enter to remove it' : '. Press Enter to park a truck'}`}
                  onPointerDown={(e) => {
                    if (has) onTruckPointerDown?.(s.id, e)
                  }}
                  onClick={() => {
                    if (!has) onSiteActivate?.(s.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSiteActivate?.(s.id)
                    }
                  }}
                />
              )
            })}

          {ghost && <TruckShape x={ghost.x} y={ghost.y} vertical={false} lifted />}
          {catchment && (
            <g className="pointer-events-none" transform={`translate(${catchment.x} ${Math.max(0.45, catchment.y - reach)})`}>
              <rect x={-2.1} y={-0.24} width={4.2} height={0.48} rx={0.24} fill="#2E8B57" />
              <text y={0.08} textAnchor="middle" fontSize={0.24} fontWeight={700} fill="#FFFFFF">
                Customers walk up to {(reach / 3).toFixed(1)} blocks
              </text>
            </g>
          )}
        </g>
      </svg>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
    </div>
  )
})
