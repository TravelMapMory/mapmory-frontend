import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FolderOpen, ImageOff, X } from 'lucide-react'
import type { MapPhoto } from '../api/types'
import { formatCaptured, plural } from '../format'
import './PlaceTrips.css'

/** The owner's photos from one trip at a place. */
interface PlaceTrip {
  trip_id: string
  title: string
  photos: MapPhoto[]
}

/**
 * Groups photos by trip in capture order, with trips containing the clicked
 * photos first.
 */
function toTrips(photos: MapPhoto[], pinned: Set<string>): PlaceTrip[] {
  const byTrip = new Map<string, PlaceTrip>()
  for (const p of photos) {
    const trip = byTrip.get(p.trip_id) ?? {
      trip_id: p.trip_id,
      title: p.trip_title,
      photos: [],
    }
    trip.photos.push(p)
    byTrip.set(p.trip_id, trip)
  }
  const rank = (a: PlaceTrip) => a.photos.some((p) => pinned.has(p.id)) ? 0 : 1
  return [...byTrip.values()].sort((a, b) => rank(a) - rank(b))
}

export interface PlaceTripsProps {
  /** Every loaded owner photo at the selected place. */
  photos: MapPhoto[]
  /** Ids of the photos under the pin that was selected. */
  pinnedIds: string[]
  onClose: () => void
  onOpenTrip?: (tripId: string) => void
}

/**
 * The photos at a selected place as one card per trip. Left and right (the
 * arrow buttons, or the arrow keys on the picture) step through the trip's
 * photos; the switcher at the card's bottom right moves to the next trip
 * at the same place.
 */
export default function PlaceTrips({ photos, pinnedIds, onClose, onOpenTrip }: PlaceTripsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const trips = useMemo(() => toTrips(photos, new Set(pinnedIds)), [photos, pinnedIds])
  const [tripIndex, setTripIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)
  const places = [...new Set(photos.map((p) => p.city ?? p.place_name).filter(Boolean))]

  // Opening the panel moves focus into it, so keyboard and screen-reader
  // users land on what they just opened (and phones scroll it into view).
  useEffect(() => {
    setTripIndex(0)
    setPhotoIndex(0)
    headingRef.current?.focus()
  }, [photos])

  const trip = trips[Math.min(tripIndex, trips.length - 1)]
  if (!trip) return null
  const photo = trip.photos[Math.min(photoIndex, trip.photos.length - 1)]
  const manyPhotos = trip.photos.length > 1

  function stepPhoto(delta: number) {
    setPhotoIndex((i) => (i + delta + trip.photos.length) % trip.photos.length)
  }

  function stepTrip(delta: number) {
    setTripIndex((i) => (i + delta + trips.length) % trips.length)
    setPhotoIndex(0)
  }

  function onMediaKey(event: KeyboardEvent) {
    if (!manyPhotos) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      stepPhoto(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  const tripName = (a: PlaceTrip) => a.title
  const next = trips[(tripIndex + 1) % trips.length]
  const prev = trips[(tripIndex - 1 + trips.length) % trips.length]

  return (
    <section className="mp-selected" aria-labelledby="mp-selected-title">
      <div className="mp-selected-head">
        <h2 id="mp-selected-title" className="mp-h2" ref={headingRef} tabIndex={-1}>
          {places.join(', ') || 'Selected photos'}
          <span className="mp-caption">
            {' '}
            · {plural(photos.length, 'photo')}
            {trips.length > 1 ? ` in ${trips.length} trips` : ''}
          </span>
        </h2>
        <button type="button" className="mp-icon-btn" onClick={onClose} aria-label="Close photo details">
          <X size={18} aria-hidden />
        </button>
      </div>

      <article className="pa-card" aria-label={tripName(trip)}>
        <div
          className="pa-media"
          role="group"
          aria-label={`Photos in ${trip.title}`}
          tabIndex={manyPhotos ? 0 : undefined}
          onKeyDown={onMediaKey}
        >
          {photo.display_url ? (
            <img src={photo.display_url} alt={photo.place_name ? `Photo at ${photo.place_name}` : 'Photo'} />
          ) : (
            <div className="pa-media-empty">
              <ImageOff size={24} aria-hidden />
            </div>
          )}
          {manyPhotos ? (
            <>
              <button type="button" className="pa-nav pa-nav--prev" onClick={() => stepPhoto(-1)} aria-label="Previous photo">
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button type="button" className="pa-nav pa-nav--next" onClick={() => stepPhoto(1)} aria-label="Next photo">
                <ChevronRight size={20} aria-hidden />
              </button>
              <span className="pa-counter" aria-live="polite">
                <span className="visually-hidden">Photo </span>
                {photoIndex + 1} / {trip.photos.length}
              </span>
              <div className="pa-dots" aria-hidden>
                {trip.photos.map((p, i) => (
                  <span key={p.id} className={i === photoIndex ? 'pa-dot pa-dot--on' : 'pa-dot'} />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="pa-body">
          <p className="pa-place">{photo.place_name ?? 'Unnamed place'}</p>
          {photo.capture_time_local ? (
            <p className="pa-meta">
              <CalendarDays size={14} aria-hidden />
              {formatCaptured(photo.capture_time_local)}
            </p>
          ) : null}
          <p className="pa-meta">
            <FolderOpen size={14} aria-hidden />
            {trip.title}
          </p>

          <div className="pa-footer">
            {onOpenTrip ? (
              <button type="button" className="btn btn-secondary" onClick={() => onOpenTrip(trip.trip_id)}>
                Open trip
              </button>
            ) : (
              <span />
            )}
            {trips.length > 1 ? (
              <div className="pa-trips" role="group" aria-label="Trips at this place">
                <button
                  type="button"
                  className="pa-trip-btn"
                  onClick={() => stepTrip(-1)}
                  aria-label={`Previous trip: ${tripName(prev)}`}
                  title={tripName(prev)}
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="pa-trips-count" aria-live="polite">
                  Trip {tripIndex + 1} of {trips.length}
                </span>
                <button
                  type="button"
                  className="pa-trip-btn"
                  onClick={() => stepTrip(1)}
                  aria-label={`Next trip: ${tripName(next)}`}
                  title={tripName(next)}
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  )
}
