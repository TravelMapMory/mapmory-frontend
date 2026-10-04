import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite build configuration for the MapMory frontend.
 *
 * Only the React plugin is enabled. Environment variables prefixed with VITE_ (such as VITE_GEOAPIFY_KEY, see README) are read from .env.local.
 */
export default defineConfig({
  plugins: [react()],
})
