import { useState } from 'react'
import { apiEnabled, createChampionship, type Championship } from '../lib/api'
import { useGame } from '../store/game'

const CODE = /^[A-Za-z0-9]{1,19}$/
const DURATIONS: [number, string][] = [[3, '3 hours'], [24, '1 day'], [72, '3 days'], [168, '1 week']]

export function ChampionshipPanel({ name }: { name: string }) {
  const { start, connecting } = useGame()
  const [tab, setTab] = useState<'join' | 'create'>('join')
  const [code, setCode] = useState('')
  const [hours, setHours] = useState(72)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<Championship | null>(null)

  if (!apiEnabled) return null

  const codeOk = CODE.test(code)
  const join = async (c: string) => {
    setError(null)
    setError(await start(name, c))
  }

  return (
    <section className="rail rounded-2xl p-5">
      <h2 className="font-display text-xl">Championship</h2>
      <p className="mt-1 text-sm leading-relaxed text-[#E4EAFA]">
        Compete with a class or a crowd on the same random demand. You see the best profit each day, but not where the best trucks go.
      </p>

      {made ? (
        <div className="mt-4 flex flex-col gap-3" aria-live="polite">
          <p className="text-[15px]">Your championship is ready. Share this code with players:</p>
          {/* Not Bungee: it is capitals-only, and codes are case-sensitive. */}
          <p className="select-all rounded-xl bg-white/10 px-4 py-3 text-center text-3xl font-bold tracking-wide">{made.code}</p>
          <p className="text-sm text-[#C9D4F2]">
            Open until {new Date(made.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. Codes are case-sensitive.
          </p>
          <button type="button" className="btn-gold" disabled={connecting} onClick={() => join(made.code)}>
            {connecting ? 'Joining…' : 'Play in it'}
          </button>
          {error && <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-bad">{error}</p>}
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Championship" className="mt-4 inline-flex overflow-hidden rounded-xl border-2 border-white/60">
            {(['join', 'create'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t)
                  setError(null)
                }}
                className={`min-h-[40px] px-4 text-[15px] font-bold ${tab === t ? 'bg-white text-[#1C3A8A]' : 'text-white'}`}
              >
                {t === 'join' ? 'Join with a code' : 'Create one'}
              </button>
            ))}
          </div>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!codeOk) return
              if (tab === 'join') return join(code)
              setBusy(true)
              setError(null)
              const res = await createChampionship(code, name, hours)
              setBusy(false)
              if (res.data) setMade(res.data)
              else setError(res.error)
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-bold">
              Match code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
                maxLength={19}
                autoComplete="off"
                spellCheck={false}
                placeholder={tab === 'join' ? 'From your organizer' : 'For example, OPT101'}
                className="rounded-xl border-2 border-transparent bg-white px-4 py-3 text-base font-normal text-[#1A1F2E] outline-none focus:border-[#F6B22B]"
              />
              <span className="font-normal text-[#C9D4F2]">Up to 19 letters or digits. Upper and lower case count.</span>
            </label>
            {tab === 'create' && (
              <label className="flex flex-col gap-1 text-sm font-bold">
                Open for
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="rounded-xl bg-white px-3 py-3 text-base font-normal text-[#1A1F2E] outline-none"
                >
                  {DURATIONS.map(([h, label]) => (
                    <option key={h} value={h}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-sm text-[#C9D4F2]">{tab === 'join' ? 'Your chef name above is shown on the match leaderboard.' : 'Your chef name above is saved as the organizer.'}</p>
            {error && <p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-bad">{error}</p>}
            <button type="submit" className="btn-gold" disabled={!codeOk || busy || connecting}>
              {tab === 'join' ? (connecting ? 'Joining…' : 'Join championship') : busy ? 'Creating…' : 'Create championship'}
            </button>
          </form>
        </>
      )}
    </section>
  )
}
