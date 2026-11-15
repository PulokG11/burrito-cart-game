import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { distance } from '../engine/walk'
import { forecastDemand, score } from '../engine/score'
import { dayCsv, download } from '../lib/csv'
import { blocks, cost, money } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { warmUpSolver } from '../solver'
import { useGame } from '../store/game'
import { CityMap, MAP_H, MAP_W, type MapHandle } from './CityMap'
import { NewsDialog } from './NewsDialog'

interface Drag {
  from: string | null
  x: number
  y: number
  sx: number
  sy: number
  moved: boolean
}

export function PlayScreen() {
  const { dayIndex, open, records, solving, toggleSite, placeAt, moveTruck, removeTruck, clearTrucks, finishDay } = useGame()
  const scn = SCENARIOS[dayIndex]
  const mapRef = useRef<MapHandle>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag
  // The browser fires a click after pointerup; ignore it so a removed truck is not placed again.
  const lastDragEnd = useRef(0)

  useEffect(warmUpSolver, [])

  const planned = useMemo(() => forecastDemand(scn), [scn])
  const live = useMemo(() => score(scn, open, planned), [scn, open, planned])
  const banked = records.reduce((s, r) => s + r.player.profit, 0)

  const nearestSite = (p: { x: number; y: number }) => {
    let best: { id: string; d: number } | null = null
    for (const s of scn.sites) {
      const d = distance(p, s)
      if (d < 0.9 && (!best || d < best.d)) best = { id: s.id, d }
    }
    return best?.id ?? null
  }

  const beginDrag = (from: string | null, e: ReactPointerEvent) => {
    e.preventDefault()
    const p = mapRef.current?.toMap(e.clientX, e.clientY) ?? { x: -10, y: -10 }
    setDrag({ from, x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, moved: false })
  }

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const p = mapRef.current?.toMap(e.clientX, e.clientY)
      if (!p) return
      setDrag({ ...d, x: p.x, y: p.y, moved: d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5 })
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      setDrag(null)
      lastDragEnd.current = performance.now()
      if (!d) return
      if (!d.moved) {
        if (d.from) removeTruck(d.from)
        return
      }
      const p = mapRef.current?.toMap(e.clientX, e.clientY)
      const trash = trashRef.current?.getBoundingClientRect()
      const overTrash = trash && e.clientX >= trash.left && e.clientX <= trash.right && e.clientY >= trash.top && e.clientY <= trash.bottom
      const target = p && !overTrash ? nearestSite(p) : null
      if (target) {
        if (d.from) moveTruck(d.from, target)
        else placeAt(target)
      } else if (d.from && (overTrash || !p || p.x < 0 || p.y < 0 || p.x > MAP_W || p.y > MAP_H)) {
        removeTruck(d.from)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  const hb = hovered ? scn.buildings.find((b) => b.id === hovered) : null
  const hbSite = hb && live.assign[hb.id] ? scn.sites.find((s) => s.id === live.assign[hb.id]) : null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 lg:flex-row lg:p-4">
      <NewsDialog />
      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="rounded-2xl border border-line bg-surface p-2 shadow-sm">
          <CityMap
            ref={mapRef}
            scn={scn}
            open={open}
            demand={planned}
            result={live}
            showRanges={scn.uncertain}
            interactive
            dragging={drag?.moved ?? false}
            ghost={drag?.moved ? { x: drag.x, y: drag.y } : null}
            hiddenTruck={drag?.moved ? drag.from : null}
            animate={!drag}
            hovered={hovered}
            onHover={setHovered}
            onSiteActivate={(id) => {
              if (performance.now() - lastDragEnd.current > 300) toggleSite(id)
            }}
            onTruckPointerDown={(id, e) => beginDrag(id, e)}
            label={`Map of Salsa Springs with ${scn.buildings.length} buildings and ${scn.sites.length} truck spots`}
          />
        </div>

        <div className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm">
          <div
            className="flex cursor-grab touch-none items-center gap-2 rounded-xl bg-chip px-3 py-2 active:cursor-grabbing"
            onPointerDown={(e) => beginDrag(null, e)}
            title="Drag a truck onto a highlighted spot"
          >
            <svg viewBox="-0.6 -0.45 1.2 0.8" className="h-7 w-10" aria-hidden>
              <rect x={-0.46} y={-0.32} width={0.66} height={0.5} rx={0.07} fill="var(--truck)" />
              <rect x={0.17} y={-0.2} width={0.3} height={0.38} rx={0.07} fill="var(--truck-cab)" />
              <circle cx={-0.27} cy={0.19} r={0.1} fill="var(--wheel)" />
              <circle cx={0.27} cy={0.19} r={0.1} fill="var(--wheel)" />
            </svg>
            <span className="text-sm font-semibold leading-tight">
              Drag a truck
              <span className="block text-xs font-normal text-muted">or click a spot</span>
            </span>
          </div>
          <div
            ref={trashRef}
            className={`flex items-center gap-1.5 rounded-xl border-2 border-dashed px-3 text-sm ${drag?.from && drag.moved ? 'border-accent text-accent' : 'border-line text-muted'}`}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
            Remove
          </div>

          <dl className="flex flex-1 flex-wrap items-center justify-around gap-x-4 gap-y-1 px-2 text-center">
            <Stat label={scn.uncertain ? 'Sales (forecast)' : 'Sales'} value={money(live.revenue)} />
            <Stat label="Ingredients" value={cost(live.ingredient)} />
            <Stat label={`${open.length} truck${open.length === 1 ? '' : 's'}`} value={cost(live.truckCost)} />
            <Stat label={scn.uncertain ? 'Expected profit' : "Today's profit"} value={money(live.profit)} strong tone={live.profit >= 0 ? 'good' : 'bad'} />
          </dl>

          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={clearTrucks} disabled={!open.length || solving}>
              Clear
            </button>
            <button className="btn-primary min-w-28" onClick={finishDay} disabled={solving}>
              {solving ? 'Solving…' : 'Done'}
            </button>
          </div>
        </div>
      </main>

      <aside className="flex w-full flex-col gap-3 lg:w-72">
        <section className="panel">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total profit</p>
          <p className={`font-display text-3xl font-bold ${banked + live.profit >= 0 ? 'text-good' : 'text-bad'}`}>{money(banked + live.profit)}</p>
          <p className="text-xs text-muted">Finished days plus today's plan</p>
          <ol className="mt-3 grid grid-cols-5 gap-1.5" aria-label="Progress">
            {SCENARIOS.map((s, i) => (
              <li
                key={s.id}
                title={`Round ${s.round} Day ${s.day}: ${s.title}`}
                className={`h-2 rounded-full ${i < dayIndex ? 'bg-good' : i === dayIndex ? 'bg-accent' : 'bg-chip'}`}
              />
            ))}
          </ol>
        </section>

        <section className="panel min-h-32" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Building</p>
          {hb ? (
            <>
              <p className="mt-1 font-semibold leading-snug">{hb.name}</p>
              <p className="mt-1 text-sm text-muted">
                {scn.uncertain ? (
                  <>
                    Forecast <strong className="text-ink">{hb.demand}</strong>, actual will be {hb.min}–{hb.max}
                  </>
                ) : (
                  <>
                    Demand <strong className="text-ink">{hb.demand}</strong> customers
                  </>
                )}
              </p>
              <p className="text-sm text-muted">
                Winning <strong className="text-ink">{Math.round(live.won[hb.id])}</strong>
                {hbSite ? ` from the truck ${blocks(distance(hb, hbSite))} away` : ', no truck within walking distance'}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Point at a building to see its customers. The orange ring shows the share you are winning.</p>
          )}
        </section>

        <section className="panel text-sm text-muted">
          <p className="text-xs font-semibold uppercase tracking-wider">How customers decide</p>
          <p className="mt-1">
            Everyone in a building walks to the nearest truck. Right next door they all come; farther away fewer make the trip, and beyond {blocks(scn.walk.maxDistance)} nobody does.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider">Today's data</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Object.entries(dayCsv(scn)).map(([name, text]) => (
              <button key={name} className="rounded-md bg-chip px-2 py-1 text-xs font-medium text-ink hover:bg-line" onClick={() => download(`${scn.id}-${name}`, text)}>
                {name.replace('.csv', '')}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'text-xl font-bold' : 'font-semibold'} ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</dd>
    </div>
  )
}
