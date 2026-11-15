import type { Demand } from '../engine/types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')

export const apiEnabled = Boolean(BASE)

export interface RemoteSession {
  sessionId: string
  token: string
  seed: string
  displayName: string
}

export interface SubmitResponse {
  verified: boolean
  recorded: boolean
  completed: boolean
  actual: Demand
  player: { profit: number }
  optimal: { sites: string[]; profit: number }
  gapPct: number
}

export interface LeaderboardEntry {
  name: string
  totalProfit: number
  totalOptimal: number
  efficiency: number
  at: string
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T | null> {
  if (!BASE) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const createSession = (displayName: string) =>
  call<RemoteSession>('/v1/sessions', { method: 'POST', body: JSON.stringify({ displayName }) })

export const submitDay = (s: RemoteSession, scenarioId: string, openSites: string[]) =>
  call<SubmitResponse>(`/v1/sessions/${s.sessionId}/days/${scenarioId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.token}` },
    body: JSON.stringify({ openSites }),
  })

export const fetchLeaderboard = (limit = 10) =>
  call<{ entries: LeaderboardEntry[] }>(`/v1/leaderboard?limit=${limit}`).then((r) => r?.entries ?? null)
