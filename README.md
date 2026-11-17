# Burrito Cart Game

**Play it: https://pulokg11.github.io/burrito-cart-game/**

A browser game about optimization. Burrito Cart Co. is opening in Salsa Springs. Place food trucks where hungry customers can reach them, click **Done**, and see how your profit compares with the provably optimal plan, solved live in your browser.

Inspired by the Burrito Optimization Game by Gurobi and Dr. Larry Snyder. This is an independent rebuild that uses the open-source HiGHS solver. The design docs are in this folder (`Burrito_Optimization_Game_Product_Guide.docx`, `Burrito_Optimization_Game_PRD_and_TADD.docx`).

## How it plays

- **Round 1 (Days 1–5):** demand is known exactly. Each day adds a twist: more customers, a cheese shortage (ingredients cost more, so fewer trucks are optimal), rain (customers walk less far, so more trucks are optimal), and a festival with 56 possible spots.
- **Round 2 (Days 1–5):** numbers are forecasts. Actual demand is drawn at random from a triangular distribution inside the error bars and revealed after you click Done. Both your plan and the optimal plan are scored on the same draw.
- **Scoring:** Profit = sales − ingredients − trucks. Each building's customers walk to the nearest truck; the farther it is, the fewer come.
- **After each day:** your map next to the optimal one, the gap, the solver's time, and tips. Finish all 10 days to reach the leaderboard (ranked by share of the optimal profit).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | TypeScript, React 18, Vite, Tailwind CSS, Zustand |
| Map | SVG for the city, Canvas overlay for walking customers |
| Solver | [HiGHS](https://highs.dev) compiled to WebAssembly, in a Web Worker |
| Database | [Neon](https://neon.com) Postgres 17 (project `orange-wildflower-67584568`) |
| API | Neon Function `api`, authoritative scoring and leaderboard |
| Hosting | GitHub Pages via GitHub Actions |

The game runs fully in the browser. If the API is unreachable it keeps working offline; scores are just not saved.

## Project structure

```
burrito-cart-game/
├── src/
│   ├── engine/        # Shared game logic: scoring, walking profile, demand draws, MIP model, greedy, tips
│   ├── scenarios/     # v1.json: the 10 days (generated) + loader
│   ├── solver/        # HiGHS Web Worker
│   ├── store/         # Zustand game state
│   ├── lib/           # API client, CSV export, formatting
│   └── components/    # Home, Play, Results, Final screens; CityMap
├── server/            # Neon Function (imports src/engine, so client and server score identically)
├── backend/
│   ├── migrations/    # 001_init.sql (+ .down.sql)
│   └── seed/          # 010_scenarios.sql (generated)
├── scripts/           # build-scenarios, db-apply, serve-api, test-api
├── tests/             # Vitest engine and solver tests
└── .github/workflows/pages.yml
```

## Development

Requires Node 24+ (scripts run TypeScript directly; Node 26 recommended).

```bash
npm install
npm run dev          # http://localhost:5175
npm test             # engine + solver unit tests
npm run build        # production build to dist/
```

Backend scripts read `DATABASE_URL` / `DATABASE_URL_UNPOOLED` from `.env.local` (git-ignored, see `.env.example`):

```bash
npm run scenarios    # regenerate src/scenarios/v1.json + backend/seed/010_scenarios.sql, pre-solving with HiGHS
npm run db:apply     # apply pending migrations, then the seed
npm run api:dev      # run the API handler locally on :8787
npm run test:api     # end-to-end API test (set API_URL to test the deployed function)
npm run api:build    # bundle server/ to dist-server/index.mjs for deployment
```

The deployed API URL is public and lives in `.env.production`. Scenarios are immutable once released; change the game by adding a new dataset version rather than editing `v1`.

## Deployment

Pushing to `main` runs the tests, builds, and publishes to GitHub Pages. The Neon Function is deployed separately: build it with `npm run api:build`, zip `dist-server/index.mjs`, and deploy it to branch `main` as slug `api` (Neon CLI `neon functions deploy api --src dist-server`, or the Neon MCP `deploy_function` tool).

See `CHANGELOG.md` for releases and rollback steps.

## Status

Playable, with Championship mode (v0.4.0): create a match code on the home screen, share it, and everyone plays the same random demand on a shared leaderboard. Not built yet: sound, and separate Championship datasets.
