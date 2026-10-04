import { ImageOff, MapPin, MapPinOff } from 'lucide-react'
import type { TripSummary } from '../api/types'
import { formatDateRange, plural } from '../format'
import VisibilityBadge from './VisibilityBadge'
import './TripCard.css'

export interface TripCardProps {
  trip: TripSummary
  /** Opens My photos with this trip selected (doc §4). */
  onShowOnMap: (tripId: string) => void
  /** Opens trip detail. Without it the button renders disabled. */
  onOpen?: (tripId: string) => void
}

/**
 * A Dashboard trip card: cover, private/public status, title, dates, places
 * and photo counts, with Open trip and Show on map.
 *
 * Photos without GPS count towards the total but not towards places, so the
 * card says how many are unlocated instead of letting the numbers disagree
 * silently.
 */
export default function TripCard({ trip, onShowOnMap, onOpen }: TripCardProps) {
  const dates = formatDateRange(trip.start_date, trip.end_date)
  const unlocated = trip.photo_count - trip.located_count
  const titleId = `trip-title-${trip.id}`

  return (
    <article className="trip-card" aria-labelledby={titleId}>
      <div className="trip-card-cover">
        {trip.cover_url ? (
          <img src={trip.cover_url} alt="" loading="lazy" />
        ) : (
          <div className="trip-card-placeholder">
            <ImageOff size={28} aria-hidden />
            <span>No cover yet</span>
          </div>
        )}
        <span className="trip-card-badge">
          <VisibilityBadge visibility={trip.visibility} />
        </span>
      </div>

      <div className="trip-card-body">
        <h3 className="trip-card-title" id={titleId}>
          {trip.title}
        </h3>
        {dates ? <p className="trip-card-meta">{dates}</p> : null}

        <p className="trip-card-places">
          <MapPin size={14} aria-hidden />
          {trip.cities.length > 0 ? trip.cities.join(' · ') : 'No places yet'}
        </p>

        <p className="trip-card-meta">
          {plural(trip.photo_count, 'photo')}
          {trip.countries.length > 0 ? ` · ${plural(trip.countries.length, 'country', 'countries')}` : null}
        </p>

        {unlocated > 0 ? (
          <p className="trip-card-warn">
            <MapPinOff size={14} aria-hidden />
            {unlocated} without a location
          </p>
        ) : null}
      </div>

      <div className="trip-card-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onOpen ? () => onOpen(trip.id) : undefined}
          disabled={!onOpen}
          title={onOpen ? undefined : 'Trip detail is not available yet'}
        >
          Open trip
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onShowOnMap(trip.id)}>
          Show on map
        </button>
      </div>
    </article>
  )
}
