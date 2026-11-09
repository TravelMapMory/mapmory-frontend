import { latLngBounds, type Map as LeafletMap } from 'leaflet'
import { MapContainer, TileLayer, useMapEvents, ZoomControl } from 'react-leaflet'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MapPinOff, X } from 'lucide-react'
import { getPublicMap } from './api/client'
import { ApiError } from './api/http'
import { PUBLIC_CLUSTER_LIMIT } from './api/limits'
import type { PublicCluster, PublicMapPage, PublicMapQuery } from './api/types'
import MapModeSwitch from './components/MapModeSwitch'
import PlaceSearch from './components/PlaceSearch'
import PublicClusters from './components/PublicClusters'
import VisibilityBadge from './components/VisibilityBadge'
import { plural } from './format'
import { TILES } from './mapTiles'
import placeholder from './assets/photo-placeholder.svg'
import './MapScreen.css'
import './PublicMapScreen.css'

/** Europe, like the owner's map, until the visitor moves somewhere else. */
const START_VIEW = { lat: 50.5, lng: 10, zoom: 4 }
/** Pans and zooms in quick succession ask the server once, for where the map stopped. */
const MOVE_DEBOUNCE_MS = 200
/** Public positions are city-level (doc 5.4), so zooming deeper never splits a cluster further. */
const MAX_FIT_ZOOM = 13

/*
 * Where the map was, per tab, so Back from a public share returns to the
 * same area instead of to Europe. Storage can be blocked; the map then
 * simply starts over.
 */
const VIEW_KEY = 'mapmory.publicMapView'

function readView(): typeof START_VIEW {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null') as typeof START_VIEW | null
    if (saved && [saved.lat, saved.lng, saved.zoom].every(Number.isFinite)) return saved
  } catch {
    // Fall through to the default view.
  }
  return START_VIEW
}

function saveView(map: LeafletMap) {
  try {
    const { lat, lng } = map.getCenter()
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({ lat, lng, zoom: map.getZoom() }))
  } catch {
    // Not essential: see readView.
  }
}

function queryFor(map: LeafletMap): PublicMapQuery {
  const b = map.getBounds()
  return { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() }
}

function sameQuery(a: PublicMapQuery | null, b: PublicMapQuery): boolean {
  return a !== null && a.zoom === b.zoom && a.bbox.every((v, i) => Math.abs(v - b.bbox[i]) < 1e-9)
}

function ViewportWatcher({ onMoveEnd }: { onMoveEnd: (map: LeafletMap) => void }) {
  const map = useMapEvents({ moveend: () => onMoveEnd(map) })
  return null
}

type Load = { status: 'loading' } | { status: 'ready' } | { status: 'error' } | { status: 'unavailable' }

export interface PublicMapScreenProps {
  /** Opens a public share's own page. */
  onOpenShare: (shareId: string) => void
  /** Switches a signed-in owner to Map · My photos; signed-out visitors have no such mode. */
  onMyPhotos?: () => void
}

/**
 * Map · Public (doc 3.2, use case 5): photos from public shares, for anyone,
 * signed in or not. The map only ever holds the visible area: each pan or
 * zoom asks `GET /api/public/map` for that area, and the server answers with
 * at most 200 grid clusters at city-level positions. "Find a place" moves the
 * map; there is no filter over anyone's collection (doc 4).
 */
