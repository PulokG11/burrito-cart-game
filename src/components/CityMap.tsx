import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Tip } from '../engine/tips'
import type { Demand, Scenario, Score } from '../engine/types'

export const MAP_W = 20
export const MAP_H = 14
const STREETS_X = [1, 4, 7, 10, 13, 16, 19]
const STREETS_Y = [1, 4, 7, 10, 13]

export interface MapHandle {
  toMap(clientX: number, clientY: number): { x: number; y: number } | null
}

interface Props {
  scn: Scenario
  open: string[]
  demand: Demand
  result: Score
  forecast?: Demand
  showRanges?: boolean
  interactive?: boolean
  dragging?: boolean
  ghost?: { x: number; y: number } | null
  hiddenTruck?: string | null
  tips?: Tip[]
  showLinks?: boolean
  animate?: boolean
  hovered?: string | null
  onSiteActivate?: (id: string) => void
  onTruckPointerDown?: (id: string, e: ReactPointerEvent) => void
  onHover?: (buildingId: string | null) => void
  label: string
}

function Truck({ x, y, ghost = false }: { x: number; y: number; ghost?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.75 : 1} className="pointer-events-none">
      <ellipse cx={0} cy={0.27} rx={0.48} ry={0.09} fill="var(--shadow)" />
      <rect x={-0.46} y={-0.32} width={0.66} height={0.5} rx={0.07} fill="var(--truck)" />
      <rect x={-0.46} y={-0.32} width={0.66} height={0.1} rx={0.04} fill="var(--truck-stripe)" />
      <rect x={0.17} y={-0.2} width={0.3} height={0.38} rx={0.07} fill="var(--truck-cab)" />
      <rect x={0.25} y={-0.15} width={0.16} height={0.12} rx={0.03} fill="var(--truck-window)" />
      <circle cx={-0.27} cy={0.19} r={0.1} fill="var(--wheel)" />
      <circle cx={0.27} cy={0.19} r={0.1} fill="var(--wheel)" />
      <ellipse cx={-0.13} cy={-0.06} rx={0.17} ry={0.08} fill="var(--tortilla)" transform="rotate(-20 -0.13 -0.06)" />
    </g>
  )
}

