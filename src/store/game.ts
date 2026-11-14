import { create } from 'zustand'
import type { Scenario, DayResult } from '../engine/types'

type Phase = 'idle' | 'placing' | 'solving' | 'results'

interface GameState {
  phase: Phase
  scenario: Scenario | null
  openSiteIds: string[]
  dayResults: DayResult[]

  loadScenario: (s: Scenario) => void
  toggleSite: (siteId: string) => void
  setPhase: (p: Phase) => void
  addDayResult: (r: DayResult) => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'idle',
  scenario: null,
  openSiteIds: [],
  dayResults: [],

  loadScenario: (scenario) => set({ scenario, openSiteIds: [], phase: 'placing', dayResults: [] }),
  toggleSite: (siteId) =>
    set((s) => ({
      openSiteIds: s.openSiteIds.includes(siteId)
        ? s.openSiteIds.filter((id) => id !== siteId)
        : [...s.openSiteIds, siteId],
    })),
  setPhase: (phase) => set({ phase }),
  addDayResult: (r) => set((s) => ({ dayResults: [...s.dayResults, r] })),
  reset: () => set({ phase: 'idle', scenario: null, openSiteIds: [], dayResults: [] }),
}))
