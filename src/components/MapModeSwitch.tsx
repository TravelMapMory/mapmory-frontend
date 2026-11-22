import { Globe, Images } from 'lucide-react'
import './MapModeSwitch.css'

export type MapMode = 'mine' | 'public'

const MODES: { id: MapMode; label: string; icon: typeof Globe }[] = [
  { id: 'mine', label: 'My photos', icon: Images },
  { id: 'public', label: 'Public', icon: Globe },
]

/**
 * The Map's two modes (doc 3.2) for a signed-in owner: their own photos, or
 * photos anyone has shared publicly. Each mode has its own address, so it is
 * navigation rather than a toggle, and the current one is marked as the page.
 */
export default function MapModeSwitch({ mode, onChange }: { mode: MapMode; onChange: (mode: MapMode) => void }) {
  return (
    <nav className="map-mode" aria-label="Map mode">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className="map-mode-btn"
          aria-current={mode === id ? 'page' : undefined}
          onClick={() => {
            if (mode !== id) onChange(id)
          }}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </nav>
  )
}
