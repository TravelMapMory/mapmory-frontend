import { divIcon, latLngBounds, type LeafletKeyboardEvent, type Map as LeafletMap } from 'leaflet'
import { MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet'
import { useEffect, useMemo, useState } from 'react'
import { ImageOff, Link2Off, MapPin } from 'lucide-react'
import { getSharedCollection } from './api/client'
import { ApiError } from './api/http'
import type { SharedCollection, SharedPhoto } from './api/types'
import { mapPinHtml } from './components/mapPinHtml'
import { formatCaptured, plural } from './format'
import { TILES } from './mapTiles'
import placeholder from './assets/photo-placeholder.svg'
import './LandingScreen.css'
import './SharedScreen.css'

export interface SharedScreenProps {
  token: string
  /** The MapMory home: the Dashboard for a signed-in owner, else the landing page. */
  onHome: () => void
}

type Load =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'revoked' }
  | { status: 'error' }
  | { status: 'ready'; collection: SharedCollection }

/** One pin per city: shared views only ever know the city, never the exact spot (doc 3.3). */
interface CityPin {
  key: string
  city: string
  lat: number
  lng: number
  photos: SharedPhoto[]
}

function cityPins(photos: SharedPhoto[]): CityPin[] {
  const pins = new Map<string, CityPin>()
  for (const photo of photos) {
    if (photo.display_lat === null || photo.display_lng === null || !photo.city) continue
    const key = `${photo.city}|${photo.country ?? ''}`
    const pin = pins.get(key) ?? { key, city: photo.city, lat: photo.display_lat, lng: photo.display_lng, photos: [] }
    pin.photos.push(photo)
    pins.set(key, pin)
  }
  return [...pins.values()]
}

function CityMarker({ pin, onSelect }: { pin: CityPin; onSelect: (key: string) => void }) {
  const count = pin.photos.length
  const label = `${plural(count, 'photo')} in ${pin.city}`
  const photo = pin.photos.find((p) => p.thumb_url)?.thumb_url ?? placeholder
  const icon = useMemo(
    () =>
      divIcon({
        className: 'map-pin-icon',
        html: mapPinHtml({ place: pin.city, photo, count, label }),
        iconSize: count > 1 ? [68, 98] : [69, 84],
        iconAnchor: count > 1 ? [34, 34] : [34.5, 28],
      }),
    [pin.city, photo, count, label],
  )
  const eventHandlers = useMemo(
    () => ({
      click: () => onSelect(pin.key),
      keydown: (event: LeafletKeyboardEvent) => {
        const key = event.originalEvent.key
        if (key !== 'Enter' && key !== ' ') return
        event.originalEvent.preventDefault()
        onSelect(pin.key)
      },
    }),
    [pin.key, onSelect],
  )
  return <Marker position={[pin.lat, pin.lng]} icon={icon} title={label} eventHandlers={eventHandlers} />
}

function SharedMap({ pins, onSelect }: { pins: CityPin[]; onSelect: (key: string) => void }) {
  const [map, setMap] = useState<LeafletMap | null>(null)

  useEffect(() => {
    if (!map || pins.length === 0) return
    map.fitBounds(latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [64, 64], maxZoom: 10 })
  }, [map, pins])

  return (
    <MapContainer
      ref={setMap}
      className={TILES.desaturate ? 'shared-map shared-map--grey' : 'shared-map'}
      center={[50.5, 10]}
      zoom={4}
      zoomControl={false}
      zoomAnimation={false}
    >
      <TileLayer url={TILES.url} attribution={TILES.attribution} />
      <ZoomControl position="bottomright" />
      {pins.map((pin) => (
        <CityMarker key={pin.key} pin={pin} onSelect={onSelect} />
      ))}
    </MapContainer>
  )
}

/** Shown instead of the photos when the link cannot open them. */
function Unavailable({ title, text, onHome }: { title: string; text: string; onHome: () => void }) {
  return (
    <div className="shared-unavailable">
      <span className="shared-unavailable-icon">
        <Link2Off size={28} aria-hidden />
      </span>
      <h1 className="shared-title">{title}</h1>
      <p className="shared-text">{text}</p>
      <button type="button" className="btn btn-secondary" onClick={onHome}>
        Go to MapMory
      </button>
    </div>
  )
}

