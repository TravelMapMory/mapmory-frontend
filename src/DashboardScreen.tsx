import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Building2, Camera, Earth, FolderPlus, MapPinOff, Plus, Upload } from 'lucide-react'
import { createTrip, getSummary, listTrips } from './api/client'
import type { MeSummary, Photo, TripSummary } from './api/types'
import StatTile from './components/StatTile'
import TripCard from './components/TripCard'
import { formatUploaded } from './format'
import './DashboardScreen.css'

export interface DashboardScreenProps {
  onShowOnMap: (tripId: string) => void
  /** Opens trip detail; without it Open trip renders disabled. */
  onOpenTrip?: (tripId: string) => void
  /** Starts uploading the chosen files into a trip; without it Upload photos renders disabled. */
  onUploadPhotos?: (tripId: string, files: File[]) => void
}

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; summary: MeSummary; trips: TripSummary[] }

/**
 * Inline "Create trip" form. A trip only needs a title (notes can be added
 * from trip detail later), so a dialog would be heavier than the task.
 */
function CreateTripForm({ onCreated, onCancel }: { onCreated: (trip: TripSummary) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const inputId = useId()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setSaving(true)
    setFailed(false)
    try {
      onCreated(await createTrip({ title: trimmed }))
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <form
      className="dash-create"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <label htmlFor={inputId} className="dash-create-label">
        Trip name
      </label>
      <div className="dash-create-row">
        <input
          id={inputId}
          className="dash-create-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Summer in Lisbon"
          maxLength={120}
          required
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
          {saving ? 'Creating…' : 'Create'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {failed ? (
        <p className="dash-create-error" role="alert">
          The trip could not be created. Try again.
        </p>
      ) : null}
    </form>
  )
}

/**
 * Inline "Upload photos": pick the trip, then the files. The upload itself
 * runs on the trip page, which shows each photo's progress.
 */
function UploadForm({
  trips,
  onUpload,
  onCancel,
}: {
  trips: TripSummary[]
  onUpload: (tripId: string, files: File[]) => void
  onCancel: () => void
}) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? '')
  const tripField = useId()
  const fileField = useId()

  return (
    <form
      className="dash-create"
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <div className="dash-create-row">
        <div className="dash-upload-field">
          <label htmlFor={tripField} className="dash-create-label">
            Trip
          </label>
          <select id={tripField} className="dash-create-input" value={tripId} onChange={(e) => setTripId(e.target.value)}>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="dash-upload-field">
          <label htmlFor={fileField} className="dash-create-label">
            Photos (JPEG or PNG, up to 25 MB each)
          </label>
          <input
            id={fileField}
            className="dash-file"
            type="file"
            multiple
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              if (files.length > 0 && tripId) onUpload(tripId, files)
            }}
          />
        </div>
        <button type="button" className="btn btn-secondary dash-upload-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * "Recently uploaded": newest uploads first. Labelled with its sort order
 * because the journey log sorts by capture time instead (doc §3.3).
 */
