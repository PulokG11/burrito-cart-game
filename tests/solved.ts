// Test-only: the shipped scenarios joined with their pre-solved plans from backend/seed/optima.v1.json.
import { readFileSync } from 'node:fs'
import type { Plan, Scenario, SolvedScenario } from '../src/engine/types.ts'

const puzzles: Scenario[] = JSON.parse(readFileSync(new URL('../src/scenarios/v1.json', import.meta.url), 'utf8'))
const optima: Record<string, { optimal: Plan; greedy: Plan }> = JSON.parse(
  readFileSync(new URL('../backend/seed/optima.v1.json', import.meta.url), 'utf8'),
)

export const SOLVED: SolvedScenario[] = puzzles.map((s) => ({ ...s, ...optima[s.id] }))
