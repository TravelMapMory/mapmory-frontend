import { useEffect, useMemo, useRef, useState } from 'react'
import Header, { type Screen } from './components/Header'
import DashboardScreen from './DashboardScreen'
import AuthScreen from './AuthScreen'
import LandingScreen from './LandingScreen'
import MapScreen from './MapScreen'
import NotFoundScreen from './NotFoundScreen'
import TripScreen from './TripScreen'
import { isOwnerRoute, navigate, routeTitle, useRoute, type Route } from './router'
import './App.css'

/**
 * Remembers the demo sign-in for this tab, so a reload does not drop the
 * owner back on the landing page. Firebase Auth will replace this.
 */
const SESSION_KEY = 'mapmory.signedIn'

function readSignedIn(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeSignedIn(value: boolean) {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, '1')
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage can be blocked; the sign-in then lasts until reload.
  }
}

/**
 * Which page a signed-in or signed-out visitor may see at `route`, or null
 * when it is theirs to see. Owner pages send signed-out visitors to log in;
 * the landing and sign-in pages send a signed-in owner to the Dashboard.
 */
function redirectFor(route: Route, signedIn: boolean): Route | null {
  if (!signedIn && isOwnerRoute(route)) return { name: 'login' }
  if (signedIn && (route.name === 'landing' || route.name === 'signup' || route.name === 'login')) {
    return { name: 'dashboard' }
  }
  return null
}

/**
 * Every page has an address (src/router.ts). Trip detail is reached from the
 * Dashboard or the map, so it is a page of its own rather than a tab.
 *
 * "Show on map" opens My photos with that trip selected (/map?trip=…).
 * Choosing the Map tab opens it unfiltered, so it shows all of the owner's photos.
 */
export default function App() {
  const route = useRoute()
  const [signedIn, setSignedIn] = useState(readSignedIn)
  /** The owner page a signed-out visitor asked for, opened after they log in. */
  const returnTo = useRef<Route | null>(null)
  /** Files chosen on the Dashboard, handed to the trip page once. */
  const [pendingUpload, setPendingUpload] = useState<{ tripId: string; files: File[] } | null>(null)

  const redirect = useMemo(() => redirectFor(route, signedIn), [route, signedIn])

  useEffect(() => {
    if (!redirect) return
    if (redirect.name === 'login') returnTo.current = route
    navigate(redirect, { replace: true })
  }, [redirect, route])

  useEffect(() => {
    document.title = routeTitle(route)
  }, [route])

  // Leaving the trip page drops files it was given, so Back/Forward cannot upload them twice.
  useEffect(() => {
    if (pendingUpload && !(route.name === 'trip' && route.tripId === pendingUpload.tripId)) setPendingUpload(null)
  }, [route, pendingUpload])

  function signIn() {
    writeSignedIn(true)
    setSignedIn(true)
    const next = returnTo.current ?? { name: 'dashboard' }
    returnTo.current = null
    navigate(next, { replace: true })
  }
  function signOut() {
    writeSignedIn(false)
    setSignedIn(false)
    navigate({ name: 'landing' })
  }

  function openTab(next: Screen) {
    navigate(next === 'map' ? { name: 'map', tripId: null } : { name: 'dashboard' })
  }
  function showOnMap(tripId: string) {
    navigate({ name: 'map', tripId })
  }
  function openTrip(tripId: string) {
    navigate({ name: 'trip', tripId })
  }
  function uploadTo(tripId: string, files: File[]) {
    setPendingUpload({ tripId, files })
    navigate({ name: 'trip', tripId })
  }

  // Render nothing for the one frame before a redirect lands.
  if (redirect) return null

  if (route.name === 'landing') {
    return <LandingScreen onSignIn={() => navigate({ name: 'login' })} onSignUp={() => navigate({ name: 'signup' })} />
  }
  if (route.name === 'signup' || route.name === 'login') {
    return (
      <AuthScreen
        mode={route.name}
        onModeChange={(mode) => navigate({ name: mode }, { replace: true })}
        onSignedIn={signIn}
        onBack={() => navigate({ name: 'landing' })}
      />
    )
  }
  if (route.name === 'not-found') {
    return <NotFoundScreen signedIn={signedIn} onHome={() => navigate({ name: signedIn ? 'dashboard' : 'landing' })} />
  }

  // A trip page belongs to the Dashboard, so that tab stays current there.
  const tab: Screen = route.name === 'map' ? 'map' : 'dashboard'

  return (
    <div className="app">
      <Header current={tab} onNavigate={openTab} onSignOut={signOut} />
      <main className="app-body">
        {route.name === 'dashboard' ? (
          <DashboardScreen onShowOnMap={showOnMap} onOpenTrip={openTrip} onUploadPhotos={uploadTo} />
        ) : null}
        {route.name === 'map' ? (
          <MapScreen key={route.tripId ?? 'all'} tripId={route.tripId} onOpenTrip={openTrip} />
        ) : null}
        {route.name === 'trip' ? (
          <TripScreen
            key={route.tripId}
            tripId={route.tripId}
            initialFiles={pendingUpload?.tripId === route.tripId ? pendingUpload.files : undefined}
            onBack={() => openTab('dashboard')}
            onShowOnMap={showOnMap}
          />
        ) : null}
      </main>
    </div>
  )
}
