import { useState } from 'react'
import Header, { type Screen } from './components/Header'
import DashboardScreen from './DashboardScreen'
import MapScreen from './MapScreen'
import TripScreen from './TripScreen'
import './App.css'

/**
 * What the body shows. Trip detail is reached from the Dashboard or the map,
 * so it is a view of its own rather than a tab.
 */
type View =
  | { screen: 'dashboard' }
  | { screen: 'map'; tripId: string | null }
  | { screen: 'trip'; tripId: string; files?: File[] }

/**
 * The owner views (doc 3.1) are kept as local state rather than routes for
 * now; the header tabs switch between Dashboard and Map.
 *
 * "Show on map" opens My photos with that trip selected. Choosing the Map tab
 * directly opens it unfiltered, so the Map then shows all of the owner's photos.
 */
export default function App() {
  const [view, setView] = useState<View>({ screen: 'dashboard' })

  function navigate(next: Screen) {
    setView(next === 'map' ? { screen: 'map', tripId: null } : { screen: 'dashboard' })
  }
  function showOnMap(tripId: string) {
    setView({ screen: 'map', tripId })
  }
  function openTrip(tripId: string) {
    setView({ screen: 'trip', tripId })
  }
  function uploadTo(tripId: string, files: File[]) {
    setView({ screen: 'trip', tripId, files })
  }

  // A trip page belongs to the Dashboard, so that tab stays current there.
  const tab: Screen = view.screen === 'map' ? 'map' : 'dashboard'

  return (
    <div className="app">
      <Header current={tab} onNavigate={navigate} />
      <main className="app-body">
        {view.screen === 'dashboard' ? <DashboardScreen onShowOnMap={showOnMap} onOpenTrip={openTrip} onUploadPhotos={uploadTo} /> : null}
        {view.screen === 'map' ? (
          <MapScreen key={view.tripId ?? 'all'} tripId={view.tripId} onOpenTrip={openTrip} />
        ) : null}
        {view.screen === 'trip' ? (
          <TripScreen
            key={view.tripId}
            tripId={view.tripId}
            initialFiles={view.files}
            onBack={() => navigate('dashboard')}
            onShowOnMap={showOnMap}
          />
        ) : null}
      </main>
    </div>
  )
}
