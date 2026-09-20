import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite build configuration for the UniMap frontend.
 *
 * Only the React plugin is enabled: the skeleton has no aliases, proxies or
 * env handling yet because the backend API style is still undecided.
 */
export default defineConfig({
  plugins: [react()],
})
