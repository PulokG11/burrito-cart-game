import { create } from 'zustand'
import { drawActuals, randomSeed } from '../engine/demand'
import { expectedDemand, gapPct, score } from '../engine/score'
import { greedy } from '../engine/greedy'
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
  submitError: string | null

  matchCode: string | null
  /** Resolves to an error message when joining a championship fails. */
  start: (displayName: string, matchCode?: string) => Promise<string | null>
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

  matchCode: null,
  submitError: null,

  start: async (displayName, matchCode) => {
    set({ connecting: true })
    const res = apiEnabled || matchCode ? await createSession(displayName, matchCode) : null
    // A championship needs the server for its shared seed; a normal game can fall back to offline.
    if (matchCode && !res?.data) {
      set({ connecting: false })
      return res?.error ?? 'Could not join that championship.'
    }
    const remote = res?.data ?? null
    set({
      screen: 'play',
      displayName: remote?.displayName ?? (displayName.trim() || 'Anonymous chef'),
      remote,
      matchCode: remote?.matchCode ?? null,
      seed: remote?.seed ?? randomSeed(),
      connecting: false,
      dayIndex: 0,
      open: [],
      records: [],
      newsOpen: true,
    })
    return null
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
    set({ submitError: null })
    const { matchCode } = get()
    const scn = SCENARIOS[dayIndex]
    const actual = drawActuals(scn, seed)
    const player = score(scn, open, actual)
    const sortedOpen = [...open].sort()
    const done = (rec: Omit<DayRecord, 'scenarioId' | 'open' | 'actual' | 'player' | 'gapPct'>) =>
      set((s) => ({
        records: [...s.records, { scenarioId: scn.id, open: sortedOpen, actual, player, gapPct: gapPct(player.profit, rec.optimal.profit), ...rec }],
        screen: 'results',
        solving: false,
      }))

    // The optimal plans are not shipped to the browser: the server scores the day and supplies them.
    if (remote) {
      const [res, live] = await Promise.all([submitDay(remote, scn.id, sortedOpen), matchCode ? null : solveLive(scn)])
      if (res) {
        const sites = res.optimal.sites ?? []
        const optimal: Score = res.optimal.sites
          ? score(scn, sites, actual)
          : { profit: res.optimal.profit, revenue: res.optimal.revenue, ingredient: res.optimal.ingredient, truckCost: 0, won: {}, assign: {} }
        return done({
          optimal,
          optimalSites: sites,
          solveMs: live && live.status === 'Optimal' ? live.ms : null,
          tips: res.tips,
          verification: Math.abs(res.player.profit - player.profit) < 0.01 ? 'verified' : 'mismatch',
        })
      }
      if (matchCode) {
        set({ solving: false, submitError: 'Could not reach the game server, so this championship day was not scored. Check your connection and press Done again.' })
        return
      }
    }

    // Offline: work out the best plan on this device.
    const live = await solveLive(scn)
    if (!live || live.status !== 'Optimal') {
      set({ solving: false, submitError: 'Could not work out the best plan on this device. Press Done to try again.' })
      return
    }
    const planned = expectedDemand(scn)
    done({
      optimal: score(scn, live.sites, actual),
      optimalSites: live.sites,
      solveMs: live.ms,
      tips: buildTips(scn, open, live.sites, actual, planned, greedy(scn, planned).sites),
      verification: 'offline',
    })
  },

  nextDay: () => {
    const next = get().dayIndex + 1
    if (next >= SCENARIOS.length) set({ screen: 'final' })
    else set({ dayIndex: next, open: [], screen: 'play', newsOpen: true })
  },

  setNewsOpen: (newsOpen) => set({ newsOpen }),

  restart: () => set({ screen: 'home', remote: null, matchCode: null, dayIndex: 0, open: [], records: [], seed: '' }),
}))
