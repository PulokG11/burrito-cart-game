# Burrito Cart Game

A browser-based educational game teaching facility-location optimization. Players place burrito trucks on a city map; hitting **Done** runs a MIP solver and reveals the optimal placement.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | TypeScript + React 18 + Vite |
| Map rendering | SVG (static) + Canvas (particle animations) |
| Styling | Tailwind CSS |
| State | Zustand |
| Solver | HiGHS.js (WASM WebWorker) |
| Auth + DB + Realtime | Supabase |
| Deployment | GitHub Pages + Supabase hosted |

## Project Structure

```
burrito-cart-game/
├── src/
│   ├── engine/          # Scoring + demand-draw pure functions
│   ├── solver/          # HiGHS.js WebWorker wrapper
│   ├── scenarios/       # Versioned JSON scenario packages
│   ├── components/      # React UI components
│   │   ├── GameBoard/   # SVG map + Canvas overlay
│   │   ├── Toolbar/     # Truck palette, live profit, Done button
│   │   ├── Results/     # Side-by-side player vs optimal
│   │   └── Championship/
│   ├── store/           # Zustand game state
│   ├── lib/             # Supabase client
│   └── main.tsx
├── assets/images/       # Sprites and artwork
├── docs/                # Design documents
└── .env.example         # Required env vars
```

## Getting Started

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Status

Scaffold complete — game logic and UI implementation in progress.
