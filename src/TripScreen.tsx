import { ApiError } from './api/http'
import { NotFoundError } from './api/mock'
import NotFoundScreen from './NotFoundScreen'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, ZoomControl } from 'react-leaflet'
import { divIcon, latLngBounds, type DivIcon, type Map as LeafletMap } from 'leaflet'
import {
  ArrowLeft,
  CircleAlert,
  CircleHelp,
  ImageOff,
  LayoutGrid,
  List,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Pencil,
  Share2,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { deleteTrip, getTrip, hasUnfinishedUploads, listTripPhotos, patchPhotoLocation, sharingAvailable } from './api/client'
import { loadPages, mergePage, type FetchPage } from './api/paging'
import LoadMore from './components/LoadMore'
import { useLoadMore } from './useLoadMore'
import type { LocationPatch, Photo, TripDetail } from './api/types'
import LocationPicker, { type LatLng } from './components/LocationPicker'
import PhotoViewer, { viewerImage } from './components/PhotoViewer'
import TripDetailsForm from './components/TripDetailsForm'
import ShareSettings from './components/ShareSettings'
import UploadPanel from './components/UploadPanel'
import VisibilityBadge from './components/VisibilityBadge'
import { formatCaptured, formatDateRange, plural, zoneNote } from './format'
import { captureDay, captureTime, sortByCapture } from './photoOrder'
import { photoLocationLabel, photoPlaceName } from './photoLocation'
import MapLayers from './components/MapLayers'
import { ANIMATE_ZOOM, BASEMAPS, useBasemap } from './mapTiles'
import './TripScreen.css'

export interface TripScreenProps {
  tripId: string
  /** Photos chosen on the Dashboard for this trip; their upload starts on arrival. */
  initialFiles?: File[]
  onBack: () => void
  onShowOnMap: (tripId: string) => void
  /** Called with the trip's title after it was deleted; the trip page no longer exists then. */
  onDeleted: (title: string) => void
  /** Called after the owner successfully reviews or sets one photo location. */
  onPlaceReviewed?: () => void
}

/**
 * Deleting a trip (doc 2.2 use case 6): a confirmation that says what goes,
 * and an error that keeps everything when the request fails.
 */
function DeleteTripConfirm({
  trip,
  onDeleted,
  onCancel,
}: {
  trip: TripDetail
  onDeleted: (title: string) => void
  onCancel: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)
  const keep = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // The safe choice gets focus first.
    keep.current?.focus()
  }, [])

  async function confirm() {
    setDeleting(true)
    setFailed(false)
    try {
      await deleteTrip(trip.id)
      onDeleted(trip.title)
    } catch {
      setFailed(true)
      setDeleting(false)
    }
  }

  return (
    <div
      className="trip-delete"
      role="group"
      aria-label="Delete this trip?"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !deleting) onCancel()
      }}
    >
      <p>
        Delete <strong>{trip.title}</strong> and its {plural(trip.photo_count, 'photo')}? Its share links and public
        shares stop working at once. This cannot be undone.
      </p>
      {failed ? (
        <p className="trip-delete-error" role="alert">
          We could not confirm whether the trip was deleted. Refresh your trips before trying again.
        </p>
      ) : null}
      <div className="trip-delete-actions">
        <button type="button" className="btn btn-danger" onClick={() => void confirm()} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Yes, delete trip'}
        </button>
        <button ref={keep} type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          Keep trip
        </button>
      </div>
    </div>
  )
}

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; trip: TripDetail; photos: Photo[]; nextCursor: string | null }

type View = 'gallery' | 'journey'

interface Status {
  label: string
  icon: LucideIcon
  tone: 'warn' | 'error' | 'info'
}

/** Status is always an icon plus words, never colour alone (doc 4). */
function photoStatus(photo: Photo): Status | null {
  switch (photo.state) {
    case 'needs-location':
      return { label: 'Needs location', icon: MapPinOff, tone: 'warn' }
    case 'failed':
      return { label: 'Upload failed', icon: CircleAlert, tone: 'error' }
    case 'pending':
    case 'uploading':
    case 'processing':
      return { label: 'Processing', icon: LoaderCircle, tone: 'info' }
    case 'ready':
      return photo.label_status === 'suggested' ? { label: 'Place suggested', icon: CircleHelp, tone: 'info' } : null
  }
}