function RecentlyUploaded({ photos }: { photos: Photo[] }) {
  return (
    <section className="dash-section" aria-labelledby="dash-recent">
      <div className="dash-section-head">
        <h2 id="dash-recent" className="dash-h2">
          Recently uploaded
        </h2>
        <span className="dash-caption">Sorted by upload date</span>
      </div>

      {photos.length === 0 ? (
        <p className="dash-empty-line">Photos you upload will appear here.</p>
      ) : (
        <ul className="dash-recent">
          {photos.map((photo) => {
            const place = photo.city ?? photo.place_name
            return (
              <li key={photo.id} className="dash-recent-item">
                {photo.thumb_url ? (
                  <img src={photo.thumb_url} alt={place ? `Photo in ${place}` : 'Photo without a location'} loading="lazy" />
                ) : (
                  <div className="dash-recent-thumb-empty" aria-hidden />
                )}
                <span className="dash-recent-caption">
                  {place ? (
                    <span className="dash-recent-place">{place}</span>
                  ) : (
                    <span className="dash-recent-place dash-recent-missing">
                      <MapPinOff size={12} aria-hidden />
                      Needs location
                    </span>
                  )}
                  <span>Uploaded {formatUploaded(photo.uploaded_at)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * The owner's Dashboard (doc 3.2): totals, trip cards and recently uploaded
 * photos, with Create trip and Upload photos. All numbers come from the API;
 * the screen never recomputes them, so a correction made anywhere shows up
 * here on the next load.
 */
export default function DashboardScreen({ onShowOnMap, onOpenTrip, onUploadPhotos }: DashboardScreenProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [choosingUpload, setChoosingUpload] = useState(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [summary, trips] = await Promise.all([getSummary(signal), listTrips(signal)])
      setLoad({ status: 'ready', summary, trips: trips.items })
    } catch {
      // A cancelled load (unmount, or StrictMode's dev re-run) is not an error.
      if (!signal?.aborted) setLoad({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const hasTrips = load.status === 'ready' && load.trips.length > 0

  return (
    <div className="dash">
      <div className="dash-top">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-subtitle">Your trips and photos. Everything here is private until you share it.</p>
        </div>
        <div className="dash-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCreating(true)}
            aria-expanded={creating}
          >
            <Plus size={16} aria-hidden />
            Create trip
          </button>
          <button
            type="button"
            className="btn btn-action"
            onClick={() => setChoosingUpload(true)}
            aria-expanded={choosingUpload}
            disabled={!onUploadPhotos || !hasTrips}
            title={!onUploadPhotos ? 'Upload is not available yet' : !hasTrips ? 'Create a trip first' : undefined}
          >
            <Upload size={16} aria-hidden />
            Upload photos
          </button>
        </div>
      </div>

      {creating ? (
        <CreateTripForm
          onCancel={() => setCreating(false)}
          onCreated={(trip) => {
            setCreating(false)
            // A new trip is empty, so go straight to it to add photos.
            if (onOpenTrip) onOpenTrip(trip.id)
            else void refresh()
          }}
        />
      ) : null}

      {choosingUpload && onUploadPhotos && load.status === 'ready' ? (
        <UploadForm trips={load.trips} onUpload={onUploadPhotos} onCancel={() => setChoosingUpload(false)} />
      ) : null}

      {load.status === 'loading' ? (
        <p className="dash-status" role="status">
          Loading your trips…
        </p>
      ) : null}

      {load.status === 'error' ? (
        <div className="dash-status" role="alert">
          <p>Your Dashboard could not be loaded.</p>
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
      ) : null}

      {load.status === 'ready' ? (
        <>
          <section aria-label="Travel totals">
            <div className="dash-stats">
              <StatTile label="Photos" value={load.summary.photo_count} icon={Camera} hint="Including photos without GPS" />
              <StatTile label="Countries" value={load.summary.country_count} icon={Earth} hint="From located photos" />
              <StatTile label="Cities" value={load.summary.city_count} icon={Building2} hint="From located photos" />
              <StatTile
                label="Locations to review"
                value={load.summary.to_review_count}
                icon={MapPinOff}
                hint={load.summary.to_review_count > 0 ? 'Missing or suggested places' : 'All confirmed'}
                attention={load.summary.to_review_count > 0}
              />
            </div>
          </section>

          <section className="dash-section" aria-labelledby="dash-trips">
            <div className="dash-section-head">
              <h2 id="dash-trips" className="dash-h2">
                Trips
              </h2>
              {load.trips.length > 0 ? <span className="dash-caption">Newest first</span> : null}
            </div>

            {load.trips.length === 0 ? (
              <div className="dash-empty">
                <FolderPlus size={32} aria-hidden />
                <h3 className="dash-empty-title">No trips yet</h3>
                <p>
                  Create a trip, then upload its photos. MapMory reads where and when each one was taken and puts it
                  on your map.
                </p>
                {!creating ? (
                  <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus size={16} aria-hidden />
                    Create your first trip
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="dash-trips">
                {load.trips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onShowOnMap={onShowOnMap} onOpen={onOpenTrip} />
                ))}
              </div>
            )}
          </section>

          <RecentlyUploaded photos={load.summary.recently_uploaded} />
        </>
      ) : null}
    </div>
  )
}
