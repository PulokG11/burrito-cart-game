/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/burrito-cart-game/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['highs'] },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, strictPort: true },
  test: { include: ['tests/**/*.test.ts'] },
}))
