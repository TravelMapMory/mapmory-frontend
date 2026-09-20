import { useState } from 'react'
import MapScreen from './MapScreen'
import ProfileScreen from './ProfileScreen'

/**
 * The two screens the Figma mock-up contains. Kept as a plain union with local
 * state rather than a router: two screens do not justify a routing dependency,
 * and no URL-addressable routes have been specified yet.
 */
type Screen = 'map' | 'profile'

/**
 * Application shell: the mock-up's white top bar (brand, screen switcher and
 * the dark "Interactive Map" action) above whichever screen is selected.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('map')

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>MapMory</strong>
          <span className="eyebrow">Memory Platform</span>
        </div>

        <nav className="nav">
          <button type="button" aria-current={screen === 'map'} onClick={() => setScreen('map')}>
            Map
          </button>
          <button type="button" aria-current={screen === 'profile'} onClick={() => setScreen('profile')}>
            Profile
          </button>
        </nav>

        <button type="button" className="pill" onClick={() => setScreen('map')}>
          Interactive Map
        </button>
      </header>

      <main className="screen">{screen === 'map' ? <MapScreen /> : <ProfileScreen />}</main>
    </div>
  )
}
