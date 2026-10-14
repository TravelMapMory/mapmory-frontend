import { useMemo, useSyncExternalStore } from 'react'

/*
 * A small History API router. Every screen has an address, so Back/Forward,
 * reload and copied links work. It is in-house rather than react-router to
 * avoid a dependency (and a lockfile rewrite) for seven paths.
 *
 *   /                 landing          /dashboard         Dashboard
 *   /signup           sign up          /map               Map · My photos
 *   /login            log in           /map?trip={id}     Map, one trip selected
 *                                      /trips/{id}        Trip detail
 */
export type Route =
  | { name: 'landing' }
  | { name: 'signup' }
  | { name: 'login' }
  | { name: 'dashboard' }
  | { name: 'map'; tripId: string | null }
  | { name: 'trip'; tripId: string }
  | { name: 'not-found' }

/** Pages only the signed-in owner may see. */
export function isOwnerRoute(route: Route): boolean {
  return route.name === 'dashboard' || route.name === 'map' || route.name === 'trip'
}

export function parseRoute(pathname: string, search: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'landing' }
  if (path === '/signup') return { name: 'signup' }
  if (path === '/login') return { name: 'login' }
  if (path === '/dashboard') return { name: 'dashboard' }
  if (path === '/map') return { name: 'map', tripId: new URLSearchParams(search).get('trip') || null }
  const trip = /^\/trips\/([^/]+)$/.exec(path)
  if (trip) {
    try {
      return { name: 'trip', tripId: decodeURIComponent(trip[1]) }
    } catch {
      return { name: 'not-found' }
    }
  }
  return { name: 'not-found' }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'landing':
    case 'not-found':
      return '/'
    case 'signup':
      return '/signup'
    case 'login':
      return '/login'
    case 'dashboard':
      return '/dashboard'
    case 'map':
      return route.tripId ? `/map?trip=${encodeURIComponent(route.tripId)}` : '/map'
    case 'trip':
      return `/trips/${encodeURIComponent(route.tripId)}`
  }
}

/** The browser tab title for each page. */
export function routeTitle(route: Route): string {
  switch (route.name) {
    case 'signup':
      return 'Sign up · MapMory'
    case 'login':
      return 'Log in · MapMory'
    case 'dashboard':
      return 'Dashboard · MapMory'
    case 'map':
      return 'Map · MapMory'
    case 'trip':
      return 'Trip · MapMory'
    case 'not-found':
      return 'Page not found · MapMory'
    default:
      return 'MapMory'
  }
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

/** The location as one string, so useSyncExternalStore sees a stable snapshot. */
function snapshot() {
  return window.location.pathname + window.location.search
}

/** Opens a page. `replace` swaps the current history entry, e.g. for redirects. */
export function navigate(route: Route, { replace = false } = {}) {
  const href = routeHref(route)
  if (href === snapshot()) return
  if (replace) window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
  listeners.forEach((listener) => listener())
}

/** The current route; re-renders on navigate() and on Back/Forward. Stable until the address changes. */
export function useRoute(): Route {
  const location = useSyncExternalStore(subscribe, snapshot)
  return useMemo(() => {
    const query = location.indexOf('?')
    return query === -1 ? parseRoute(location, '') : parseRoute(location.slice(0, query), location.slice(query))
  }, [location])
}
