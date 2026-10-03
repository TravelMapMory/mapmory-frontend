import { useState } from 'react'
import Header, { type Screen } from './components/Header'
import DashboardScreen from './DashboardScreen'
import MapScreen from './MapScreen'
import './App.css'
/**
 * The two owner views (doc 3.1) are kept as local state rather than routes for now; the header tabs switch between them.
 *
 * `selectedTripId` carries "Show on map" from a Dashboard trip card to the Map, which opens My photos with that trip selected. 
 * Choosing the Map tab directly clears it, so the Map then shows all of the owner's photos.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  function navigate(next: Screen) {
    setSelectedTripId(null)
    setScreen(next)
  }
  function showOnMap(tripId: string) {
    setSelectedTripId(tripId)
    setScreen('map')
  }
  return (
    <div className="app">
      <Header current={screen} onNavigate={navigate} />
      <main className="app-body">
        {screen === 'dashboard' ? (
          <DashboardScreen onShowOnMap={showOnMap} />
        ) : (
          <MapScreen tripId={selectedTripId} />
        )}
      </main>
    </div>
  )
}