function StatusBadge({ status }: { status: Status }) {
  const Icon = status.icon
  return (
    <span className="trip-status" data-tone={status.tone}>
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {status.label}
    </span>
  )
}

function Thumb({ photo }: { photo: Photo }) {
  return photo.thumb_url ? (
    <img src={photo.thumb_url} alt={photoPlaceName(photo) ? `Photo at ${photoPlaceName(photo)}` : 'Photo without a location'} loading="lazy" />
  ) : (
    <div className="trip-thumb-empty">
      <ImageOff size={22} aria-hidden />
    </div>
  )
}

/** A thumbnail that opens the full-photo viewer, when the photo has an image to show. */
function ViewableThumb({ photo, onView }: { photo: Photo; onView: (photo: Photo) => void }) {
  if (!viewerImage(photo)) return <Thumb photo={photo} />
  return (
    <button
      type="button"
      className="trip-view"
      aria-label={`View photo${photoPlaceName(photo) ? ` at ${photoPlaceName(photo)}` : ''}`}
      onClick={() => onView(photo)}
    >
      <Thumb photo={photo} />
    </button>
  )
}

/** The owner's way to fix a photo: confirm a suggestion, or pick the place. */
function PhotoActions({ photo, onCorrect }: { photo: Photo; onCorrect: (photo: Photo) => void }) {
  if (photo.state === 'needs-location') {
    return (
      <button type="button" className="btn btn-primary trip-action" onClick={() => onCorrect(photo)}>
        <MapPin size={14} aria-hidden />
        Set location
      </button>
    )
  }
  if (photo.state !== 'ready') return null
  return (
    <button type="button" className="btn btn-secondary trip-action" onClick={() => onCorrect(photo)}>
      {photo.label_status === 'suggested' ? 'Review place' : 'Change location'}
    </button>
  )
}

