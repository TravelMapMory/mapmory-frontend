import { useCallback, useEffect, useRef, useState } from 'react'
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
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { getTrip, listTripPhotos, patchPhotoLocation } from './api/client'
import type { LocationPatch, Photo, TripDetail } from './api/types'
import LocationPicker, { type LatLng } from './components/LocationPicker'
import UploadPanel from './components/UploadPanel'
import VisibilityBadge from './components/VisibilityBadge'
import { formatCaptured, formatDateRange, plural } from './format'
import './TripScreen.css'

export interface TripScreenProps {
  tripId: string
  /** Photos chosen on the Dashboard for this trip; their upload starts on arrival. */
  initialFiles?: File[]
  onBack: () => void
  onShowOnMap: (tripId: string) => void
}

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; trip: TripDetail; photos: Photo[] }

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
    <img src={photo.thumb_url} alt={photo.place_name ? `Photo at ${photo.place_name}` : 'Photo without a location'} loading="lazy" />
  ) : (
    <div className="trip-thumb-empty">
      <ImageOff size={22} aria-hidden />
    </div>
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
          <dd>{formatCaptured(photo.capture_time_local) ?? 'No capture time in the file'}</dd>
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

function Gallery({ photos, onCorrect }: { photos: Photo[]; onCorrect: (photo: Photo) => void }) {
  return (
    <ul className="trip-gallery">
      {photos.map((photo) => {
        const status = photoStatus(photo)
        return (
          <li key={photo.id} className="trip-tile">
            <div className="trip-tile-img">
              <Thumb photo={photo} />
              {status ? (
                <span className="trip-tile-badge">
                  <StatusBadge status={status} />
                </span>
              ) : null}
            </div>
            <div className="trip-tile-body">
              <p className="trip-tile-place">{photo.place_name ?? 'No location'}</p>
              <p className="trip-caption">{formatCaptured(photo.capture_time_local) ?? 'No capture time'}</p>
              <PhotoActions photo={photo} onCorrect={onCorrect} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const dayHeading = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Journey log (doc 3.2): the trip day by day, in capture order. */
function Journey({ photos, onCorrect }: { photos: Photo[]; onCorrect: (photo: Photo) => void }) {
  const days = new Map<string, Photo[]>()
  for (const photo of photos) {
    const key = photo.capture_time_local?.slice(0, 10) ?? 'undated'
    days.set(key, [...(days.get(key) ?? []), photo])
  }
  const ordered = [...days].sort(([a], [b]) => (a === 'undated' ? 1 : b === 'undated' ? -1 : a.localeCompare(b)))
  // Days count from the trip's first day, so a day without photos still advances the number.
  const first = ordered[0]?.[0]
  const dayNumber = (day: string) =>
    first && first !== 'undated' ? Math.round((Date.parse(day) - Date.parse(first)) / 86_400_000) + 1 : 1

  return (
    <ol className="trip-journey">
      {ordered.map(([day, list]) => (
        <li key={day} className="trip-day">
          <h3 className="trip-day-title">
            {day === 'undated' ? 'No capture date' : `Day ${dayNumber(day)} · ${dayHeading.format(new Date(`${day}T00:00:00Z`))}`}
          </h3>
          <ul className="trip-rows">
            {list.map((photo) => {
              const status = photoStatus(photo)
              return (
                <li key={photo.id} className="trip-row">
                  <div className="trip-row-thumb">
                    <Thumb photo={photo} />
                  </div>
                  <div className="trip-row-text">
                    <p className="trip-tile-place">{photo.place_name ?? 'No location'}</p>
                    <p className="trip-caption">
                      {photo.capture_time_local ? photo.capture_time_local.slice(11, 16) : 'Time unknown'}
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
  )
}

/**
 * Trip detail (doc 3.2): what the trip covers, every photo including the ones
 * without GPS, and the place to correct locations. A gallery shows the
 * photos as a grid; the journey view lists them day by day.
 */
export default function TripScreen({ tripId, initialFiles, onBack, onShowOnMap }: TripScreenProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [view, setView] = useState<View>('gallery')
  const [correcting, setCorrecting] = useState<Photo | null>(null)
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(Boolean(initialFiles?.length))

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [trip, page] = await Promise.all([getTrip(tripId, signal), listTripPhotos(tripId, signal)])
        setLoad({ status: 'ready', trip, photos: page.items })
      } catch {
        if (!signal?.aborted) setLoad({ status: 'error' })
      }
    },
    [tripId],
  )

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const reload = useCallback(() => void refresh(), [refresh])

  async function saveLocation(photo: Photo, patch: LocationPatch) {
    const updated = await patchPhotoLocation(photo.id, patch)
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
          <VisibilityBadge visibility={trip.visibility} />
          <h1 className="trip-title">{trip.title}</h1>
          <p className="trip-meta">
            {[dates, plural(trip.photo_count, 'photo'), trip.cities.length > 0 ? trip.cities.join(' · ') : null]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
          {trip.notes ? <p className="trip-notes">{trip.notes}</p> : null}
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
        </div>
      </header>

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
          <Gallery photos={photos} onCorrect={setCorrecting} />
        ) : (
          <Journey photos={photos} onCorrect={setCorrecting} />
        )}
      </section>
    </div>
  )
}
