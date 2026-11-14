import { useGameStore } from '../../store/game'
import { score } from '../../engine/score'
import { drawDeterministic } from '../../engine/demand'
import { solveDay } from '../../solver'

export default function Toolbar() {
  const { scenario, openSiteIds, setPhase, addDayResult, phase } = useGameStore()

  const liveScore = scenario
    ? score(scenario, openSiteIds, drawDeterministic(scenario))
    : null

  const handleDone = async () => {
    if (!scenario) return
    setPhase('solving')
    const demand = drawDeterministic(scenario)
    const playerScore = score(scenario, openSiteIds, demand)
    const opt = await solveDay(scenario, demand)
    const optScore = score(scenario, opt.openSiteIds, demand)
    const gapPct = optScore.profit > 0
      ? ((optScore.profit - playerScore.profit) / optScore.profit) * 100
      : 0
    addDayResult({ openSiteIds, demand, playerScore, optimalScore: optScore, gapPct })
    setPhase('results')
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white border-t shadow-sm">
      <div className="text-sm text-gray-600">
        Trucks placed: <span className="font-semibold text-amber-700">{openSiteIds.length}</span>
      </div>
      {liveScore && (
        <div className="text-sm text-gray-600">
          Live profit:{' '}
          <span className={`font-semibold ${liveScore.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${liveScore.profit.toFixed(0)}
          </span>
        </div>
      )}
      <button
        onClick={handleDone}
        disabled={phase === 'solving' || openSiteIds.length === 0}
        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold rounded-lg transition"
      >
        {phase === 'solving' ? 'Solving…' : 'Done'}
      </button>
    </div>
  )
}