function CorrectionPanel({
  photo,
  previous,
  onSave,
  onCancel,
}: {
  photo: Photo
  previous: (LatLng & { label: string }) | null
  onSave: (patch: LocationPatch) => Promise<void>
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [photo.id])

  async function save(patch: LocationPatch) {
    setSaving(true)
    setFailed(false)
    try {
      await onSave(patch)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  const suggested = photo.label_status === 'suggested' && photo.place_name
  const title = photo.state === 'needs-location' ? 'Set location' : suggested ? 'Review suggested place' : 'Change location'
  const located = photo.lat !== null && photo.lng !== null

  return (
    <section
      ref={ref}
      className="trip-correct"
      aria-labelledby="trip-correct-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <div className="trip-correct-thumb">
        <Thumb photo={photo} />
      </div>
      <div className="trip-correct-body">
        <h2 id="trip-correct-title" className="trip-h2">
          {title}
        </h2>
        <dl className="trip-facts">
          <dt>Taken</dt>
          <dd>
            {formatCaptured(photo.capture_time_local) ?? 'No capture time in the file'}
            {zoneNote(photo.capture_time_local, photo.capture_utc_offset)}
          </dd>
          <dt>GPS</dt>
          <dd>
            {located
              ? `${photo.lat?.toFixed(5)}, ${photo.lng?.toFixed(5)} (${photo.location_source === 'manual' ? 'set by you' : 'from the file'})`
              : 'None in the file'}
          </dd>
          <dt>Place</dt>
          <dd>
            {photo.place_name ?? (located ? 'No known place nearby' : 'Unknown')}
            {suggested ? ' (suggested, not yet confirmed)' : ''}
            {photo.place_name && photo.label_attribution ? (
              <small className="trip-place-attribution">
                {photo.label_attribution}
              </small>
            ) : null}
          </dd>
        </dl>
        {suggested ? (
          <button
            type="button"
            className="btn btn-primary trip-confirm"
            disabled={saving}
            onClick={() => void save({ confirm_label: true })}
          >
            Confirm {photo.place_name}
          </button>
        ) : null}
        <LocationPicker
          initial={located ? { lat: photo.lat as number, lng: photo.lng as number } : null}
          previous={previous}
          saving={saving}
          onSave={(position) => void save(position)}
        />
        {failed ? (
          <p className="trip-error" role="alert">
            The location could not be saved. Try again.
          </p>
        ) : null}
        <div>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}

/** The closest earlier photo in capture order that has a location, for "Same place as previous photo". */
function previousLocated(photos: Photo[], photo: Photo): (LatLng & { label: string }) | null {
  const index = photos.findIndex((p) => p.id === photo.id)
  for (let i = index - 1; i >= 0; i--) {
    const p = photos[i]
    if (p.lat !== null && p.lng !== null) return { lat: p.lat, lng: p.lng, label: p.place_name ?? 'previous photo' }
  }
  return null
}

interface PhotoListProps {
  photos: Photo[]
  onCorrect: (photo: Photo) => void
  onView: (photo: Photo) => void
}

function GalleryTiles({ photos, onCorrect, onView }: PhotoListProps) {
  return (
    <ul className="trip-gallery">
      {photos.map((photo) => {
        const status = photoStatus(photo)
        return (
          <li key={photo.id} className="trip-tile">
            <div className="trip-tile-img">
              <ViewableThumb photo={photo} onView={onView} />
              {status ? (
                <span className="trip-tile-badge">
                  <StatusBadge status={status} />
                </span>
              ) : null}
            </div>
            <div className="trip-tile-body">
              <p className="trip-tile-place">{photoLocationLabel(photo)}</p>
              <p className="trip-caption">
                {formatCaptured(photo.capture_time_local) ?? 'No capture time'}
                {zoneNote(photo.capture_time_local, photo.capture_utc_offset)}
              </p>
              <PhotoActions photo={photo} onCorrect={onCorrect} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Photos in capture order; undated ones (already last) get their own group when dated ones exist too. */
function Gallery({ photos, onCorrect, onView }: PhotoListProps) {
  const dated = photos.filter((p) => captureTime(p) !== null)
  const undated = photos.filter((p) => captureTime(p) === null)
  if (dated.length === 0 || undated.length === 0) return <GalleryTiles photos={photos} onCorrect={onCorrect} onView={onView} />
  return (
    <>
      <GalleryTiles photos={dated} onCorrect={onCorrect} onView={onView} />
      <h3 className="trip-day-title trip-undated-title">No capture date</h3>
      <GalleryTiles photos={undated} onCorrect={onCorrect} onView={onView} />
    </>
  )
}

const dayHeading = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** The trip's photos grouped by capture day, days in order and undated photos last. */
function journeyDays(photos: Photo[]): [string, Photo[]][] {
  const days = new Map<string, Photo[]>()
  for (const photo of photos) {
    const key = captureDay(photo) ?? 'undated'
    days.set(key, [...(days.get(key) ?? []), photo])
  }
  return [...days].sort(([a], [b]) => (a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)))
}

const tabWeekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })

/** One stop on the Journey map: a photo with a location, numbered in route order. */
interface Stop {
  photo: Photo
  n: number
  lat: number
  lng: number
}

const stopIcons = new Map<string, DivIcon>()

/** The numbered pin for a Journey stop: coral when selected, ringed when its row is hovered; cached per state. */
function stopIcon(n: number, selected: boolean, hovered: boolean): DivIcon {
  const key = `${n}:${selected}:${hovered}`
  let icon = stopIcons.get(key)
  if (!icon) {
    icon = divIcon({
      className: 'trip-pin-icon',
      html: `<span class="trip-pin"${selected ? ' data-selected="true"' : ''}${hovered ? ' data-hovered="true"' : ''}>${n}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    })
    stopIcons.set(key, icon)
  }
  return icon
}

/**
 * Journey (doc 3.2): the trip day by day in capture order, beside a map of the
 * route (direction C, after Google Maps Timeline and Wanderlog). A strip of day
 * tabs filters both the list and the map; each photo with a location is a
 * numbered stop matching its pin, and choosing either one highlights the other.
 */
function Journey({ photos, onCorrect, onView }: PhotoListProps) {
  const ordered = useMemo(() => journeyDays(photos), [photos])
  const [tab, setTab] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [basemap, setBasemap] = useBasemap()
  const tiles = BASEMAPS[basemap]
  const ids = useId()
  const rows = useRef(new Map<string, HTMLLIElement>())

  // Days count from the trip's first day, so a day without photos still advances the number.
  const first = ordered[0]?.[0]
  const dayNumber = (day: string) =>
    first && first !== 'undated' ? Math.round((Date.parse(day) - Date.parse(first)) / 86_400_000) + 1 : 1
  const dayTitle = (day: string) =>
    day === 'undated' ? 'No capture date' : `Day ${dayNumber(day)} · ${dayHeading.format(new Date(`${day}T00:00:00Z`))}`

  const tabs = ['all', ...ordered.map(([day]) => day)]
  const active = tabs.includes(tab) ? tab : 'all'
  const visible = useMemo(() => (active === 'all' ? ordered : ordered.filter(([day]) => day === active)), [ordered, active])
  const stops = useMemo(() => {
    const result: Stop[] = []
    for (const [, list] of visible) {
      for (const photo of list) {
        if (photo.lat !== null && photo.lng !== null) result.push({ photo, n: result.length + 1, lat: photo.lat, lng: photo.lng })
      }
    }
    return result
  }, [visible])
  const stopOf = new Map(stops.map((stop) => [stop.photo.id, stop]))
  const shown = visible.reduce((count, [, list]) => count + list.length, 0)

  // Frame the visible route whenever the day or its photos change.
  useEffect(() => {
    if (!map || stops.length === 0) return
    map.fitBounds(latLngBounds(stops.map((stop): [number, number] => [stop.lat, stop.lng])), { padding: [48, 48], maxZoom: 13, animate: ANIMATE_ZOOM })
  }, [map, stops])

  /** Opens a day (or all days) and clears the selection, which belonged to the previous view. */
  function openTab(next: string) {
    setTab(next)
    setSelected(null)
  }

  /** The tablist's arrow keys, Home and End move between days and open them (WAI-ARIA tabs). */
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.indexOf(active)
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length]
    openTab(next)
    document.getElementById(`${ids}-tab-${next}`)?.focus()
  }

  /** Selects a stop from the list and brings its pin into view. */
  function showStop(stop: Stop) {
    setSelected(stop.photo.id)
    map?.flyTo([stop.lat, stop.lng], Math.max(map.getZoom(), 12), { animate: ANIMATE_ZOOM, duration: 0.6 })
  }

  /** Selects a stop from its pin and scrolls its row into view. */
  function pickPin(stop: Stop) {
    setSelected(stop.photo.id)
    rows.current.get(stop.photo.id)?.scrollIntoView({ block: 'nearest', behavior: ANIMATE_ZOOM ? 'smooth' : 'auto' })
  }

  return (
    <div className="trip-journey">
      <div className="trip-journey-list">
        <div className="trip-days" role="tablist" aria-label="Trip days">
          {tabs.map((day) => (
            <button
              key={day}
              id={`${ids}-tab-${day}`}
              type="button"
              role="tab"
              className="trip-days-tab"
              aria-selected={day === active}
              aria-controls={`${ids}-panel`}
              aria-label={day === 'all' ? 'All days' : dayTitle(day)}
              tabIndex={day === active ? 0 : -1}
              onClick={() => openTab(day)}
              onKeyDown={onTabKey}
            >
              {day === 'all' ? (
                <>
                  <small>All</small>
                  <b>{ordered.filter(([d]) => d !== 'undated').length}</b>
                </>
              ) : day === 'undated' ? (
                <>
                  <small>No</small>
                  <b>date</b>
                </>
              ) : (
                <>
                  <small>{tabWeekday.format(new Date(`${day}T00:00:00Z`))}</small>
                  <b>{new Date(`${day}T00:00:00Z`).getUTCDate()}</b>
                </>
              )}
            </button>
          ))}
        </div>

        <div id={`${ids}-panel`} role="tabpanel" aria-labelledby={`${ids}-tab-${active}`} className="trip-journey-panel">
          <p className="trip-journey-summary">
            {stops.length} of {plural(shown, 'photo')} on the map
          </p>
          <ol className="trip-journey-days">
            {visible.map(([day, list]) => (
              <li key={day} className="trip-day" data-undated={day === 'undated' || undefined}>
                <h3 className="trip-day-title">{dayTitle(day)}</h3>
                <ul className="trip-rows">
                  {list.map((photo) => {
                    const status = photoStatus(photo)
                    const stop = stopOf.get(photo.id)
                    return (
                      <li
                        key={photo.id}
                        ref={(element) => {
                          if (element) rows.current.set(photo.id, element)
                          else rows.current.delete(photo.id)
                        }}
                        className="trip-row"
                        data-selected={selected === photo.id || undefined}
                        data-hovered={hovered === photo.id || undefined}
                        data-located={stop ? true : undefined}
                        onMouseEnter={() => setHovered(stop ? photo.id : null)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {stop ? (
                          <button
                            type="button"
                            className="trip-stop"
                            aria-label={`Show ${photoLocationLabel(photo)} on the map`}
                            aria-pressed={selected === photo.id}
                            onClick={() => showStop(stop)}
                            onFocus={() => setHovered(photo.id)}
                            onBlur={() => setHovered(null)}
                          >
                            {stop.n}
                          </button>
                        ) : (
                          <span className="trip-stop trip-stop--none" title="Not on the map">
                            <MapPinOff size={14} aria-hidden />
                            <span className="visually-hidden">Not on the map</span>
                          </span>
                        )}
                        <div className="trip-row-thumb">
                          <ViewableThumb photo={photo} onView={onView} />
                        </div>
                        <div className="trip-row-text">
                          <p className="trip-tile-place">{photoLocationLabel(photo)}</p>
                          <p className="trip-caption">
                            {captureTime(photo)?.slice(11, 16) ?? 'Time unknown'}
                            {zoneNote(photo.capture_time_local, photo.capture_utc_offset)}
                          </p>
                          {status ? <StatusBadge status={status} /> : null}
                        </div>
                        <PhotoActions photo={photo} onCorrect={onCorrect} />
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="trip-journey-map">
        <MapContainer
          ref={setMap}
          className="trip-journey-canvas"
          center={[48, 10]}
          zoom={4}
          zoomControl={false}
          worldCopyJump
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
          {stops.length > 1 ? (
            <Polyline
              positions={stops.map((stop): [number, number] => [stop.lat, stop.lng])}
              pathOptions={{ className: 'trip-route', color: '#2e2e6c', weight: 2.5, opacity: 0.7, dashArray: '2 8', lineCap: 'round' }}
            />
          ) : null}
          {stops.map((stop) => (
            <Marker
              key={stop.photo.id}
              position={[stop.lat, stop.lng]}
              icon={stopIcon(stop.n, selected === stop.photo.id, hovered === stop.photo.id)}
              title={`${stop.n}. ${photoLocationLabel(stop.photo)}`}
              alt={`${stop.n}. ${photoLocationLabel(stop.photo)}`}
              zIndexOffset={selected === stop.photo.id ? 1000 : hovered === stop.photo.id ? 500 : 0}
              eventHandlers={{
                click: () => pickPin(stop),
                mouseover: () => setHovered(stop.photo.id),
                mouseout: () => setHovered(null),
              }}
            />
          ))}
        </MapContainer>
        <MapLayers value={basemap} onChange={setBasemap} />
        {stops.length === 0 ? <p className="trip-journey-nomap">No photo here has a location yet, so nothing is on the map.</p> : null}
      </div>
    </div>
  )
}

/**
 * Trip detail (doc 3.2): what the trip covers, every photo including the ones
 * without GPS, and the place to correct locations. A gallery shows the
 * photos as a grid; the journey view lists them day by day.
 */
export default function TripScreen({ tripId, initialFiles, onBack, onShowOnMap, onDeleted, onPlaceReviewed }: TripScreenProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [view, setView] = useState<View>('gallery')
  const [correcting, setCorrecting] = useState<Photo | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // Reopen the panel after a reload while this browser has unfinished uploads for the trip.
  const [uploading, setUploading] = useState(() => Boolean(initialFiles?.length) || hasUnfinishedUploads(tripId))
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  // Closing the details form (save or cancel) puts focus back on Edit details.
  useEffect(() => {
    if (editing || !returnFocus.current) return
    returnFocus.current = false
    editButton.current?.focus()
  }, [editing])

  function closeEditor() {
    returnFocus.current = true
    setEditing(false)
  }
  const [sharing, setSharing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchPhotos = useCallback<FetchPage<Photo>>(
    (cursor, signal) => listTripPhotos(tripId, signal, cursor),
    [tripId],
  )
  const { state: moreState, loadMore, cancel: cancelMore } = useLoadMore(fetchPhotos, tripId)
  // How many photos are on screen, so a reload brings back the pages the owner had opened.
  const shown = useRef(0)
  useEffect(() => {
    shown.current = load.status === 'ready' ? load.photos.length : 0
  }, [load])

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      // A page still loading belongs to the old list; drop it rather than merge it into the new one.
      cancelMore()
      try {
        const [trip, page] = await Promise.all([getTrip(tripId, signal), loadPages(fetchPhotos, shown.current, signal)])
        // The API sends capture order already; sorting again keeps the order whatever the source.
        setLoad({ status: 'ready', trip, photos: sortByCapture(page.items), nextCursor: page.next_cursor })
      } catch (error) {
        if (!signal?.aborted) {
          const missing = error instanceof NotFoundError || (error instanceof ApiError && error.status === 404)
          setLoad({ status: missing ? 'not-found' : 'error' })
        }
      }
    },
    [tripId, fetchPhotos, cancelMore],
  )

  const loadMorePhotos = useCallback(() => {
    if (load.status !== 'ready' || !load.nextCursor) return
    void loadMore(load.nextCursor, (page) =>
      setLoad((current) =>
        current.status === 'ready'
          ? { ...current, photos: sortByCapture(mergePage(current.photos, page.items)), nextCursor: page.next_cursor }
          : current,
      ),
    )
  }, [load, loadMore])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const reload = useCallback(() => void refresh(), [refresh])

  async function saveLocation(photo: Photo, patch: LocationPatch) {
    const updated = await patchPhotoLocation(photo.id, patch)
    onPlaceReviewed?.()
    // Reload before closing, so the counts never show the pre-correction state.
    await refresh()
    // Only close this photo's panel: the owner may already have opened another one.
    setCorrecting((open) => (open?.id === photo.id ? null : open))
    setMessage(`Location saved: ${updated.place_name ?? 'updated'}.`)
  }

  if (load.status === 'loading') {
    return (
      <div className="trip">
        <p className="trip-caption" role="status">
          Loading trip…
        </p>
      </div>
    )
  }

  if (load.status === 'not-found') {
    return <NotFoundScreen signedIn embedded onHome={onBack} />
  }

  if (load.status === 'error') {
    return (
      <div className="trip">
        <button type="button" className="trip-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Dashboard
        </button>
        <div role="alert" className="trip-status-block">
          <p>This trip could not be loaded.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLoad({ status: 'loading' })
              void refresh()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { trip, photos } = load
  const dates = formatDateRange(trip.start_date, trip.end_date)
  const toReview = photos.filter((p) => p.state === 'needs-location' || p.label_status === 'suggested')

  return (
    <div className="trip">
      <button type="button" className="trip-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        Dashboard
      </button>

      <header className="trip-head">
        <div className="trip-head-text">
          <span className="trip-badges">
            <VisibilityBadge visibility={trip.visibility} underReview={trip.under_review} />
          </span>
          <h1 className="trip-title">{trip.title}</h1>
          <p className="trip-meta">
            {[dates, plural(trip.photo_count, 'photo'), trip.cities.length > 0 ? trip.cities.join(' → ') : null]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
          {editing ? (
            <TripDetailsForm
              trip={trip}
              onCancel={closeEditor}
              onSaved={(saved) => {
                // Keep the photos; the trip response carries the new title, notes and aggregates.
                setLoad((current) => (current.status === 'ready' ? { ...current, trip: saved } : current))
                setMessage('Trip details saved.')
                closeEditor()
              }}
            />
          ) : (
            <>
              {trip.notes ? <p className="trip-notes">{trip.notes}</p> : null}
              <button
                ref={editButton}
                type="button"
                className="trip-edit-open"
                onClick={() => {
                  setMessage('')
                  setEditing(true)
                }}
              >
                <Pencil size={14} aria-hidden />
                Edit details
              </button>
            </>
          )}
        </div>
        <div className="trip-head-actions">
          <button type="button" className="btn btn-primary" onClick={() => onShowOnMap(trip.id)}>
            <MapIcon size={16} aria-hidden />
            Show on map
          </button>
          <button
            type="button"
            className="btn btn-action"
            aria-expanded={uploading}
            onClick={() => setUploading((open) => !open)}
          >
            <Upload size={16} aria-hidden />
            Upload photos
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!sharingAvailable}
            aria-expanded={sharingAvailable ? sharing : undefined}
            title={!sharingAvailable ? 'Sharing will be available when persistent photo sharing is supported.' : undefined}
            onClick={() => setSharing((open) => !open)}
          >
            <Share2 size={16} aria-hidden />
            {sharingAvailable ? 'Share' : 'Share (coming soon)'}
          </button>
          <button
            type="button"
            className="btn btn-secondary trip-delete-open"
            aria-expanded={confirmingDelete}
            onClick={() => setConfirmingDelete((open) => !open)}
          >
            <Trash2 size={16} aria-hidden />
            Delete trip
          </button>
        </div>
      </header>

      {confirmingDelete ? (
        <DeleteTripConfirm trip={trip} onDeleted={onDeleted} onCancel={() => setConfirmingDelete(false)} />
      ) : null}

      {sharingAvailable && sharing ? <ShareSettings trip={trip} photos={photos} /> : null}

      <p className="visually-hidden" role="status">
        {message}
      </p>
      {message ? <p className="trip-saved">{message}</p> : null}

      {toReview.length > 0 ? (
        <div className="trip-review" role="note">
          <MapPinOff size={18} aria-hidden />
          <p>
            {plural(toReview.length, 'photo')} {toReview.length === 1 ? 'needs' : 'need'} your review. Photos without a
            location stay in the gallery but are not on the map.
          </p>
          {!correcting ? (
            <button type="button" className="btn btn-secondary" onClick={() => setCorrecting(toReview[0])}>
              Review next
            </button>
          ) : null}
        </div>
      ) : null}

      {uploading ? (
        <UploadPanel
          tripId={trip.id}
          photos={photos}
          initialFiles={initialFiles}
          onBatchDone={reload}
          onSetLocation={(photo) => setCorrecting(photo)}
        />
      ) : null}

      {correcting ? (
        <CorrectionPanel
          key={correcting.id}
          photo={correcting}
          previous={previousLocated(photos, correcting)}
          onSave={(patch) => saveLocation(correcting, patch)}
          onCancel={() => setCorrecting(null)}
        />
      ) : null}

      <section className="trip-photos" aria-labelledby="trip-photos-title">
        <div className="trip-photos-head">
          <h2 id="trip-photos-title" className="trip-h2">
            Photos
          </h2>
          <div className="trip-toggle" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}>
              <LayoutGrid size={14} aria-hidden />
              Gallery
            </button>
            <button type="button" aria-pressed={view === 'journey'} onClick={() => setView('journey')}>
              <List size={14} aria-hidden />
              Journey
            </button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="trip-empty">
            <ImageOff size={28} aria-hidden />
            <p>No photos in this trip yet. Upload photos and MapMory places them on your map.</p>
            {!uploading ? (
              <button type="button" className="btn btn-action" onClick={() => setUploading(true)}>
                <Upload size={16} aria-hidden />
                Upload photos
              </button>
            ) : null}
          </div>
        ) : view === 'gallery' ? (
          <Gallery photos={photos} onCorrect={setCorrecting} onView={(photo) => setViewing(photo.id)} />
        ) : (
          <Journey photos={photos} onCorrect={setCorrecting} onView={(photo) => setViewing(photo.id)} />
        )}

        {load.nextCursor ? (
          <LoadMore
            summary={`Showing ${photos.length} of ${plural(trip.photo_count, 'photo')}`}
            label="Load more photos"
            errorText="More photos could not be loaded."
            state={moreState}
            onLoadMore={loadMorePhotos}
          />
        ) : null}
      </section>

      {viewing ? (
        <PhotoViewer
          // The viewer pages in the order the current view shows the photos.
          photos={(view === 'journey' ? journeyDays(photos).flatMap(([, day]) => day) : photos).filter(viewerImage)}
          startId={viewing}
          onClose={() => setViewing(null)}
          hasMore={load.nextCursor !== null}
          moreState={moreState}
          onLoadMore={loadMorePhotos}
        />
      ) : null}
    </div>
  )
}
