import { latLngBounds, type Map as LeafletMap } from 'leaflet'
import { MapContainer, TileLayer, useMapEvents, ZoomControl } from 'react-leaflet'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MapPinOff } from 'lucide-react'
import { getMapPhotos, listTrips } from './api/client'
import type { BBox, MapPhoto, MapPhotoQuery, TripSummary } from './api/types'
import PhotoClusters from './components/PhotoClusters'
import PlaceTrips from './components/PlaceTrips'
import PlaceSearch from './components/PlaceSearch'
import { TILES } from './mapTiles'
import { plural } from './format'
import { placeKey } from './placeKey'
import './MapScreen.css'

/** Europe, where the sample trips are, until the owner's photos give a better frame. */
const START_CENTRE: [number, number] = [50.5, 10]
const START_ZOOM = 4

interface Filters {
  tripId: string
  from: string
  to: string
  q: string
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready' }

function toBBox(map: LeafletMap): BBox {
  const b = map.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
}

/** Reports pans and zooms so a truncated result can be refetched for the new viewport. */
function ViewportWatcher({ onMoveEnd }: { onMoveEnd: (map: LeafletMap) => void }) {
  const map = useMapEvents({ moveend: () => onMoveEnd(map) })
  return null
}

export interface MapScreenProps {
  /** Trip chosen with "Show on map" on the Dashboard or trip page, or null for all photos. */
  tripId?: string | null
  onOpenTrip?: (tripId: string) => void
}

/**
 * Map · My photos (doc 3.2): the owner's located photos as clustered pins,
 * filtered by trip, capture date and "Filter my photos"; "Find a place" moves
 * the map to any place in the world. A pin opens its photos in the side panel,
 * which sits below the map on narrow screens.
 *
 * Data comes from `GET /api/map/photos` (at most 2,000 markers). A filter
 * change fetches without a bounding box and frames the result; only when the
 * server reports the result as truncated does panning refetch per viewport.
 */
export default function MapScreen({ tripId = null, onOpenTrip }: MapScreenProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [filters, setFilters] = useState<Filters>({ tripId: tripId ?? '', from: '', to: '', q: '' })
  const [textFilter, setTextFilter] = useState('')
  const [bbox, setBBox] = useState<BBox | null>(null)
  const [photos, setPhotos] = useState<MapPhoto[]>([])
  const [truncated, setTruncated] = useState(false)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<MapPhoto[] | null>(null)
  const fitPending = useRef(true)
  const ids = useId()

  useEffect(() => {
    const controller = new AbortController()
    listTrips(controller.signal)
      .then((page) => setTrips(page.items))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  // "Filter my photos" waits for a pause in typing before it queries.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.q === textFilter.trim() ? f : { ...f, q: textFilter.trim() }))
    }, 250)
    return () => clearTimeout(timer)
  }, [textFilter])

  const query = useMemo<MapPhotoQuery>(
    () => ({
      trip_id: filters.tripId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      q: filters.q || undefined,
    }),
    [filters],
  )

  // A new filter starts over: no viewport restriction, and frame the result.
  useEffect(() => {
    fitPending.current = true
    setBBox(null)
    setSelected(null)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    getMapPhotos({ ...query, bbox: bbox ?? undefined }, controller.signal)
      .then((page) => {
        setPhotos(page.items)
        setTruncated(page.truncated)
        setLoad({ status: 'ready' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'error' })
      })
    return () => controller.abort()
  }, [query, bbox, retry])

  useEffect(() => {
    if (!map || load.status !== 'ready' || !fitPending.current) return
    fitPending.current = false
    if (photos.length === 0) return
    const bounds = latLngBounds(photos.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [64, 64], maxZoom: 12 })
  }, [map, photos, load.status])

  const onMoveEnd = useCallback(
    (m: LeafletMap) => {
      if (truncated) setBBox(toBBox(m))
    },
    [truncated],
  )

  // A pin opens every loaded photo in its country/city pairs, so the panel can page
  // through the place and through other trips taken there.
  const placePhotos = useMemo(() => {
    if (!selected) return null
    const places = new Set(selected.map(placeKey).filter((key) => key !== null))
    const pinned = new Set(selected.map((p) => p.id))
    return photos.filter((p) => {
      const key = placeKey(p)
      return pinned.has(p.id) || (key !== null && places.has(key))
    })
  }, [selected, photos])
  const pinnedIds = useMemo(() => selected?.map((p) => p.id) ?? [], [selected])

  const trip = trips.find((t) => t.id === filters.tripId) ?? null
  const unlocatedInTrip = trip ? trip.photo_count - trip.located_count : 0
  const filtered = Boolean(filters.from || filters.to || filters.q)

  function update(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }))
  }

  function clearFilters() {
    setTextFilter('')
    setFilters({ tripId: '', from: '', to: '', q: '' })
  }

  return (
    <div className="mapscreen">
      <div className="mapscreen-map">
        <MapContainer
          ref={setMap}
          className={TILES.desaturate ? 'mapscreen-canvas mapscreen-canvas--grey' : 'mapscreen-canvas'}
          center={START_CENTRE}
          zoom={START_ZOOM}
          zoomControl={false}
          worldCopyJump
          zoomAnimation={false}
        >
          <TileLayer url={TILES.url} attribution={TILES.attribution} />
          <ZoomControl position="bottomright" />
          <PhotoClusters photos={photos} onSelect={setSelected} />
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
            Loading photos…
          </p>
        ) : null}
        {load.status === 'error' ? (
          <div className="mapscreen-toast" role="alert">
            Photos could not be loaded.
            <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}
      </div>

      <aside
        className="mapscreen-panel"
        aria-label="My photos"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && selected) setSelected(null)
        }}
      >
        <div className="mp-head">
          <h1 className="mp-title">My photos</h1>
          <p className="mp-caption">Only photos with a location appear on the map.</p>
        </div>

        <div className="mp-filters" role="group" aria-label="Filters">
          <div className="mp-field">
            <label htmlFor={`${ids}-trip`}>Trip</label>
            <select id={`${ids}-trip`} value={filters.tripId} onChange={(e) => update({ tripId: e.target.value })}>
              <option value="">All trips</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mp-field">
            <label htmlFor={`${ids}-q`}>Filter my photos</label>
            <input
              id={`${ids}-q`}
              type="search"
              placeholder="Place, country or trip"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
          </div>
          <div className="mp-dates">
            <div className="mp-field">
              <label htmlFor={`${ids}-from`}>From</label>
              <input
                id={`${ids}-from`}
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => update({ from: e.target.value })}
              />
            </div>
            <div className="mp-field">
              <label htmlFor={`${ids}-to`}>To</label>
              <input
                id={`${ids}-to`}
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => update({ to: e.target.value })}
              />
            </div>
          </div>
          {filters.tripId || filtered ? (
            <button type="button" className="btn btn-secondary mp-clear" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {load.status === 'ready' ? (
          <p className="mp-count" role="status">
            {plural(photos.length, 'photo')} on the map
            {truncated ? ' (zoom in to see all)' : ''}
          </p>
        ) : null}

        {trip && trip.located_count === 0 ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <div>
              <p>
                <strong>{trip.title}</strong> has no photos with a location yet
                {trip.photo_count > 0 ? `, so its ${plural(trip.photo_count, 'photo')} cannot be pinned.` : '.'}
              </p>
              {trip.photo_count > 0 && onOpenTrip ? (
                <button type="button" className="btn btn-primary" onClick={() => onOpenTrip(trip.id)}>
                  Correct locations
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {trip && trip.located_count > 0 && unlocatedInTrip > 0 ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <div>
              <p>
                {plural(unlocatedInTrip, 'photo')} in this trip without a location {unlocatedInTrip === 1 ? 'is' : 'are'} not
                shown.
              </p>
              {onOpenTrip ? (
                <button type="button" className="btn btn-secondary" onClick={() => onOpenTrip(trip.id)}>
                  Correct locations
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {load.status === 'ready' && photos.length === 0 && (!trip || (filtered && trip.located_count > 0)) ? (
          <div className="mp-notice" role="note">
            <MapPinOff size={18} aria-hidden />
            <div>
              <p>{filtered ? 'No photos match these filters.' : 'No located photos yet. Upload photos to a trip and they appear here.'}</p>
              {filtered ? (
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {selected ? (
          <PlaceTrips
            photos={placePhotos ?? selected}
            pinnedIds={pinnedIds}
            onClose={() => setSelected(null)}
            onOpenTrip={onOpenTrip}
          />
        ) : photos.length > 0 ? (
          <p className="mp-hint">Select a pin to see its photos. Clusters zoom in when selected.</p>
        ) : null}
      </aside>
    </div>
  )
}
