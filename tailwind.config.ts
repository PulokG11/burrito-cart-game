import type { Config } from 'tailwindcss'

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        chip: v('chip'),
        accent: v('accent'),
        good: v('good'),
        bad: v('bad'),
        bulb: v('bulb'),
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
