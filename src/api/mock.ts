/*
 * In-memory stand-in for the backend, seeded with the three sample trips the
 * design doc asks for 3.4: a multi-city trip, a short trip, and a trip with
 * a photo missing its location. Aggregates are computed from the photo list
 * with the 3.3 rules rather than hard-coded, so a mocked location correction
 * later moves every count together, as the real API must.
 */
import helsinki from '../assets/pins/helsinki.jpg'
import london from '../assets/pins/london.jpg'
import berlin from '../assets/pins/berlin.jpg'
import rome from '../assets/pins/rome.jpg'
import paris from '../assets/pins/paris.jpg'
import parisWide from '../assets/pins/paris-wide.jpg'
import type { CreateTripInput, MeSummary, Page, Photo, TripSummary } from './types'

interface TripRow {
  id: string
  title: string
  notes: string | null
  created_at: string
  cover_photo_id: string | null
}

const PLACES = {
  paris: { lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'France', img: paris },
  parisWide: { lat: 48.8584, lng: 2.2945, city: 'Paris', country: 'France', img: parisWide },
  london: { lat: 51.5072, lng: -0.1276, city: 'London', country: 'United Kingdom', img: london },
  berlin: { lat: 52.52, lng: 13.405, city: 'Berlin', country: 'Germany', img: berlin },
  rome: { lat: 41.9028, lng: 12.4964, city: 'Rome', country: 'Italy', img: rome },
  helsinki: { lat: 60.1699, lng: 24.9384, city: 'Helsinki', country: 'Finland', img: helsinki },
} as const

type PlaceKey = keyof typeof PLACES

// Builds a ready, located photo; `overrides` covers the unusual ones
function photo(
  id: string,
  trip_id: string,
  place: PlaceKey,
  captured: string,
  uploaded: string,
  overrides: Partial<Photo> = {},
): Photo {
  const p = PLACES[place]
  return {
    id,
    trip_id,
    state: 'ready',
    thumb_url: p.img,
    display_url: p.img,
    capture_time_local: captured,
    capture_utc_offset: '+02:00',
    uploaded_at: uploaded,
    lat: p.lat,
    lng: p.lng,
    country: p.country,
    city: p.city,
    place_name: `${p.city}, ${p.country}`,
    label_status: 'confirmed',
    location_source: 'exif',
    ...overrides,
  }
}

const trips: TripRow[] = [
  {
    id: 'trip-europe',
    title: 'Europe by rail',
    notes: 'Interrail pass, five cities in two weeks.',
    created_at: '2026-06-20T10:00:00Z',
    cover_photo_id: 'p-eu-2',
  },
  {
    id: 'trip-helsinki',
    title: 'Weekend in Helsinki',
    notes: null,
    created_at: '2026-09-14T08:00:00Z',
    cover_photo_id: null,
  },
  {
    id: 'trip-rome',
    title: 'Rome with family',
    notes: 'One photo came from a scanner, so it has no GPS.',
    created_at: '2026-09-28T17:30:00Z',
    cover_photo_id: null,
  },
]

const photos: Photo[] = [
  photo('p-eu-1', 'trip-europe', 'paris', '2026-06-01T09:12:00', '2026-06-20T10:05:00Z'),
  photo('p-eu-2', 'trip-europe', 'parisWide', '2026-06-02T19:40:00', '2026-06-20T10:05:10Z'),
  photo('p-eu-3', 'trip-europe', 'london', '2026-06-04T13:00:00', '2026-06-20T10:05:20Z', {
    capture_utc_offset: '+01:00',
  }),
  photo('p-eu-4', 'trip-europe', 'berlin', '2026-06-07T11:25:00', '2026-06-20T10:05:30Z'),
  photo('p-eu-5', 'trip-europe', 'berlin', '2026-06-08T16:05:00', '2026-06-20T10:05:40Z'),
  photo('p-eu-6', 'trip-europe', 'rome', '2026-06-10T18:30:00', '2026-06-20T10:05:50Z'),
  photo('p-eu-7', 'trip-europe', 'helsinki', '2026-06-13T21:10:00', '2026-06-20T10:06:00Z', {
    capture_utc_offset: '+03:00',
  }),

  photo('p-hel-1', 'trip-helsinki', 'helsinki', '2026-09-12T12:00:00', '2026-09-14T08:10:00Z', {
    capture_utc_offset: '+03:00',
  }),
  photo('p-hel-2', 'trip-helsinki', 'helsinki', '2026-09-13T15:45:00', '2026-09-14T08:10:20Z', {
    capture_utc_offset: '+03:00',
  }),

  photo('p-rom-1', 'trip-rome', 'rome', '2026-09-20T10:00:00', '2026-09-28T17:35:00Z'),
  photo('p-rom-2', 'trip-rome', 'rome', '2026-09-21T17:20:00', '2026-09-28T17:35:30Z', {
    label_status: 'suggested',
  }),
  photo('p-rom-3', 'trip-rome', 'rome', '2026-09-22T12:00:00', '2026-09-28T17:36:00Z', {
    state: 'needs-location',
    capture_time_local: null,
    capture_utc_offset: null,
    lat: null,
    lng: null,
    country: null,
    city: null,
    place_name: null,
    label_status: 'pending',
    location_source: null,
  }),
]

// Doc 3.3: only photos with usable coordinates are map pins.
function isLocated(p: Photo): boolean {
  return p.lat !== null && p.lng !== null
}
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))]
}
function byCapture(a: Photo, b: Photo): number {
  return (a.capture_time_local ?? '').localeCompare(b.capture_time_local ?? '')
}
function summarise(trip: TripRow): TripSummary {
  const own = photos.filter((p) => p.trip_id === trip.id)
  const located = own.filter(isLocated).sort(byCapture)
  const dated = own.map((p) => p.capture_time_local).filter((t): t is string => t !== null).sort()
  // Owner's cover, else the first ready photo, else the placeholder.
  const cover =
    own.find((p) => p.id === trip.cover_photo_id && p.thumb_url) ??
    own.find((p) => p.state === 'ready' && p.thumb_url)

  return {
    id: trip.id,
    title: trip.title,
    notes: trip.notes,
    created_at: trip.created_at,
    cover_url: cover?.display_url ?? null,
    photo_count: own.length,
    located_count: located.length,
    cities: distinct(located.map((p) => p.city)),
    countries: distinct(located.map((p) => p.country)),
    start_date: dated[0]?.slice(0, 10) ?? null,
    end_date: dated[dated.length - 1]?.slice(0, 10) ?? null,
    visibility: 'private',
  }
}
/** Simulated network latency, so loading states are actually exercised. */
function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
export function mockSummary(): Promise<MeSummary> {
  const located = photos.filter(isLocated)
  return delay({
    photo_count: photos.length,
    country_count: distinct(located.map((p) => p.country)).length,
    city_count: distinct(located.map((p) => p.city)).length,
    to_review_count: photos.filter((p) => p.state === 'needs-location' || p.label_status === 'suggested').length,
    recently_uploaded: [...photos].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)).slice(0, 8),
  })
}
export function mockListTrips(): Promise<Page<TripSummary>> {
  const items = [...trips].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(summarise)
  return delay({ items, next_cursor: null })
}
export function mockCreateTrip(input: CreateTripInput): Promise<TripSummary> {
  const row: TripRow = {
    id: `trip-${Date.now()}`,
    title: input.title,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
    cover_photo_id: null,
  }
  trips.push(row)
  return delay(summarise(row))
}
