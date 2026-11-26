import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App'

/** Marks an image once it has loaded or failed, so motion.css can fade it in instead of letting it pop. */
function markImageSettled(event: Event) {
  if (event.target instanceof HTMLImageElement) event.target.dataset.loaded = 'true'
}

// load and error do not bubble, so listen while capturing.
document.addEventListener('load', markImageSettled, true)
document.addEventListener('error', markImageSettled, true)

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <a className="skip-link" href="#main">
      Skip to content
    </a>
    <App />
  </StrictMode>,
)
