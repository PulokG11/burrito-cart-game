# Changelog

Every release is a git tag. To roll back the whole app, check out the previous tag's files and push:

```bash
git checkout <tag> -- .
git commit -m "rollback: to <tag>"
git push
```

Pushing to `main` redeploys GitHub Pages. The Neon Function and database are rolled back separately (see each entry).

## v0.2.0-prototype (2026-11-15)

Playable prototype, live at https://pulokg11.github.io/burrito-cart-game/.

- **Backend moved from Supabase to Neon** (the free Supabase plan allows only 2 projects, both in use). Neon project `burrito-cart-game` (`orange-wildflower-67584568`, aws-ap-southeast-1, Postgres 17). `@supabase/supabase-js` removed.
- **Database:** migration `001_init` (scenario, scenario_building, scenario_site, scenario_reach, optimal_solution, player, championship, game_session, day_result, leaderboard_entry) and seed `010_scenarios` (10 days) applied with `npm run db:apply`.
- **API:** Neon Function `api` (no npm dependencies; HTTP SQL). `POST /v1/sessions`, `POST /v1/sessions/{id}/days/{scenario}/submit` (re-scores on the server from the database, idempotent per day, bearer token per session), `GET /v1/leaderboard`, `GET /health`.
- **Game:** 2 rounds × 5 days. Round 1 has exact demand, with a cheese shortage (fewer trucks are optimal) and a rainy day (more are optimal). Round 2 has forecasts with triangular random demand, including asymmetric days. Spots grow from 16 to 56.
- **Solver:** HiGHS (open source) solves each day live in a Web Worker. Optima are pre-solved and stored per scenario (verified against brute force on Day 1).
- **UI:** drag, click or keyboard placement; live profit; walking-customer animation; results side by side with the optimum; tips; CSV data download; leaderboard; dark mode; phone layout.
- **Tests:** `npm test` (21 engine and solver tests), `npm run test:api` (end-to-end against the database).

Rollback: `git checkout v0.1.0-scaffold -- .` restores the Supabase-era scaffold. The Neon project can stay; it is unused by that version. To undo the schema: run `backend/migrations/001_init.down.sql`.

## v0.1.0-scaffold (2026-11-14)

Vite + React + TypeScript scaffold with a Supabase client stub, HiGHS solver worker and component stubs. Not deployed.
