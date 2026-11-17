import type { Tip } from '../engine/tips'
import type { Demand } from '../engine/types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')

export const apiEnabled = Boolean(BASE)

export interface RemoteSession {
  sessionId: string
  token: string
  seed: string
  displayName: string
  matchCode: string | null
}

export interface SubmitResponse {
  verified: boolean
  recorded: boolean
  completed: boolean
  actual: Demand
  player: { profit: number }
  optimal: { sites?: string[]; profit: number; revenue: number; ingredient: number; truckCost?: number }
  greedySites?: string[]
  tips: Tip[]
  gapPct: number
}

export interface LeaderboardEntry {
  name: string
  totalProfit: number
  totalOptimal: number
  efficiency: number
  at: string
}

export interface Championship {
  code: string
  expiresAt: string
}

type Result<T> = { data: T; error: null } | { data: null; error: string }

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Result<T>> {
  if (!BASE) return { data: null, error: 'The game is offline, so championships are unavailable.' }
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { data: null, error: (body && typeof body.error === 'string' && body.error) || `Request failed (${res.status})` }
    return { data: body as T, error: null }
  } catch {
    return { data: null, error: 'Could not reach the game server. Check your connection and try again.' }
  }
}

const call = <T>(path: string, init?: RequestInit) => request<T>(path, init).then((r) => r.data)

export const createSession = (displayName: string, matchCode?: string) =>
  request<RemoteSession>('/v1/sessions', { method: 'POST', body: JSON.stringify(matchCode ? { displayName, matchCode } : { displayName }) })

export const submitDay = (s: RemoteSession, scenarioId: string, openSites: string[]) =>
  call<SubmitResponse>(`/v1/sessions/${s.sessionId}/days/${scenarioId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.token}` },
    body: JSON.stringify({ openSites }),
  })

export const fetchLeaderboard = (limit = 10, matchCode?: string | null) =>
  call<{ entries: LeaderboardEntry[] }>(
    matchCode ? `/v1/championships/${encodeURIComponent(matchCode)}/leaderboard?limit=${limit}` : `/v1/leaderboard?limit=${limit}`,
  ).then((r) => r?.entries ?? null)

export const createChampionship = (code: string, organizerName: string, hours: number) =>
  request<Championship>('/v1/championships', { method: 'POST', body: JSON.stringify({ code, organizerName, hours }) })
