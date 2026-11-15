// Applies pending migrations in order, then the seed. Reads DATABASE_URL from the environment or .env.local.
// Run: npm run db:apply
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'

function loadEnv(file: string) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
loadEnv('.env.local')

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) in the environment or .env.local')

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))

  const migrations = readdirSync('backend/migrations').filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort()
  for (const file of migrations) {
    if (done.has(file)) continue
    await client.query('BEGIN')
    try {
      await client.query(readFileSync(`backend/migrations/${file}`, 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`applied ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  }

  for (const file of readdirSync('backend/seed').filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(readFileSync(`backend/seed/${file}`, 'utf8'))
    console.log(`seeded ${file}`)
  }

  const { rows } = await client.query(`SELECT
    (SELECT count(*) FROM scenario) AS scenarios,
    (SELECT count(*) FROM scenario_building) AS buildings,
    (SELECT count(*) FROM scenario_site) AS sites,
    (SELECT count(*) FROM scenario_reach) AS reach,
    (SELECT count(*) FROM optimal_solution) AS optima`)
  console.log(rows[0])
} finally {
  await client.end()
}
