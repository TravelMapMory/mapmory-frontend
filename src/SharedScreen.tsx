import { divIcon, latLngBounds, type LeafletKeyboardEvent, type Map as LeafletMap } from 'leaflet'
import { MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Flag, ImageOff, Link2Off } from 'lucide-react'
import { getPublicShare, getSharedCollection, reportShare } from './api/client'
import { ApiError } from './api/http'
import type { SharedCollection } from './api/types'
import { mapPinHtml } from './components/mapPinHtml'
import VisibilityBadge from './components/VisibilityBadge'
import { formatCaptured, plural } from './format'
import { ANIMATE_ZOOM, BASEMAPS, useBasemap } from './mapTiles'
import MapLayers from './components/MapLayers'
import { sharedPins, type SharedPin } from './sharedPins'
import placeholder from './assets/photo-placeholder.svg'
import './LandingScreen.css'
import './SharedScreen.css'
import BrandMark from './components/BrandMark'

const REPORT_MAX = 500

/**
 * Reporting a public share (doc 3.5): anyone viewing it can explain what is
 * wrong. The share then leaves the public map until the team reviews it.
 */
function ReportShare({ shareId }: { shareId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const ids = useId()
  const length = Array.from(reason.trim()).length

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (length === 0 || length > REPORT_MAX) return
    setState('sending')
    try {
      await reportShare(shareId, reason.trim())
      setState('sent')
    } catch {
      setState('failed')
    }
  }

  if (state === 'sent') {
    return (
      <p className="shared-report-done" role="status">
        Thank you. The MapMory team will review this share; it is hidden from the public map until then.
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" className="shared-report-open" onClick={() => setOpen(true)}>
        <Flag size={14} aria-hidden />
        Report this share
      </button>
    )
  }
  return (
    <form className="shared-report" onSubmit={(e) => void submit(e)} aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className="shared-h2">
        Report this share
      </h2>
      <label htmlFor={`${ids}-reason`}>What is wrong with it?</label>
      <textarea
        id={`${ids}-reason`}
        className="shared-report-input"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-describedby={`${ids}-count`}
        aria-invalid={length > REPORT_MAX}
        disabled={state === 'sending'}
      />
      <p id={`${ids}-count`} className="shared-caption">
        {length} / {REPORT_MAX}
      </p>
      {state === 'failed' ? (
        <p className="shared-report-error" role="alert">
          The report could not be sent. Try again.
        </p>
      ) : null}
      <div className="shared-report-actions">
        <button type="submit" className="btn btn-primary" disabled={state === 'sending' || length === 0 || length > REPORT_MAX}>
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={state === 'sending'}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** A link share opens by its secret token; a public share by its id, from the public map. */
export type ShareSource = { kind: 'link'; token: string } | { kind: 'public'; shareId: string }

export interface SharedScreenProps {
  source: ShareSource
  /** Returns to the public map; shown for public shares opened from it. */
  onBackToMap?: () => void
  /** The MapMory home: the Dashboard for a signed-in owner, else the landing page. */
  onHome: () => void
}

type Load =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'revoked' }
  | { status: 'error' }
  | { status: 'ready'; collection: SharedCollection }

/** What a request that has not settled yet looks like; one shared object keeps `load` stable between renders. */
const LOADING: Load = { status: 'loading' }

/** A fetch's identity: the same object means the same request, so a new one is loading until it settles. */
interface ShareRequest {
  isPublic: boolean
  id: string
  retry: number
}

function CityMarker({ pin, onSelect }: { pin: SharedPin; onSelect: (key: string) => void }) {
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

/** The shared photos as city pins over the viewer's chosen basemap; fits the view to the pins once the map exists. */
function SharedMap({ pins, onSelect }: { pins: SharedPin[]; onSelect: (key: string) => void }) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [basemap, setBasemap] = useBasemap()
  const tiles = BASEMAPS[basemap]

  useEffect(() => {
    if (!map || pins.length === 0) return
    map.fitBounds(latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [64, 64], maxZoom: 10, animate: ANIMATE_ZOOM })
  }, [map, pins])

  return (
    <div className="shared-map-frame">
      <MapContainer
        ref={setMap}
        className="shared-map"
        center={[50.5, 10]}
        zoom={4}
        zoomControl={false}
        zoomAnimation={ANIMATE_ZOOM}
      >
        <TileLayer
            key={basemap}
            className={tiles.desaturate ? 'basemap-grey' : undefined}
            url={tiles.url}
            attribution={tiles.attribution}
            maxNativeZoom={tiles.maxNativeZoom}
            maxZoom={19}
          />
        <ZoomControl position="bottomright" />
        {pins.map((pin) => (
          <CityMarker key={pin.key} pin={pin} onSelect={onSelect} />
        ))}
      </MapContainer>
      <MapLayers value={basemap} onChange={setBasemap} />
    </div>
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
 * signing in. It shows only the photos the owner chose, placed at coarse locations, and
 * nothing that would lead back to the rest of the trip or the owner's account.
 */
export default function SharedScreen({ source, onHome, onBackToMap }: SharedScreenProps) {
  const isPublic = source.kind === 'public'
  // Plain strings stand in for `source`, whose object identity changes on every render.
  const id = source.kind === 'public' ? source.shareId : source.token
  const [settled, setSettled] = useState<{ request: ShareRequest; load: Load } | null>(null)
  const [retry, setRetry] = useState(0)
  const [city, setCity] = useState<string | null>(null)

  const request = useMemo<ShareRequest>(() => ({ isPublic, id, retry }), [isPublic, id, retry])
  const load = settled?.request === request ? settled.load : LOADING

  useEffect(() => {
    const controller = new AbortController()
    const loading = request.isPublic ? getPublicShare(request.id, controller.signal) : getSharedCollection(request.id, controller.signal)
    loading
      .then((collection) => setSettled({ request, load: { status: 'ready', collection } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 404) setSettled({ request, load: { status: 'not-found' } })
        else if (error instanceof ApiError && error.status === 410) setSettled({ request, load: { status: 'revoked' } })
        else setSettled({ request, load: { status: 'error' } })
      })
    return () => controller.abort()
  }, [request])

  const pins = useMemo(() => (load.status === 'ready' ? sharedPins(load.collection.photos) : []), [load])

  let body
  if (load.status === 'loading') {
    body = (
      <p className="shared-text" role="status">
        Loading shared photos…
      </p>
    )
  } else if (load.status === 'not-found' && isPublic) {
    body = (
      <Unavailable
        title="This share isn't public"
        text="This collection is not publicly available. The owner may have revoked it, or the link may be incorrect."
        onHome={onHome}
      />
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
    const cities = [...new Set(pins.map((p) => p.city).filter((name) => name !== 'Approximate location'))]
    const selected = pins.find((p) => p.key === city) ?? null
    const shown = selected ? selected.photos : collection.photos
    body = (
      <>
        <div className="shared-head">
          {isPublic ? (
            <p className="shared-eyebrow shared-eyebrow--public">
              <VisibilityBadge visibility="public" />
              <span>Shared publicly</span>
            </p>
          ) : (
            <p className="shared-eyebrow">Shared with you</p>
          )}
          <h1 className="shared-title">{collection.title}</h1>
          {collection.description ? <p className="shared-text">{collection.description}</p> : null}
          <p className="shared-meta">
            {[plural(collection.photos.length, 'photo'), cities.length > 0 ? cities.join(' · ') : null].filter(Boolean).join('  ·  ')}
          </p>
        </div>

        {pins.length > 0 ? (
          <section className="shared-map-wrap" aria-label="Map of the shared photos">
            <SharedMap pins={pins} onSelect={setCity} />
            <p className="shared-caption">Photos are shown at approximate shared locations, not exact positions.</p>
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

        {source.kind === 'public' ? <ReportShare shareId={source.shareId} /> : null}
      </>
    )
  }

  return (
    <div className="land shared">
      <header className="land-hdr">
        <div className="land-brand">
          <BrandMark />
          <strong className="land-name">MapMory</strong>
        </div>
        {onBackToMap ? (
          <button type="button" className="btn btn-secondary" onClick={onBackToMap}>
            <ArrowLeft size={16} aria-hidden />
            Public map
          </button>
        ) : null}
      </header>
      <main id="main" tabIndex={-1} className="shared-body">{body}</main>
    </div>
  )
}
