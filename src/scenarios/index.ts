import type { Scenario } from '../engine/types'
import data from './v1.json'

export const SCENARIOS = data as unknown as Scenario[]
export const DAYS_PER_ROUND = 5