export const CityMap = forwardRef<MapHandle, Props>(function CityMap(props, ref) {
  const {
    scn, open, demand, result, forecast, showRanges, interactive, dragging, ghost, hiddenTruck,
    tips, showLinks, animate, hovered, onSiteActivate, onTruckPointerDown, onHover, label,
  } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const siteById = useMemo(() => new Map(scn.sites.map((s) => [s.id, s])), [scn])
  const openSet = useMemo(() => new Set(open), [open])

  useImperativeHandle(ref, () => ({
    toMap(clientX, clientY) {
      const svg = svgRef.current
      const m = svg?.getScreenCTM()
      if (!svg || !m) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
      return { x: p.x, y: p.y }
    },
  }))

  const blocks = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; park: boolean }[] = []
    for (let j = 0; j < STREETS_Y.length - 1; j++) {
      for (let i = 0; i < STREETS_X.length - 1; i++) {
        const x0 = STREETS_X[i], x1 = STREETS_X[i + 1], y0 = STREETS_Y[j], y1 = STREETS_Y[j + 1]
        const occupied = scn.buildings.some((b) => b.x > x0 && b.x < x1 && b.y > y0 && b.y < y1)
        out.push({ x: x0 + 0.32, y: y0 + 0.32, w: x1 - x0 - 0.64, h: y1 - y0 - 0.64, park: !occupied })
      }
    }
    return out
  }, [scn])

  // Customers walking to their truck.
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
      const n = Math.max(1, Math.min(7, Math.round(won / 9)))
      for (let k = 0; k < n; k++) {
        walkers.push({ bx: b.x, by: b.y, sx: s.x, sy: s.y, phase: (k + Math.random()) / n, speed: 0.12 + Math.random() * 0.06 })
      }
    }
    const color = getComputedStyle(canvas).getPropertyValue('--walker').trim() || '#c8442f'
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
      ctx.fillStyle = color
      for (const p of walkers) {
        const u = (t / 1000) * p.speed + p.phase
        const f = u - Math.floor(u)
        const ease = f < 0.85 ? f / 0.85 : 1
        ctx.globalAlpha = f < 0.85 ? 0.85 : 0.85 * (1 - (f - 0.85) / 0.15)
        ctx.beginPath()
        ctx.arc((p.bx + (p.sx - p.bx) * ease) * k, (p.by + (p.sy - p.by) * ease) * k, Math.max(1.6, k * 0.07), 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [animate, scn, result, siteById, hiddenTruck])

  const anchored = (tips ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter((t) => t.at)

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="absolute inset-0 h-full w-full rounded-xl"
        role="group"
        aria-label={label}
        style={{ touchAction: interactive ? 'none' : 'auto' }}
      >
        <rect width={MAP_W} height={MAP_H} rx={0.4} fill="var(--map-ground)" />
        {STREETS_X.map((x) => <line key={`vx${x}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="var(--street)" strokeWidth={0.62} />)}
        {STREETS_Y.map((y) => <line key={`hy${y}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="var(--street)" strokeWidth={0.62} />)}
        {STREETS_X.map((x) => <line key={`cx${x}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke="var(--street-mark)" strokeWidth={0.04} strokeDasharray="0.25 0.3" />)}
        {STREETS_Y.map((y) => <line key={`cy${y}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke="var(--street-mark)" strokeWidth={0.04} strokeDasharray="0.25 0.3" />)}
        {blocks.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.22} fill={b.park ? 'var(--park)' : 'var(--block)'} />
            {b.park && (
              <g fill="var(--tree)" opacity={0.8}>
                <circle cx={b.x + b.w * 0.3} cy={b.y + b.h * 0.35} r={0.28} />
                <circle cx={b.x + b.w * 0.68} cy={b.y + b.h * 0.6} r={0.34} />
                <circle cx={b.x + b.w * 0.4} cy={b.y + b.h * 0.75} r={0.22} />
              </g>
            )}
          </g>
        ))}

        {showLinks &&
          scn.buildings.map((b) => {
            const s = result.assign[b.id] ? siteById.get(result.assign[b.id]!) : null
            return s ? (
              <line key={`l${b.id}`} x1={b.x} y1={b.y} x2={s.x} y2={s.y} stroke="var(--link)" strokeWidth={0.05} strokeDasharray="0.12 0.1" />
            ) : null
          })}

        {scn.sites.map((s) => {
          const has = openSet.has(s.id)
          if (has && s.id !== hiddenTruck) return null
          return (
            <circle
              key={`d${s.id}`}
              cx={s.x}
              cy={s.y}
              r={dragging ? 0.2 : 0.12}
              fill={dragging ? 'var(--accent)' : 'var(--site)'}
              opacity={dragging ? 0.9 : interactive ? 0.75 : 0.35}
              className={dragging ? 'spot-pulse' : undefined}
            />
          )
        })}

        {scn.buildings.map((b) => {
          const shown = demand[b.id] ?? 0
          const frac = shown > 0 ? Math.min(1, (result.won[b.id] ?? 0) / shown) : 0
          const R = 0.44
          const C = 2 * Math.PI * R
          const isHover = hovered === b.id
          return (
            <g
              key={b.id}
              onPointerEnter={() => onHover?.(b.id)}
              onPointerLeave={() => onHover?.(null)}
              className={onHover ? 'cursor-help' : undefined}
            >
              <title>
                {`${b.name}: ${Math.round(result.won[b.id] ?? 0)} of ${shown} customers${forecast ? ` (forecast ${forecast[b.id]})` : ''}`}
              </title>
              <rect x={b.x - 0.5} y={b.y - 0.5} width={1} height={1} rx={0.14} fill="var(--bldg)" stroke={isHover ? 'var(--accent)' : 'var(--bldg-edge)'} strokeWidth={isHover ? 0.08 : 0.04} />
              <circle cx={b.x} cy={b.y} r={R} fill="none" stroke="var(--ring-track)" strokeWidth={0.12} />
              <circle
                cx={b.x}
                cy={b.y}
                r={R}
                fill="none"
                stroke="var(--ring)"
                strokeWidth={0.12}
                strokeDasharray={`${C * frac} ${C}`}
                transform={`rotate(-90 ${b.x} ${b.y})`}
              />
              <circle cx={b.x} cy={b.y} r={0.34} fill="var(--marker)" />
              <text x={b.x} y={b.y + 0.12} textAnchor="middle" fontSize={0.34} fontWeight={700} fill="var(--ink)">
                {shown}
              </text>
              {showRanges && b.min != null && b.max != null && (
                <text x={b.x} y={b.y + 0.78} textAnchor="middle" fontSize={0.24} fill="var(--muted)" fontWeight={600}>
                  {b.min}–{b.max}
                </text>
              )}
              {forecast && (
                <text x={b.x} y={b.y + 0.78} textAnchor="middle" fontSize={0.22} fill="var(--muted)">
                  fcst {forecast[b.id]}
                </text>
              )}
            </g>
          )
        })}

        {scn.sites.filter((s) => openSet.has(s.id) && s.id !== hiddenTruck).map((s) => <Truck key={`t${s.id}`} x={s.x} y={s.y} />)}

        {interactive &&
          scn.sites.map((s) => {
            const has = openSet.has(s.id)
            return (
              <circle
                key={`h${s.id}`}
                cx={s.x}
                cy={s.y}
                r={0.42}
                className="site-hit cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Truck spot ${s.id}${has ? ', truck placed. Press Enter to remove' : '. Press Enter to place a truck'}`}
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

        {anchored.map((t) => (
          <g
            key={`tip${t.n}`}
            transform={`translate(${Math.min(MAP_W - 0.35, t.at!.x + 0.5)} ${Math.max(0.35, t.at!.y - 0.55)})`}
            className="pointer-events-none"
          >
            <circle r={0.3} fill="var(--bulb)" stroke="var(--bulb-edge)" strokeWidth={0.05} />
            <text y={0.11} textAnchor="middle" fontSize={0.32} fontWeight={800} fill="#3b2a00">
              {t.n}
            </text>
          </g>
        ))}

        {ghost && <Truck x={ghost.x} y={ghost.y} ghost />}
      </svg>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
    </div>
  )
})
