/*
 * Response shapes for the REST API in design doc 5.2, with field names taken
 * from the data model in 5.3. The backend does not serve these yet, so
 * `mock.ts` produces them; once an endpoint exists, only its function in
 * `client.ts` changes. We need to work on this in order to support the Dashboard and Map screens, and the photo upload flow.
 */

// photo lifecycle (doc 3.3). Only `ready` photos have display images
export type PhotoState = 'pending' | 'uploading' | 'processing' | 'ready' | 'needs-location' | 'failed'
// whether the place label came from the resolver and was accepted. 
export type LabelStatus = 'pending' | 'suggested' | 'confirmed'
// where the coordinates came from: the file itself or an owner correction. 
export type LocationSource = 'exif' | 'manual'

/**
 * One photo as the owner sees it. `thumb_url` and `display_url` are the
 * short-lived signed GCS URLs the API derives from `thumb_key`/`display_key`;
 */
export interface Photo {
  id: string
  trip_id: string
  state: PhotoState
  thumb_url: string | null
  display_url: string | null
  /** ISO local time without offset, like "2026-06-12T18:40:00". */
  capture_time_local: string | null
  /** e.g. "+02:00"; null when the camera recorded none. */
  capture_utc_offset: string | null
  /** ISO UTC timestamp. */
  uploaded_at: string
  lat: number | null
  lng: number | null
  country: string | null
  city: string | null
  place_name: string | null
  label_status: LabelStatus
  location_source: LocationSource | null
}
/**
 * A trip as `GET /api/trips` lists it: the TRIP row plus the aggregates a
 * card needs, so the Dashboard does not have to fetch every trip's photos.
 */
export interface TripSummary {
  id: string
  title: string
  notes: string | null
  created_at: string
  /** Owner's chosen cover, else the first suitable photo, else null. */
  cover_url: string | null
  /** All photos, including ones without GPS. */
  photo_count: number
  /** Photos that can be map pins. */
  located_count: number
  /** Distinct city labels on located photos, in capture order. */
  cities: string[]
  /** Distinct country labels on located photos. */
  countries: string[]
  /** Earliest and latest capture date (local), null if no photo has one. */
  start_date: string | null
  end_date: string | null
  /** Trips are private until the owner creates a share. */
  visibility: 'private' | 'public'
}
/** `GET /api/me/summary`. */
export interface MeSummary {
  photo_count: number
  country_count: number
  city_count: number
  /** Photos in `needs-location` plus suggested labels awaiting the owner. */
  to_review_count: number
  /** Newest first by `uploaded_at`. */
  recently_uploaded: Photo[]
}
/** Every list endpoint returns a page and a cursor for the next one. */
export interface Page<T> {
  items: T[]
  next_cursor: string | null
}
/** `POST /api/trips` body. */
export interface CreateTripInput {
  title: string
  notes?: string
}
