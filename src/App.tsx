import { useEffect, useMemo, useRef, useState } from 'react'
import Header, { type Screen } from './components/Header'
import DashboardScreen from './DashboardScreen'
import AuthScreen from './AuthScreen'
import { currentAccount, deleteSignIn, firebaseEnabled, logOut, reauthenticateForDeletion, watchSignedIn, type Account } from './auth'
import VerifyEmailBanner from './components/VerifyEmailBanner'
import { completeAccountDeletion } from './accountDeletion'
import LandingScreen from './LandingScreen'
import PublicHeader from './components/PublicHeader'
import MapScreen from './MapScreen'
import NotFoundScreen from './NotFoundScreen'
import PublicMapScreen from './PublicMapScreen'
import SharedScreen from './SharedScreen'
import { deleteAccount, sharingAvailable } from './api/client'
import DeleteAccountPanel from './components/DeleteAccountPanel'
import TripScreen from './TripScreen'
import { isOwnerRoute, navigate, routeTitle, useRoute, type Route } from './router'
import './App.css'

/**
 * Remembers the demo sign-in for this tab, so a reload does not drop the
 * owner back on the landing page. With Firebase configured, Firebase keeps
 * the session instead (src/auth.ts).
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
function redirectFor(route: Route, signedIn: boolean | null): Route | null {
  if (signedIn === null) return null
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
  /** null until Firebase has restored or ruled out a session, so private pages never flash. */
  const [signedIn, setSignedIn] = useState<boolean | null>(() => (firebaseEnabled ? null : readSignedIn()))
  /** The owner page a signed-out visitor asked for, opened after they log in. */
  const returnTo = useRef<Route | null>(null)
  /** Files chosen on the Dashboard, handed to the trip page once. */
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deletionNotice, setDeletionNotice] = useState('')
  /** Shown once on the Dashboard after a trip was deleted. */
  const [tripNotice, setTripNotice] = useState('')
  /** Who is signed in, for the account menu and the verification banner. */
  const [account, setAccount] = useState<Account | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ tripId: string; files: File[] } | null>(null)

  const redirect = useMemo(() => redirectFor(route, signedIn), [route, signedIn])

  // Firebase is the external system here: it restores the session, then reports every change.
  useEffect(() => (firebaseEnabled ? watchSignedIn(setSignedIn) : undefined), [])

  useEffect(() => {
    if (!redirect) return
    let next = redirect
    if (redirect.name === 'login') returnTo.current = route
    else if (redirect.name === 'dashboard' && returnTo.current) {
      // Just signed in: open the owner page that sent them to log in.
      next = returnTo.current
      returnTo.current = null
    }
    navigate(next, { replace: true })
  }, [redirect, route])

  useEffect(() => {
    document.title = routeTitle(route)
  }, [route])

  // Firebase knows the name and email once the session is restored; the demo has none.
  useEffect(() => {
    setAccount(signedIn && firebaseEnabled ? currentAccount() : null)
  }, [signedIn])

  // Leaving the trip page drops files it was given, so Back/Forward cannot upload them twice.
  useEffect(() => {
    if (pendingUpload && !(route.name === 'trip' && route.tripId === pendingUpload.tripId)) setPendingUpload(null)
  }, [route, pendingUpload])

  // Signing in leaves the log-in page through the redirect above.
  function signIn() {
    if (!firebaseEnabled) writeSignedIn(true)
    // Firebase reports the session before sign-up has saved the name, so read
    // the account again once signing in or up has completely finished.
    else setAccount(currentAccount())
    setSignedIn(true)
  }
  // Reauthenticate before touching persisted data. After the backend commit,
  // Firebase deletion can still fail independently, so report that outcome.
  async function confirmDeleteAccount(password: string) {
    if (firebaseEnabled) {
      const result = await completeAccountDeletion(password, {
        reauthenticate: reauthenticateForDeletion,
        deleteData: deleteAccount,
        deleteIdentity: deleteSignIn,
      })
      setDeletionNotice(result.status === 'identity-retained'
        ? 'Your MapMory data was deleted, but your Firebase sign-in account could not be removed. You have been signed out. Please contact the MapMory team to finish deleting your sign-in account.'
        : 'Your MapMory data and sign-in account were deleted.')
    } else {
      await deleteAccount()
      writeSignedIn(false)
      setDeletionNotice('Your MapMory demo account and its content were deleted.')
    }
    setDeletingAccount(false)
    setSignedIn(false)
    navigate({ name: 'landing' })
  }
  async function signOut() {
    if (firebaseEnabled) await logOut()
    else writeSignedIn(false)
    setSignedIn(false)
    navigate({ name: 'landing' })
  }

  function openTab(next: Screen) {
    navigate(next === 'map' ? { name: 'map', tripId: null } : { name: 'dashboard' })
  }
  function showOnMap(tripId: string) {
    navigate({ name: 'map', tripId })
  }
  function openPublicShare(shareId: string) {
    navigate({ name: 'public-share', shareId })
  }
  function openTrip(tripId: string) {
    navigate({ name: 'trip', tripId })
  }
  function uploadTo(tripId: string, files: File[]) {
    setPendingUpload({ tripId, files })
    navigate({ name: 'trip', tripId })
  }

  // Render nothing while Firebase restores the session, and for the one frame before a redirect lands.
  if (signedIn === null || redirect) return null

  if (route.name === 'landing') {
    return (
      <LandingScreen
        onSignIn={() => navigate({ name: 'login' })}
        onSignUp={() => navigate({ name: 'signup' })}
        onExplore={() => navigate({ name: 'public-map' })}
        deletionNotice={deletionNotice}
      />
    )
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
  if (route.name === 'shared') {
    if (!sharingAvailable) {
      return <NotFoundScreen signedIn={signedIn} onHome={() => navigate({ name: signedIn ? 'dashboard' : 'landing' })} />
    }
    return (
      <SharedScreen
        key={route.token}
        source={{ kind: 'link', token: route.token }}
        onHome={() => navigate({ name: signedIn ? 'dashboard' : 'landing' })}
      />
    )
  }
  // A public share is its own page for everyone; it never leads into the owner's account.
  if (route.name === 'public-share') {
    return (
      <SharedScreen
        key={route.shareId}
        source={{ kind: 'public', shareId: route.shareId }}
        onHome={() => navigate({ name: signedIn ? 'dashboard' : 'landing' })}
        onBackToMap={() => navigate({ name: 'public-map' })}
      />
    )
  }
  // Signed-out visitors get the public map without the owner's navigation bar.
  if (route.name === 'public-map' && !signedIn) {
    return (
      <div className="app">
        <PublicHeader onHome={() => navigate({ name: 'landing' })} onSignIn={() => navigate({ name: 'login' })} />
        <main className="app-body" id="main" tabIndex={-1}>
          <PublicMapScreen onOpenShare={openPublicShare} />
        </main>
      </div>
    )
  }
  if (route.name === 'not-found') {
    return <NotFoundScreen signedIn={signedIn} onHome={() => navigate({ name: signedIn ? 'dashboard' : 'landing' })} />
  }

  // A trip page belongs to the Dashboard, so that tab stays current there.
  const tab: Screen = route.name === 'map' || route.name === 'public-map' ? 'map' : 'dashboard'

  return (
    <div className="app">
      <Header
        current={tab}
        onNavigate={openTab}
        onSignOut={signOut}
        onDeleteAccount={() => setDeletingAccount(true)}
        account={account ? { name: account.name, email: account.email } : { name: 'Demo account' }}
      />
      {account && !account.emailVerified ? (
        <VerifyEmailBanner
          email={account.email}
          onVerified={() => setAccount({ ...account, emailVerified: true })}
          floating={route.name === 'map' || route.name === 'public-map'}
        />
      ) : null}
      {deletingAccount ? (
        <DeleteAccountPanel onConfirm={confirmDeleteAccount} requirePassword={firebaseEnabled} onCancel={() => setDeletingAccount(false)} />
      ) : null}
      <main className="app-body" id="main" tabIndex={-1}>
        {route.name === 'dashboard' ? (
          <DashboardScreen
            onShowOnMap={showOnMap}
            onOpenTrip={openTrip}
            onUploadPhotos={uploadTo}
            notice={tripNotice}
            onDismissNotice={() => setTripNotice('')}
          />
        ) : null}
        {route.name === 'map' ? (
          <MapScreen
            key={route.tripId ?? 'all'}
            tripId={route.tripId}
            onOpenTrip={openTrip}
            onPublicMap={() => navigate({ name: 'public-map' })}
          />
        ) : null}
        {route.name === 'public-map' ? (
          <PublicMapScreen onOpenShare={openPublicShare} onMyPhotos={() => navigate({ name: 'map', tripId: null })} />
        ) : null}
        {route.name === 'trip' ? (
          <TripScreen
            key={route.tripId}
            tripId={route.tripId}
            initialFiles={pendingUpload?.tripId === route.tripId ? pendingUpload.files : undefined}
            onBack={() => openTab('dashboard')}
            onShowOnMap={showOnMap}
            onDeleted={(title) => {
              setTripNotice(`“${title}” and its photos were deleted.`)
              navigate({ name: 'dashboard' })
            }}
          />
        ) : null}
      </main>
    </div>
  )
}
