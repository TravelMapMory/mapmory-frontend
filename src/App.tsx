import { useState } from 'react'
import Header from './components/Header'
import MapScreen from './MapScreen'
import ProfileScreen from './ProfileScreen'
import './App.css'

/**
 * The two screens the Figma file describes. Kept as local state rather than
 * routes: the design specifies no URLs, and the header's own control is the
 * only way between them.
 */
type Screen = 'map' | 'profile'

/**
 * Application shell. The header is shared by both screens and changes its
 * trailing control per screen, exactly as the design's two header variants do:
 * the map screen shows a menu button, the profile page an "Interactive Map"
 * button that goes back to the map.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('map')

  return (
    <div className="app">
      <Header
        action={screen === 'map' ? 'menu' : 'interactive-map'}
        onAction={() => setScreen(screen === 'map' ? 'profile' : 'map')}
      />
      <main className="app-body">
        {screen === 'map' ? <MapScreen /> : <ProfileScreen />}
      </main>
    </div>
  )
}
