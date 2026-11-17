// Neon Function "api": sessions, authoritative day scoring, leaderboard.
// Talks to Postgres over Neon's HTTP SQL endpoint so the bundle has no npm dependencies.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { drawActuals } from '../src/engine/demand.ts'
import { gapPct, score } from '../src/engine/score.ts'
import type { Scenario } from '../src/engine/types.ts'

const BUILD = process.env.BUILD_SHA ?? 'dev'
const DATASET = 'v1'
const ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'https://pulokg11.github.io,http://localhost:5175,http://127.0.0.1:5175').split(','),
)

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function sql<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const res = await fetch(`https://${new URL(url).hostname}/sql`, {
    method: 'POST',
    headers: { 'Neon-Connection-String': url, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, params }),
  })
  if (!res.ok) throw new Error(`sql ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { rows: { j: T | string }[] }
  return body.rows.map((r) => (typeof r.j === 'string' ? JSON.parse(r.j) : r.j))
}

const scenarios = new Map<string, Promise<Scenario & { optimalSites: string[]; siteIds: Set<string> }>>()

function loadScenario(id: string) {
  let p = scenarios.get(id)
  if (!p) {
    p = sql<any>(
      `SELECT json_build_object(
        'id', s.scenario_id, 'uncertain', s.is_uncertain, 'contentHash', s.content_hash,
        'economics', json_build_object('revenue', s.revenue_r, 'ingredient', s.ingredient_k, 'truckCost', s.truck_cost_f),
        'buildings', (SELECT json_agg(json_build_object('id', b.building_id, 'demand', b.demand, 'min', b.err_min, 'max', b.err_max) ORDER BY b.building_id)
                      FROM scenario_building b WHERE b.scenario_id = s.scenario_id),
        'sites', (SELECT json_agg(t.site_id ORDER BY t.site_id) FROM scenario_site t WHERE t.scenario_id = s.scenario_id),
        'reach', (SELECT json_agg(json_build_object('b', r.building_id, 's', r.site_id, 'a', r.alpha))
                  FROM scenario_reach r WHERE r.scenario_id = s.scenario_id),
        'optimal', o.open_sites) AS j
      FROM scenario s JOIN optimal_solution o USING (scenario_id) WHERE s.scenario_id = $1`,
      [id],
    ).then(([row]) => {
      if (!row) throw new HttpError(404, 'unknown scenario')
      return { ...row, sites: row.sites.map((s: string) => ({ id: s })), siteIds: new Set(row.sites), optimalSites: row.optimal }
    })
    p.catch(() => scenarios.delete(id))
    scenarios.set(id, p)
  }
  return p
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SCENARIO = /^v1-r[12]-d[1-5]$/
const round2 = (v: number) => Math.round(v * 100) / 100

async function readJson(req: Request): Promise<any> {
  const text = await req.text()
  if (text.length > 8192) throw new HttpError(413, 'body too large')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new HttpError(400, 'invalid JSON')
  }
}

async function createSession(req: Request) {
  const body = await readJson(req)
  const raw = typeof body.displayName === 'string' ? body.displayName : ''
  const name = cleanName(raw)
  const token = randomBytes(24).toString('hex')
  let seed = randomBytes(8).toString('hex')
  let matchId: string | null = null
  let matchCode: string | null = null

  if (body.matchCode !== undefined) {
    const code = typeof body.matchCode === 'string' ? body.matchCode.trim() : ''
    if (!CODE.test(code)) throw new HttpError(422, 'Match codes are 1 to 19 letters or digits')
    const [match] = await sql<{ matchId: string; seed: string; expired: boolean }>(
      `SELECT json_build_object('matchId', match_id, 'seed', seed, 'expired', expires_at < now()) AS j FROM championship WHERE code = $1`,
      [code],
    )
    if (!match) throw new HttpError(404, 'No championship uses that code. Codes are case-sensitive.')
    if (match.expired) throw new HttpError(410, 'That championship has ended')
    seed = match.seed
    matchId = match.matchId
    matchCode = code
  }

  const [row] = await sql<{ sessionId: string }>(
    `WITH p AS (INSERT INTO player (display_name) VALUES ($1) RETURNING player_id)
     INSERT INTO game_session (player_id, dataset_ver, seed, token_hash, match_id)
     SELECT player_id, $2, $3, $4, $5::uuid FROM p
     RETURNING json_build_object('sessionId', session_id) AS j`,
    [name, DATASET, seed, sha256(token), matchId],
  )
  return { sessionId: row.sessionId, token, seed, datasetVer: DATASET, displayName: name, matchCode }
}

const CODE = /^[A-Za-z0-9]{1,19}$/

function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Anonymous chef'
}

async function createChampionship(req: Request) {
  const body = await readJson(req)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!CODE.test(code)) throw new HttpError(422, 'Match codes are 1 to 19 letters or digits')
  const hours = Math.min(24 * 30, Math.max(1, Math.round(Number(body.hours) || 72)))
  const [taken] = await sql(`SELECT json_build_object('code', code) AS j FROM championship WHERE code = $1`, [code])
  if (taken) throw new HttpError(409, 'That code is taken. Try another.')
  const [row] = await sql<{ code: string; expiresAt: string }>(
    `WITH p AS (INSERT INTO player (display_name) VALUES ($1) RETURNING player_id)
     INSERT INTO championship (code, organizer_id, seed, dataset_ver, expires_at)
     SELECT $2, player_id, $3, $4, now() + make_interval(hours => $5::int) FROM p
     ON CONFLICT (code) DO NOTHING
     RETURNING json_build_object('code', code, 'expiresAt', expires_at) AS j`,
    [cleanName(typeof body.organizerName === 'string' ? body.organizerName : ''), code, randomBytes(8).toString('hex'), DATASET, hours],
  )
  if (!row) throw new HttpError(409, 'That code is taken. Try another.')
  return row
}

async function championshipInfo(code: string) {
  if (!CODE.test(code)) throw new HttpError(404, 'not found')
  const [row] = await sql(
    `SELECT json_build_object('code', c.code, 'expiresAt', c.expires_at, 'expired', c.expires_at < now(),
       'players', (SELECT count(*) FROM game_session g WHERE g.match_id = c.match_id),
       'finished', (SELECT count(*) FROM leaderboard_entry l WHERE l.match_id = c.match_id)) AS j
     FROM championship c WHERE c.code = $1`,
    [code],
  )
  if (!row) throw new HttpError(404, 'No championship uses that code')
  return row
}

async function championshipLeaderboard(code: string, url: URL) {
  if (!CODE.test(code)) throw new HttpError(404, 'not found')
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25))
  const entries = await sql(
    `SELECT json_build_object('name', l.display_name, 'totalProfit', l.total_profit, 'totalOptimal', l.total_optimal,
              'efficiency', l.efficiency, 'at', l.created_at) AS j
     FROM leaderboard_entry l JOIN championship c ON c.match_id = l.match_id
     WHERE c.code = $1 ORDER BY l.total_profit DESC, l.created_at LIMIT $2`,
    [code, limit],
  )
  return { entries }
}

async function submitDay(req: Request, sessionId: string, scenarioId: string) {
  if (!UUID.test(sessionId) || !SCENARIO.test(scenarioId)) throw new HttpError(404, 'not found')
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''

  const [session] = await sql<{ seed: string; tokenHash: string; status: string; matchId: string | null }>(
    `SELECT json_build_object('seed', seed, 'tokenHash', token_hash, 'status', status, 'matchId', match_id) AS j FROM game_session WHERE session_id = $1`,
    [sessionId],
  )
  const given = Buffer.from(sha256(token))
  if (!session || !token || !timingSafeEqual(given, Buffer.from(session.tokenHash))) throw new HttpError(401, 'unauthorized')

  const body = await readJson(req)
  const scn = await loadScenario(scenarioId)
  const open: unknown = body.openSites
  if (
    !Array.isArray(open) ||
    open.length > scn.siteIds.size ||
    new Set(open).size !== open.length ||
    !open.every((s) => typeof s === 'string' && scn.siteIds.has(s))
  ) {
    throw new HttpError(422, 'openSites must be distinct site ids from this scenario')
  }

  const actual = drawActuals(scn, session.seed)
  const player = score(scn, open as string[], actual)
  const optimal = score(scn, scn.optimalSites, actual)
  const gap = round2(gapPct(player.profit, optimal.profit))

  const [res] = await sql<{ recorded: boolean; completed: boolean; totalProfit: number | null; daysPlayed: number | null }>(
    `WITH ins AS (
       INSERT INTO day_result (session_id, scenario_id, open_sites, actual_demand, revenue, ingredient_cost, truck_cost, profit, optimal_profit, gap_pct)
       VALUES ($1, $2, $3::text[], $4::jsonb, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (session_id, scenario_id) DO NOTHING
       RETURNING profit, optimal_profit
     ), upd AS (
       UPDATE game_session g SET
         days_played = g.days_played + 1,
         total_profit = g.total_profit + ins.profit,
         total_optimal = g.total_optimal + ins.optimal_profit,
         status = CASE WHEN g.days_played + 1 >= (SELECT count(*) FROM scenario WHERE version = g.dataset_ver AND mode = 'normal') THEN 'completed' ELSE g.status END,
         completed_at = CASE WHEN g.days_played + 1 >= (SELECT count(*) FROM scenario WHERE version = g.dataset_ver AND mode = 'normal') THEN now() ELSE g.completed_at END
       FROM ins WHERE g.session_id = $1
       RETURNING g.session_id, g.player_id, g.match_id, g.status, g.total_profit, g.total_optimal, g.days_played
     ), lb AS (
       INSERT INTO leaderboard_entry (session_id, match_id, display_name, total_profit, total_optimal, efficiency)
       SELECT upd.session_id, upd.match_id, p.display_name, upd.total_profit, upd.total_optimal,
              CASE WHEN upd.total_optimal > 0 THEN round(100 * upd.total_profit / upd.total_optimal, 2) ELSE 0 END
       FROM upd JOIN player p USING (player_id) WHERE upd.status = 'completed'
       ON CONFLICT (session_id) DO NOTHING
       RETURNING entry_id
     )
     SELECT json_build_object(
       'recorded', EXISTS (SELECT 1 FROM ins),
       'completed', EXISTS (SELECT 1 FROM lb),
       'totalProfit', (SELECT total_profit FROM upd),
       'daysPlayed', (SELECT days_played FROM upd)) AS j`,
    [
      sessionId, scenarioId, `{${(open as string[]).join(',')}}`, JSON.stringify(actual),
      round2(player.revenue), round2(player.ingredient), round2(player.truckCost), round2(player.profit), round2(optimal.profit), gap,
    ],
  )

  return {
    verified: true,
    recorded: res.recorded,
    completed: res.completed,
    daysPlayed: res.daysPlayed,
    totalProfit: res.totalProfit,
    actual,
    player: { revenue: player.revenue, ingredient: player.ingredient, truckCost: player.truckCost, profit: player.profit },
    // Championship rule: show the optimal profit, never the optimal locations.
    optimal: session.matchId ? { profit: optimal.profit } : { sites: scn.optimalSites, profit: optimal.profit },
    gapPct: gap,
  }
}

async function leaderboard(url: URL) {
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10))
  const entries = await sql(
    `SELECT json_build_object('name', display_name, 'totalProfit', total_profit, 'totalOptimal', total_optimal,
              'efficiency', efficiency, 'at', created_at) AS j
     FROM leaderboard_entry WHERE match_id IS NULL ORDER BY efficiency DESC, created_at LIMIT $1`,
    [limit],
  )
  return { entries }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    try {
      if (req.method === 'GET' && (path === '/' || path === '/health')) return json({ ok: true, build: BUILD })
      if (req.method === 'GET' && path === '/v1/leaderboard') return json(await leaderboard(url))
      if (req.method === 'POST' && path === '/v1/sessions') return json(await createSession(req), 201)
      if (req.method === 'POST' && path === '/v1/championships') return json(await createChampionship(req), 201)
      const c = path.match(/^\/v1\/championships\/([^/]+)(\/leaderboard)?$/)
      if (req.method === 'GET' && c) {
        const code = decodeURIComponent(c[1])
        return json(c[2] ? await championshipLeaderboard(code, url) : await championshipInfo(code))
      }
      const m = path.match(/^\/v1\/sessions\/([^/]+)\/days\/([^/]+)\/submit$/)
      if (req.method === 'POST' && m) return json(await submitDay(req, m[1], m[2]))
      return json({ error: 'not found' }, 404)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'internal error' }, 500)
    }
  },
}
