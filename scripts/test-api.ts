// End-to-end check of the API handler against the real database. Plays all 10 days, then deletes its own rows.
// Run: npm run test:api   (set API_URL to test a deployed function instead of the local handler)
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import pg from 'pg'
import { drawActuals } from '../src/engine/demand.ts'
import { score } from '../src/engine/score.ts'
import type { Scenario } from '../src/engine/types.ts'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const scenarios: Scenario[] = JSON.parse(readFileSync('src/scenarios/v1.json', 'utf8'))
const remote = process.env.API_URL?.replace(/\/+$/, '')
const local = remote ? null : (await import('../server/index.ts')).default
const origin = 'https://pulokg11.github.io'

async function call(method: string, path: string, body?: unknown, token?: string) {
  const req = new Request(`${remote ?? 'http://local'}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const res = local ? await local.fetch(req) : await fetch(req)
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), body: await res.json().catch(() => null) }
}

let sessionId = ''
try {
  const health = await call('GET', '/health')
  assert.equal(health.status, 200)
  assert.equal(health.cors, origin)
  console.log('health', health.body)

  const created = await call('POST', '/v1/sessions', { displayName: '  api <test>  ' })
  assert.equal(created.status, 201)
  sessionId = created.body.sessionId
  const { token, seed } = created.body
  assert.equal(created.body.displayName, 'api test')

  const d1 = scenarios[0]
  assert.equal((await call('POST', `/v1/sessions/${sessionId}/days/${d1.id}/submit`, { openSites: [] }, 'wrong')).status, 401)
  assert.equal((await call('POST', `/v1/sessions/${sessionId}/days/${d1.id}/submit`, { openSites: ['S99'] }, token)).status, 422)
  assert.equal((await call('POST', `/v1/sessions/${sessionId}/days/${d1.id}/submit`, { openSites: ['S01', 'S01'] }, token)).status, 422)

  let expectedTotal = 0
  for (const [i, scn] of scenarios.entries()) {
    // Play the greedy answer: deterministic and usually below optimal.
    const open = scn.greedy.sites
    const r = await call('POST', `/v1/sessions/${sessionId}/days/${scn.id}/submit`, { openSites: open }, token)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    const actual = drawActuals(scn, seed)
    assert.deepEqual(r.body.actual, actual, `${scn.id}: client and server draws differ`)
    const mine = score(scn, open, actual).profit
    assert.ok(Math.abs(r.body.player.profit - mine) < 1e-6, `${scn.id}: profit mismatch`)
    assert.ok(Math.abs(r.body.optimal.profit - score(scn, scn.optimal.sites, actual).profit) < 1e-6)
    expectedTotal += Math.round(mine * 100) / 100
    assert.equal(r.body.recorded, true)
    assert.equal(r.body.completed, i === scenarios.length - 1)
    console.log(`${scn.id} profit ${r.body.player.profit.toFixed(2).padStart(9)} optimal ${r.body.optimal.profit.toFixed(2).padStart(9)} gap ${r.body.gapPct}%`)
  }

  const again = await call('POST', `/v1/sessions/${sessionId}/days/${d1.id}/submit`, { openSites: d1.optimal.sites }, token)
  assert.equal(again.status, 200)
  assert.equal(again.body.recorded, false, 'resubmit must not be recorded twice')

  const lb = await call('GET', '/v1/leaderboard?limit=50')
  const entry = lb.body.entries.find((e: { name: string }) => e.name === 'api test')
  assert.ok(entry, 'completed session appears on the leaderboard')
  assert.ok(Math.abs(Number(entry.totalProfit) - expectedTotal) < 0.05, `total ${entry.totalProfit} vs ${expectedTotal}`)
  console.log('leaderboard entry', entry)
  console.log('API OK')
} finally {
  if (sessionId && process.env.DATABASE_URL) {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await db.connect()
    const { rows } = await db.query('DELETE FROM game_session WHERE session_id = $1 RETURNING player_id', [sessionId])
    if (rows[0]) await db.query('DELETE FROM player WHERE player_id = $1', [rows[0].player_id])
    await db.end()
    console.log('cleaned up test session')
  }
}
