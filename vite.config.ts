import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite build configuration for the MapMory frontend.
 *
 * Environment variables prefixed with VITE_ (such as VITE_GEOAPIFY_KEY and
 * VITE_API_URL, see README) are read from .env.local. When VITE_API_URL is set,
 * the dev server forwards /api to it, so the browser calls the backend on the
 * same origin and the backend needs no CORS headers.
 */
export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL
  return {
    plugins: [react()],
    server: apiUrl ? { proxy: { '/api': { target: apiUrl, changeOrigin: true } } } : undefined,
  }
})
