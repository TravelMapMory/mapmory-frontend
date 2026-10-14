/*
 * Converts backend JSON into the view models in types.ts. The backend grows
 * one endpoint at a time, so fields it does not send yet get neutral
 * defaults here instead of breaking the screens.
 */
import type { Page, TripDetail, TripSummary } from './types'

/** A trip as mapmory-backend serves it today (cmd/server/api_types.go). */
export interface ApiTrip {
  id: string
  title: string
  notes: string | null
  created_at: string
  photo_count: number
  cover: { photo_id: string; image: { url: string; expires_at: string } } | null
  // Aggregates from the contract that the backend does not send yet.
  located_count?: number
  cities?: string[]
  countries?: string[]
  start_date?: string | null
  end_date?: string | null
  visibility?: 'private' | 'public'
}

export function toTripSummary(trip: ApiTrip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    // The backend sends "" for a trip without notes.
    notes: trip.notes ? trip.notes : null,
    created_at: trip.created_at,
    cover_url: trip.cover?.image.url ?? null,
    photo_count: trip.photo_count,
    located_count: trip.located_count ?? 0,
    cities: trip.cities ?? [],
    countries: trip.countries ?? [],
    start_date: trip.start_date ?? null,
    end_date: trip.end_date ?? null,
    // Trips are private until the owner shares one (doc 3.3).
    visibility: trip.visibility ?? 'private',
  }
}

/** Keeps the server's order: the contract lists trips newest first, so pages stay consistent. */
export function toTripPage(page: Page<ApiTrip>): Page<TripSummary> {
  return { items: page.items.map(toTripSummary), next_cursor: page.next_cursor }
}

/** Backend GET /api/trips/{id} uses the same shape as the list item. */
export function toTripDetail(trip: ApiTrip): TripDetail {
  return { ...toTripSummary(trip), cover_photo_id: trip.cover?.photo_id ?? null }
}
