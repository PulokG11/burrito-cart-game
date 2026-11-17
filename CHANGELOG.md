# Changelog

Every release is a git tag. To roll back the whole app, check out the previous tag's files and push:

```bash
git checkout <tag> -- .
git commit -m "rollback: to <tag>"
git push
```

Pushing to `main` redeploys GitHub Pages. The Neon Function and database are rolled back separately (see each entry).

## v0.3.0-redesign (2026-11-17)

New look from the design mockups in `docs/design-mockups-2026-11-17/` ("Salsa Springs, painted").

- **Theme:** talavera cobalt, chile, marigold and nopal palette; Bungee for numbers and titles, Atkinson Hyperlegible for text. Replaces the cream and terracotta look.
- **Map:** asphalt streets, painted rooftops with a sign for each building's pun, parks with trees, 32 px demand badges with a capture ring, yellow parking bays, a Building names switch.
- **Play:** a dragged truck shows how far customers will walk to it; a cobalt panel holds the day's story and costs, total profit with progress tiles, and a building inspector with the walking curve; the profit is written as an equation.
- **Round 2:** range bars drawn to scale with forecast, average and (after Done) actual.
- **Results:** one map with a Your plan / Best plan / Both switch, the best plan's trucks as outlines, tip arrows, and the verdict as a share of the best profit.
- **Phone:** swipeable full-size map and a compact bottom bar.
- Not built from the mockups: the minimap and zoom buttons.

Rollback: `git checkout v0.2.0-prototype -- src index.html tailwind.config.ts` then commit and push. No backend or database changes.

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
