import { useGameStore } from '../../store/game'

export default function Results() {
  const { dayResults, reset } = useGameStore()
  const last = dayResults.at(-1)
  if (!last) return null

  const { playerScore, optimalScore, gapPct } = last

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-4">
      <h2 className="text-xl font-bold text-amber-800">Day Results</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold text-gray-500 uppercase tracking-wide text-xs mb-1">Your placement</p>
          <p className="text-2xl font-bold text-gray-800">${playerScore.profit.toFixed(0)}</p>
          <p className="text-gray-500">Revenue ${playerScore.revenue.toFixed(0)} · Cost ${(playerScore.ingredientCost + playerScore.truckCost).toFixed(0)}</p>
        </div>
        {optimalScore && (
          <div>
            <p className="font-semibold text-gray-500 uppercase tracking-wide text-xs mb-1">Optimal</p>
            <p className="text-2xl font-bold text-green-700">${optimalScore.profit.toFixed(0)}</p>
            <p className="text-gray-500">Gap: {gapPct?.toFixed(1)}%</p>
          </div>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-lg transition"
      >
        Play again
      </button>
    </div>
  )
}
