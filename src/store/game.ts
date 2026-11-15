import { create } from 'zustand'
import { drawActuals, randomSeed } from '../engine/demand'
import { expectedDemand, gapPct, score } from '../engine/score'
import { buildTips, type Tip } from '../engine/tips'
import type { Demand, Score } from '../engine/types'
import { apiEnabled, createSession, submitDay, type RemoteSession } from '../lib/api'
import { SCENARIOS } from '../scenarios'
import { solveLive } from '../solver'

export type Screen = 'home' | 'play' | 'results' | 'final'
export type Verification = 'pending' | 'verified' | 'offline' | 'mismatch'

export interface DayRecord {
  scenarioId: string
  open: string[]
  actual: Demand
  player: Score
  optimal: Score
  optimalSites: string[]
  gapPct: number
  solveMs: number | null
  tips: Tip[]
  verification: Verification
}

interface GameState {
  screen: Screen
  displayName: string
  seed: string
  remote: RemoteSession | null
  connecting: boolean
  dayIndex: number
  open: string[]
  records: DayRecord[]
  solving: boolean
  newsOpen: boolean

  start: (displayName: string) => Promise<void>
  toggleSite: (id: string) => void
  placeAt: (id: string) => void
  moveTruck: (from: string, to: string) => void
  removeTruck: (id: string) => void
  clearTrucks: () => void
  finishDay: () => Promise<void>
  nextDay: () => void
  setNewsOpen: (open: boolean) => void
  restart: () => void
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'home',
  displayName: '',
  seed: '',
  remote: null,
  connecting: false,
  dayIndex: 0,
  open: [],
  records: [],
  solving: false,
  newsOpen: false,

  start: async (displayName) => {
    set({ connecting: true })
    const remote = apiEnabled ? await createSession(displayName) : null
    set({
      screen: 'play',
      displayName: remote?.displayName ?? (displayName.trim() || 'Anonymous chef'),
      remote,
      seed: remote?.seed ?? randomSeed(),
      connecting: false,
      dayIndex: 0,
      open: [],
      records: [],
      newsOpen: true,
    })
  },

  toggleSite: (id) =>
    set((s) => ({ open: s.open.includes(id) ? s.open.filter((x) => x !== id) : [...s.open, id] })),

  placeAt: (id) => set((s) => (s.open.includes(id) ? s : { open: [...s.open, id] })),

  moveTruck: (from, to) =>
    set((s) => (s.open.includes(to) ? s : { open: s.open.map((x) => (x === from ? to : x)) })),

  removeTruck: (id) => set((s) => ({ open: s.open.filter((x) => x !== id) })),

  clearTrucks: () => set({ open: [] }),

  finishDay: async () => {
    const { dayIndex, open, seed, remote, solving } = get()
    if (solving) return
    set({ solving: true })
    const scn = SCENARIOS[dayIndex]
    const actual = drawActuals(scn, seed)
    const optimalSites = scn.optimal.sites
    const live = await solveLive(scn)
    const player = score(scn, open, actual)
    const optimal = score(scn, optimalSites, actual)
    const record: DayRecord = {
      scenarioId: scn.id,
      open: [...open].sort(),
      actual,
      player,
      optimal,
      optimalSites,
      gapPct: gapPct(player.profit, optimal.profit),
      solveMs: live && live.status === 'Optimal' ? live.ms : null,
      tips: buildTips(scn, open, optimalSites, actual, expectedDemand(scn), scn.greedy.sites),
      verification: remote ? 'pending' : 'offline',
    }
    set((s) => ({ records: [...s.records, record], screen: 'results', solving: false }))

    if (remote) {
      const res = await submitDay(remote, scn.id, record.open)
      const verification: Verification = !res
        ? 'offline'
        : Math.abs(res.player.profit - player.profit) < 0.01 && Math.abs(res.optimal.profit - optimal.profit) < 0.01
          ? 'verified'
          : 'mismatch'
      set((s) => ({
        records: s.records.map((r) => (r.scenarioId === scn.id ? { ...r, verification } : r)),
      }))
    }
  },

  nextDay: () => {
    const next = get().dayIndex + 1
    if (next >= SCENARIOS.length) set({ screen: 'final' })
    else set({ dayIndex: next, open: [], screen: 'play', newsOpen: true })
  },

  setNewsOpen: (newsOpen) => set({ newsOpen }),

  restart: () => set({ screen: 'home', remote: null, dayIndex: 0, open: [], records: [], seed: '' }),
}))
