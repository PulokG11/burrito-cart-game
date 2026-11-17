import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Scenario } from '../engine/types'
import { MAP_H, MAP_W } from './CityMap'

const LEVELS = [1, 1.5, 2, 3]
const MIN_PX = 680 // narrower than this, the map overflows and pans

interface View {
  x: number
  y: number
  w: number
  h: number
}

// Scrollable, zoomable frame around a CityMap with +/− buttons and a minimap of the viewport.
export function ZoomableMap({ scn, trucks, children }: { scn: Scenario; trucks: string[]; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState(0)
  const [view, setView] = useState<View>({ x: 0, y: 0, w: 1, h: 1 })
  const zoom = LEVELS[level]

  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    setView({
      x: el.scrollLeft / el.scrollWidth,
      y: el.scrollTop / el.scrollHeight,
      w: el.clientWidth / el.scrollWidth,
      h: el.clientHeight / el.scrollHeight,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, zoom])

  const setZoom = (next: number) => {
    const el = box.current
    if (!el || next === level) return
    // Keep the centre of the view in place while zooming.
    const cx = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth
    const cy = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight
    setLevel(next)
    requestAnimationFrame(() => {
      el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2
      el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2
      measure()
    })
  }

  const jump = (fx: number, fy: number) => {
    const el = box.current
    if (!el) return
    el.scrollTo({ left: fx * el.scrollWidth - el.clientWidth / 2, top: fy * el.scrollHeight - el.clientHeight / 2, behavior: 'smooth' })
  }

  const panned = view.w < 0.999 || view.h < 0.999
  const siteXY = new Map(scn.sites.map((s) => [s.id, s]))

  return (
    <div className="relative">
      <div
        ref={box}
        onScroll={measure}
        className="w-full overflow-auto rounded-2xl"
        style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, overscrollBehavior: 'contain' }}
      >
        <div style={{ width: `${zoom * 100}%`, minWidth: `${zoom * MIN_PX}px` }}>{children}</div>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={level === LEVELS.length - 1}
          onClick={() => setZoom(level + 1)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#1C3A8A] shadow-[0_2px_0_rgba(0,0,0,0.3)] disabled:opacity-40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          disabled={level === 0}
          onClick={() => setZoom(level - 1)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#1C3A8A] shadow-[0_2px_0_rgba(0,0,0,0.3)] disabled:opacity-40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      {panned && (
        <button
          type="button"
          aria-label="Minimap: click to move the view there"
          className="absolute right-3 top-3 rounded-xl bg-white p-1 shadow-[0_2px_0_rgba(0,0,0,0.3)]"
          onClick={(e) => {
            const r = (e.currentTarget.firstElementChild as SVGSVGElement).getBoundingClientRect()
            jump((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
          }}
        >
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-[72px] w-[103px] rounded-lg" aria-hidden>
            <rect width={MAP_W} height={MAP_H} fill="var(--sidewalk)" />
            {scn.buildings.map((b) => (
              <circle key={b.id} cx={b.x} cy={b.y} r={0.45} fill="#CF2E22" />
            ))}
            {trucks.map((id) => {
              const s = siteXY.get(id)
              return s ? <rect key={id} x={s.x - 0.5} y={s.y - 0.35} width={1} height={0.7} rx={0.15} fill="#1C3A8A" /> : null
            })}
            <rect
              x={view.x * MAP_W}
              y={view.y * MAP_H}
              width={view.w * MAP_W}
              height={view.h * MAP_H}
              fill="rgba(28,58,138,0.12)"
              stroke="#1C3A8A"
              strokeWidth={0.35}
              rx={0.3}
            />
          </svg>
        </button>
      )}
    </div>
  )
}
