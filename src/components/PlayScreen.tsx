import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { forecastDemand, score } from '../engine/score'
import { distance } from '../engine/walk'
import { glyphFor } from '../lib/glyphs'
import { blocks, money } from '../lib/format'
import { SCENARIOS } from '../scenarios'
import { warmUpSolver } from '../solver'
import { useGame } from '../store/game'
import { CityMap, MAP_H, MAP_W, type MapHandle } from './CityMap'
import { NewsDialog } from './NewsDialog'
import { Progress, Rail, RailDivider, WalkCurve } from './Rail'

interface Drag {
  from: string | null
  x: number
  y: number
  sx: number
  sy: number
  moved: boolean
}

export function TruckIcon({ className = 'h-7 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 46 28" className={className} aria-hidden>
      <rect x={1} y={2} width={33} height={22} rx={4} fill="#1C3A8A" />
      <rect x={1} y={2} width={33} height={6} rx={3} fill="#F6B22B" />
      <rect x={33} y={5} width={11} height={16} rx={3.5} fill="#2D55B8" />
      <ellipse cx={17} cy={15} rx={8} ry={4.2} fill="#F3D9A4" stroke="#B8892E" strokeWidth={1.5} />
    </svg>
  )
}

export function NamesSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className="inline-flex min-h-[44px] items-center gap-2.5 rounded-xl bg-white px-3.5 text-sm font-bold text-[#1C3A8A] shadow-[0_2px_0_rgba(0,0,0,0.25)]">
      <span className={`relative inline-block h-5 w-[34px] rounded-full transition ${on ? 'bg-[#1C3A8A]' : 'bg-[#C9CFC6]'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
      </span>
      Building names
    </button>
  )
}

export function Term({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`num leading-tight ${big ? 'text-3xl' : 'text-xl text-accent'} ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</span>
    </div>
  )
}

const Op = ({ c }: { c: string }) => (
  <span className="num text-2xl text-muted/70" aria-hidden>
    {c}
  </span>
)

