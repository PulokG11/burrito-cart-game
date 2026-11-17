import { useState } from 'react'
import { apiEnabled } from '../lib/api'
import { useGame } from '../store/game'
import { Logo } from './Header'
import { ChampionshipPanel } from './ChampionshipPanel'
import { Leaderboard } from './Leaderboard'

export function HomeScreen() {
  const { start, connecting } = useGame()
  const [name, setName] = useState('')

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 lg:grid-cols-[1.4fr_1fr] lg:p-8">
      <section className="flex flex-col justify-center">
        <div className="flex items-center gap-3">
          <Logo className="h-14 w-14" />
          <p className="text-base font-bold text-accent">A game about optimization</p>
        </div>
        <h1 className="mt-4 font-display text-3xl leading-tight text-accent sm:text-[44px]">Can you beat the solver at placing burrito trucks?</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Burrito Cart Co. is opening in Salsa Springs. Every truck costs money, and customers only walk so far. Place your trucks, click Done, and see how your
          profit compares with the provably optimal plan.
        </p>

        <ol className="mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
          {[
            ['Place', 'Drag trucks onto spots near hungry buildings.'],
            ['Done', 'A real solver finds the best possible plan.'],
            ['Compare', 'See the gap, read the tips, try again tomorrow.'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-xs font-bold text-accent">Step {i + 1}</p>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>

        <form
          className="mt-8 flex max-w-xl flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(name)
          }}
        >
          <label className="sr-only" htmlFor="name">
            Display name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Your chef name (optional)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={connecting}>
            {connecting ? 'Opening…' : 'Start Round 1'}
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          {apiEnabled ? 'Your name appears on the leaderboard if you finish all 10 days.' : 'Offline mode: scores are not saved.'} Two rounds, five days each.
        </p>
      </section>

      <aside className="flex flex-col gap-4 lg:justify-center">
        <ChampionshipPanel name={name} />
        <section className="panel">
          <h2 className="mb-2 font-semibold">Top chefs</h2>
          <Leaderboard limit={8} />
        </section>
        <section className="panel text-sm text-muted">
          <h2 className="mb-1 font-semibold text-ink">What you will learn</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Planning does not end with a forecast. Choosing many sites together is hard.</li>
            <li>By hand, gaps grow as the number of spots grows (16 on Day 1, 56 on Day 5).</li>
            <li>Solvers handle it in milliseconds, even when demand is uncertain.</li>
          </ul>
          <p className="mt-3 text-xs">
            Inspired by the Burrito Optimization Game from Gurobi and Dr. Larry Snyder. This independent rebuild uses the open-source HiGHS solver.
          </p>
        </section>
      </aside>
    </div>
  )
}