export default function PublicMapScreen({ onOpenShare, onMyPhotos }: PublicMapScreenProps) {
  const [initial] = useState(readView)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [query, setQuery] = useState<PublicMapQuery | null>(null)
  const [page, setPage] = useState<PublicMapPage>({ clusters: [], truncated: false })
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<PublicCluster | null>(null)
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  // The first request waits for the map, which knows the visible area.
  useEffect(() => {
    if (map) setQuery(queryFor(map))
  }, [map])

  const onMoveEnd = useCallback((m: LeafletMap) => {
    saveView(m)
    clearTimeout(moveTimer.current)
    moveTimer.current = setTimeout(() => {
      const next = queryFor(m)
      setQuery((prev) => (sameQuery(prev, next) ? prev : next))
    }, MOVE_DEBOUNCE_MS)
  }, [])
  useEffect(() => () => clearTimeout(moveTimer.current), [])

  // The previous clusters stay on the map while the next area loads, so pins do not blink.
  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    getPublicMap(query, controller.signal)
      .then((next) => {
        setPage(next)
        setLoad({ status: 'ready' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.code === 'not_implemented') setLoad({ status: 'unavailable' })
        else setLoad({ status: 'error' })
      })
    return () => controller.abort()
  }, [query, retry])

  useEffect(() => {
    if (selected) headingRef.current?.focus()
  }, [selected])

  // A cluster that spans several places zooms in to split it; one that cannot split opens its shares.
  const activate = useCallback(
    (cluster: PublicCluster) => {
      if (!map) return
      const [west, south, east, north] = cluster.bounds
      if (west <= east && (east > west || north > south)) {
        const bounds = latLngBounds([
          [south, west],
          [north, east],
        ])
        const target = Math.min(map.getBoundsZoom(bounds.pad(0.2)), MAX_FIT_ZOOM)
        if (target > map.getZoom()) {
          setSelected(null)
          map.flyToBounds(bounds, { padding: [80, 80], maxZoom: MAX_FIT_ZOOM, duration: 0.6 })
          return
        }
      }
      setSelected(cluster)
    },
    [map],
  )

  const total = useMemo(() => page.clusters.reduce((sum, c) => sum + c.count, 0), [page])
  const headingId = `${ids}-selected`

  return (
    <div className="mapscreen pmap">
      <div className="mapscreen-map">
        <MapContainer
          ref={setMap}
          className={TILES.desaturate ? 'mapscreen-canvas mapscreen-canvas--grey' : 'mapscreen-canvas'}
          center={[initial.lat, initial.lng]}
          zoom={initial.zoom}
          minZoom={2}
          zoomControl={false}
          worldCopyJump
          zoomAnimation={false}
        >
          <TileLayer url={TILES.url} attribution={TILES.attribution} />
          <ZoomControl position="bottomright" />
          <PublicClusters clusters={page.clusters} onActivate={activate} />
          <ViewportWatcher onMoveEnd={onMoveEnd} />
        </MapContainer>

        <div className="mapscreen-find">
          <PlaceSearch
            label="Find a place"
            placeholder="Find a place"
            onSelect={(place) => map?.flyTo([place.lat, place.lng], place.zoom, { duration: 0.8 })}
          />
        </div>

        {load.status === 'loading' ? (
          <p className="mapscreen-toast" role="status">
            Loading public photos…
          </p>
        ) : null}
        {load.status === 'error' ? (
          <div className="mapscreen-toast" role="alert">
            Public photos could not be loaded.
            <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}
      </div>

      <aside
        className="mapscreen-panel"
        aria-label="Public photos"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && selected) setSelected(null)
        }}
      >
        {onMyPhotos ? <MapModeSwitch mode="public" onChange={onMyPhotos} /> : null}

        <div className="mp-head">
          <h1 className="mp-title">Public map</h1>
          <p className="mp-caption">
            Photos people have chosen to share publicly. Each one is placed by its city, never at the exact spot.
          </p>
        </div>

        {load.status === 'ready' ? (
          <p className="mp-count" role="status">
            {plural(total, 'public photo')} in this area
          </p>
        ) : null}

        {load.status === 'ready' && page.truncated ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <p>
              Showing the {PUBLIC_CLUSTER_LIMIT} largest groups of photos in this area. Zoom in or find a place to see the
              rest.
            </p>
          </div>
        ) : null}

        {load.status === 'ready' && page.clusters.length === 0 ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <p>No public photos in this area yet. Zoom out or find another place.</p>
          </div>
        ) : null}

        {load.status === 'unavailable' ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <p>The public map is not available yet.</p>
          </div>
        ) : null}

        {selected ? (
          <section className="pmap-selected" aria-labelledby={headingId}>
            <div className="mp-selected-head">
              <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mp-h2">
                {selected.label ?? 'Unnamed place'}
              </h2>
              <button type="button" className="mp-icon-btn" aria-label="Close" onClick={() => setSelected(null)}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="mp-caption">
              {plural(selected.count, 'public photo')} from {plural(selected.share_count, 'share')}
            </p>
            <ul className="pmap-shares">
              {selected.shares.map((share) => (
                <li key={share.id}>
                  <button type="button" className="pmap-share" onClick={() => onOpenShare(share.id)}>
                    <img className="pmap-share-cover" src={share.cover_url ?? placeholder} alt="" />
                    <span className="pmap-share-text">
                      <span className="pmap-share-title">{share.title}</span>
                      <span className="pmap-share-meta">{plural(share.photo_count, 'photo')} here</span>
                    </span>
                    <VisibilityBadge visibility="public" />
                  </button>
                </li>
              ))}
            </ul>
            {selected.share_count > selected.shares.length ? (
              <p className="mp-hint">
                {plural(selected.share_count - selected.shares.length, 'more share')} here. Zoom in to see them.
              </p>
            ) : null}
          </section>
        ) : page.clusters.length > 0 ? (
          <p className="mp-hint">Select a pin to see the shares in that place. Groups covering several places zoom in.</p>
        ) : null}
      </aside>
    </div>
  )
}