export function PlayScreen() {
  const { dayIndex, open, records, solving, toggleSite, placeAt, moveTruck, removeTruck, clearTrucks, finishDay } = useGame()
  const scn = SCENARIOS[dayIndex]
  const mapRef = useRef<MapHandle>(null)
  const trashRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [names, setNames] = useState(false)
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

  const dropAt = drag?.moved ? nearestSite(drag) : null
  const dropSite = dropAt ? scn.sites.find((s) => s.id === dropAt)! : null
  const hb = hovered ? scn.buildings.find((b) => b.id === hovered) : null
  const hbSite = hb && live.assign[hb.id] ? scn.sites.find((s) => s.id === live.assign[hb.id]) : null
  const e = scn.economics
  const story = scn.news.replace(/ Each truck costs.*$/, '')
  const prices: [string, string, boolean][] = [
    ['Truck', money(e.truckCost), e.truckCost !== 250],
    ['Sells for', money(e.revenue), false],
    ['Ingredients', money(e.ingredient), e.ingredient !== 5],
  ]

  return (
    <div className="flex flex-1 flex-col">
      <NewsDialog />
      <div className="flex flex-1 flex-col lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-2 p-3 lg:p-5">
          <div className="mx-auto flex w-full items-center justify-between gap-3 lg:max-w-[calc((100vh-64px-104px-96px)*20/14)]">
            <p className="text-[15px] text-muted">
              <span className="sm:hidden">Swipe the map to see the whole city.</span>
              <span className="hidden sm:inline">Drag trucks onto the yellow bays. Customers walk to the nearest one.</span>
            </p>
            <NamesSwitch on={names} onChange={setNames} />
          </div>
          <div className="relative mx-auto w-full overflow-x-auto rounded-2xl lg:max-w-[calc((100vh-64px-104px-96px)*20/14)]">
            <div className="min-w-[680px]">
              <CityMap
                ref={mapRef}
                scn={scn}
                open={open}
                demand={planned}
                result={live}
                ranges={scn.uncertain}
                interactive
                dragging={drag?.moved ?? false}
                ghost={drag?.moved ? { x: drag.x, y: drag.y } : null}
                hiddenTruck={drag?.moved ? drag.from : null}
                catchment={drag?.moved ? (dropSite ?? { x: drag.x, y: drag.y }) : null}
                names={names}
                animate={!drag}
                hovered={hovered}
                onHover={setHovered}
                onSiteActivate={(id) => {
                  if (performance.now() - lastDragEnd.current > 300) toggleSite(id)
                }}
                onTruckPointerDown={(id, ev) => beginDrag(id, ev)}
                label={`Map of Salsa Springs with ${scn.buildings.length} buildings and ${scn.sites.length} parking bays`}
              />
            </div>
          </div>
        </main>

        <Rail>
          <section className="flex flex-col gap-2">
            <p className="text-[15px] text-[#C9D4F2]">
              Round {scn.round}, day {scn.day} of 5
            </p>
            <h1 className="font-display text-[28px] leading-tight">{scn.title}</h1>
            <p className="text-[15px] leading-relaxed text-[#E4EAFA]">{story}</p>
            <dl className="mt-1 grid grid-cols-3 gap-2">
              {prices.map(([k, v, changed]) => (
                <div key={k} className={`rounded-lg px-2.5 py-2 ${changed ? 'bg-[#F6B22B] text-[#1A1F2E]' : 'bg-white/10'}`}>
                  <dt className={`text-[13px] ${changed ? '' : 'text-[#C9D4F2]'}`}>{k}</dt>
                  <dd className="num text-xl">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <RailDivider />
          <section className="flex flex-col gap-1.5">
            <p className="text-[15px] text-[#C9D4F2]">Total profit</p>
            <p className="num text-[40px] leading-none">{money(banked + live.profit)}</p>
            <p className="text-[13px] text-[#C9D4F2]">Finished days plus today's plan</p>
            <div className="mt-2">
              <Progress current={dayIndex} done={records.length} />
            </div>
          </section>
          <RailDivider />
          <section className="flex flex-col gap-2.5" aria-live="polite">
            {hb ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#7CD3C8]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C3A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={glyphFor(hb.name)} />
                    </svg>
                  </span>
                  <span className="text-lg font-bold leading-tight">{hb.name}</span>
                </div>
                <p className="text-[15px] leading-snug text-[#E4EAFA]">
                  {scn.uncertain ? (
                    <>
                      Forecast {hb.demand}, actual will land between {hb.min} and {hb.max}.{' '}
                    </>
                  ) : (
                    <>{hb.demand} customers here. </>
                  )}
                  {hbSite ? (
                    <>
                      You are winning <strong className="text-white">{Math.round(live.won[hb.id])}</strong> with the truck {blocks(distance(hb, hbSite))} away.
                    </>
                  ) : (
                    'No truck is close enough yet.'
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold">How far people walk</p>
                <p className="text-[15px] leading-snug text-[#E4EAFA]">Point at a building to see how many of its customers your trucks are winning.</p>
              </>
            )}
            <WalkCurve walk={scn.walk} at={hb && hbSite ? distance(hb, hbSite) : null} />
          </section>
        </Rail>
      </div>

      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line bg-surface px-3 py-2.5 sm:py-3 lg:px-6">
        <p className="w-full text-[15px] sm:hidden">
          <span className={`num text-2xl ${live.profit >= 0 ? 'text-good' : 'text-bad'}`}>{money(live.profit)}</span>{' '}
          <span className="text-muted">
            = {money(live.revenue)} sales − {money(live.ingredient)} ingredients − {open.length} × {money(e.truckCost)} trucks
          </span>
        </p>
        <div className="flex flex-1 gap-2.5 sm:flex-none">
          <div
            role="button"
            tabIndex={-1}
            aria-label="Drag a truck onto a parking bay"
            className="flex h-[56px] flex-1 cursor-grab touch-none items-center gap-3 rounded-xl border-2 border-[#1C3A8A] bg-[#EEF2FC] px-3 text-[15px] font-bold text-[#1C3A8A] active:cursor-grabbing sm:h-[68px] sm:flex-none sm:px-4"
            onPointerDown={(ev) => beginDrag(null, ev)}
          >
            <TruckIcon />
            <span className="leading-tight">
              Drag a truck
              <span className="block text-[13px] font-normal text-[#3A4A78]">or tap a yellow bay</span>
            </span>
          </div>
          <div
            ref={trashRef}
            aria-hidden
            className={`hidden h-[68px] w-[92px] flex-col sm:flex items-center justify-center gap-0.5 rounded-xl border-2 border-dashed text-[13px] ${drag?.from && drag.moved ? 'border-bad text-bad' : 'border-muted/50 text-muted'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
            </svg>
            Drop to remove
          </div>
        </div>

        <div className="hidden flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:flex" aria-label="Today's profit equals sales minus ingredients minus trucks">
          <Term label={scn.uncertain ? 'Expected profit' : "Today's profit"} value={money(live.profit)} big tone={live.profit >= 0 ? 'good' : 'bad'} />
          <Op c="=" />
          <Term label={scn.uncertain ? 'Sales (forecast)' : 'Sales'} value={money(live.revenue)} />
          <Op c="−" />
          <Term label="Ingredients" value={money(live.ingredient)} />
          <Op c="−" />
          <Term label="Trucks" value={`${open.length} × ${money(e.truckCost)}`} />
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={clearTrucks} disabled={!open.length || solving}>
            Clear
          </button>
          <button type="button" className="btn-primary min-w-[120px] sm:min-w-[150px]" onClick={finishDay} disabled={solving}>
            {solving ? 'Solving…' : 'Done'}
            {!solving && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F6B22B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  )
}
