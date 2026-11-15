const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function money(v: number): string {
  const r = Math.round(v)
  return `${r < 0 ? '−' : ''}$${whole.format(Math.abs(r))}`
}

// A cost shown as a deduction; zero stays "$0" rather than "−$0".
export function cost(v: number): string {
  return Math.round(v) === 0 ? '$0' : `−${money(v)}`
}

// Map units to city blocks (streets are 3 units apart).
export function blocks(units: number): string {
  const b = units / 3
  return `${b < 1 ? b.toFixed(1) : b.toFixed(1).replace(/\.0$/, '')} block${Math.abs(b - 1) < 0.05 ? '' : 's'}`
}

export function pct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`
}

export function combos(n: number): string {
  if (n <= 20) return whole.format(2 ** n)
  const names: [number, string][] = [[1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']]
  const v = 2 ** n
  for (const [d, name] of names) if (v >= d) return `about ${Math.round(v / d)} ${name}`
  return whole.format(v)
}
