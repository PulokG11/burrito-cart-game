import { useGameStore } from '../../store/game'

export default function GameBoard() {
  const { scenario, openSiteIds, toggleSite } = useGameStore()

  if (!scenario) return <div className="text-gray-400 text-center p-8">No scenario loaded.</div>

  return (
    <div className="relative w-full aspect-square bg-white rounded-lg shadow border">
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Buildings */}
        {scenario.buildings.map((b) => (
          <g key={b.id}>
            <rect x={b.x - 10} y={b.y - 10} width={20} height={20} fill="#6b7280" rx={2} />
            <text x={b.x} y={b.y + 25} textAnchor="middle" fontSize={10} fill="#374151">
              {b.label}
            </text>
          </g>
        ))}

        {/* Sites */}
        {scenario.sites.map((s) => {
          const open = openSiteIds.includes(s.id)
          return (
            <g key={s.id} className="cursor-pointer" onClick={() => toggleSite(s.id)}>
              <circle
                cx={s.x}
                cy={s.y}
                r={14}
                fill={open ? '#f59e0b' : '#e5e7eb'}
                stroke={open ? '#d97706' : '#9ca3af'}
                strokeWidth={2}
              />
              <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={12} fill={open ? '#78350f' : '#6b7280'}>
                {open ? '🌯' : '+'}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