/**
 * Recipient view (doc 3.2): what anyone with a share link sees, without
 * signing in. It shows only the photos the owner chose, placed by city, and
 * nothing that would lead back to the rest of the trip or the owner's account.
 */
export default function SharedScreen({ token, onHome }: SharedScreenProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const [city, setCity] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoad({ status: 'loading' })
    getSharedCollection(token, controller.signal)
      .then((collection) => setLoad({ status: 'ready', collection }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 404) setLoad({ status: 'not-found' })
        else if (error instanceof ApiError && error.status === 410) setLoad({ status: 'revoked' })
        else setLoad({ status: 'error' })
      })
    return () => controller.abort()
  }, [token, retry])

  const pins = useMemo(() => (load.status === 'ready' ? cityPins(load.collection.photos) : []), [load])

  let body
  if (load.status === 'loading') {
    body = (
      <p className="shared-text" role="status">
        Loading shared photos…
      </p>
    )
  } else if (load.status === 'not-found') {
    body = (
      <Unavailable
        title="This link doesn't work"
        text="Check that you copied the whole link, or ask the person who shared it to send it again."
        onHome={onHome}
      />
    )
  } else if (load.status === 'revoked') {
    body = (
      <Unavailable
        title="This link has been turned off"
        text="The person who shared these photos no longer shares them through this link."
        onHome={onHome}
      />
    )
  } else if (load.status === 'error') {
    body = (
      <div className="shared-unavailable" role="alert">
        <p className="shared-text">The shared photos could not be loaded.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  } else {
    const { collection } = load
    const cities = pins.map((p) => p.city)
    const selected = pins.find((p) => p.key === city) ?? null
    const shown = selected ? selected.photos : collection.photos
    body = (
      <>
        <div className="shared-head">
          <p className="shared-eyebrow">Shared with you</p>
          <h1 className="shared-title">{collection.title}</h1>
          {collection.description ? <p className="shared-text">{collection.description}</p> : null}
          <p className="shared-meta">
            {[plural(collection.photos.length, 'photo'), cities.length > 0 ? cities.join(' · ') : null].filter(Boolean).join('  ·  ')}
          </p>
        </div>

        {pins.length > 0 ? (
          <section className="shared-map-wrap" aria-label="Map of the shared photos">
            <SharedMap pins={pins} onSelect={setCity} />
            <p className="shared-caption">Photos are placed by city only.</p>
          </section>
        ) : null}

        <section className="shared-photos" aria-labelledby="shared-photos-title">
          <div className="shared-photos-head">
            <h2 id="shared-photos-title" className="shared-h2">
              {selected ? `Photos in ${selected.city}` : 'Photos'}
            </h2>
            {selected ? (
              <button type="button" className="btn btn-secondary" onClick={() => setCity(null)}>
                Show all {plural(collection.photos.length, 'photo')}
              </button>
            ) : null}
          </div>
          {shown.length === 0 ? (
            <p className="shared-text">There are no photos in this link.</p>
          ) : (
            <ul className="shared-gallery">
              {shown.map((photo) => {
                const place = [photo.city, photo.country].filter(Boolean).join(', ')
                return (
                  <li key={photo.id} className="shared-tile">
                    {photo.display_url ? (
                      <img src={photo.display_url} alt={place ? `Photo in ${place}` : 'Shared photo'} loading="lazy" />
                    ) : (
                      <div className="shared-tile-empty">
                        <ImageOff size={22} aria-hidden />
                      </div>
                    )}
                    <div className="shared-tile-body">
                      <p className="shared-tile-place">{place || 'Place not shared'}</p>
                      <p className="shared-caption">{formatCaptured(photo.capture_time_local) ?? 'Date unknown'}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </>
    )
  }

  return (
    <div className="land shared">
      <header className="land-hdr">
        <div className="land-brand">
          <span className="land-logo">
            <MapPin size={18} strokeWidth={2.6667} aria-hidden />
          </span>
          <strong className="land-name">MapMory</strong>
        </div>
      </header>
      <main className="shared-body">{body}</main>
    </div>
  )
}
