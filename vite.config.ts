import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Honour a PORT supplied by the environment (tooling/preview harnesses set
  // this) instead of always grabbing 5173 and silently sliding to the next
  // free port, which leaves the caller pointed at the wrong address.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
})
