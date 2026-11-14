export interface ScenarioPackage {
  meta: {
    version: string
    round: 1 | 2
    day: 1 | 2 | 3 | 4 | 5
    contentHash: string
  }
  scenario: import('../engine/types').Scenario
  optimalSiteIds?: string[]
  optimalProfit?: number
}
