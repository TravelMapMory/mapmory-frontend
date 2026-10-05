/*
 * In-memory stand-in for the backend, seeded with the three sample trips the
 * design doc asks for 3.4: a multi-city trip, a short trip, and a trip with
 * a photo missing its location. Aggregates are computed from the photo list
 * with the 3.3 rules rather than hard-coded, so a mocked location correction
 * moves every count together, as the real API must.
 *
 * Every photo has its own picture, and its coordinates are those of the
 * landmark the picture shows (see CREDITS.md for each image).
 */
import eiffelTower from '../assets/pins/paris.jpg'
import parisSkyline from '../assets/pins/paris-wide.jpg'
import bigBen from '../assets/pins/london.jpg'
import brandenburgGate from '../assets/pins/berlin.jpg'
import berlinCathedral from '../assets/pins/berlin-dom.jpg'
import colosseum from '../assets/pins/rome.jpg'
import treviFountain from '../assets/pins/rome-trevi.jpg'
import pantheon from '../assets/pins/rome-pantheon.jpg'
import stPeters from '../assets/pins/rome-st-peters.jpg'
import helsinkiCathedral from '../assets/pins/helsinki.jpg'
import uspenskiCathedral from '../assets/pins/helsinki-uspenski.jpg'
import suomenlinna from '../assets/pins/helsinki-suomenlinna.jpg'
import { readPhotoMetadata, sniffImageKind } from './exif'
import type {
  CreateTripInput,
  LocationPatch,
  MapPhoto,
  MapPhotoPage,
  MapPhotoQuery,
  MeSummary,
  Page,
  Photo,
  Place,
  TripDetail,
  TripSummary,
  UploadItem,
} from './types'

interface TripRow {
  id: string
  title: string
  notes: string | null
  created_at: string
  cover_photo_id: string | null
}

interface Landmark {
  name: string
  lat: number
  lng: number
  city: string
  country: string
  img: string
}

const LANDMARKS = {
  eiffelTower: { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, city: 'Paris', country: 'France', img: eiffelTower },
  montparnasse: { name: 'Tour Montparnasse', lat: 48.8421, lng: 2.3219, city: 'Paris', country: 'France', img: parisSkyline },
  bigBen: { name: 'Big Ben', lat: 51.5007, lng: -0.1246, city: 'London', country: 'United Kingdom', img: bigBen },
  brandenburgGate: { name: 'Brandenburg Gate', lat: 52.5163, lng: 13.3777, city: 'Berlin', country: 'Germany', img: brandenburgGate },
  berlinCathedral: { name: 'Berlin Cathedral', lat: 52.5191, lng: 13.401, city: 'Berlin', country: 'Germany', img: berlinCathedral },
  colosseum: { name: 'Colosseum', lat: 41.8902, lng: 12.4922, city: 'Rome', country: 'Italy', img: colosseum },
  treviFountain: { name: 'Trevi Fountain', lat: 41.9009, lng: 12.4833, city: 'Rome', country: 'Italy', img: treviFountain },
  pantheon: { name: 'Pantheon', lat: 41.8986, lng: 12.4769, city: 'Rome', country: 'Italy', img: pantheon },
  helsinkiCathedral: { name: 'Helsinki Cathedral', lat: 60.1704, lng: 24.9522, city: 'Helsinki', country: 'Finland', img: helsinkiCathedral },
  uspenskiCathedral: { name: 'Uspenski Cathedral', lat: 60.1686, lng: 24.96, city: 'Helsinki', country: 'Finland', img: uspenskiCathedral },
  suomenlinna: { name: 'Suomenlinna', lat: 60.1458, lng: 24.9881, city: 'Helsinki', country: 'Finland', img: suomenlinna },
} satisfies Record<string, Landmark>

type LandmarkKey = keyof typeof LANDMARKS

// Builds a ready, located photo; `overrides` covers the unusual ones
function photo(
  id: string,
  trip_id: string,
  place: LandmarkKey,
  captured: string,
  uploaded: string,
  overrides: Partial<Photo> = {},
): Photo {
  const p = LANDMARKS[place]
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
    place_name: `${p.name}, ${p.city}`,
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
    notes: 'One photo was scanned from a print, so it has no GPS.',
    created_at: '2026-09-28T17:30:00Z',
    cover_photo_id: null,
  },
]

const photos: Photo[] = [
  photo('p-eu-1', 'trip-europe', 'eiffelTower', '2026-06-01T09:12:00', '2026-06-20T10:05:00Z'),
  photo('p-eu-2', 'trip-europe', 'montparnasse', '2026-06-02T19:40:00', '2026-06-20T10:05:10Z'),
  photo('p-eu-3', 'trip-europe', 'bigBen', '2026-06-04T04:50:00', '2026-06-20T10:05:20Z', {
    capture_utc_offset: '+01:00',
  }),
  photo('p-eu-4', 'trip-europe', 'brandenburgGate', '2026-06-07T11:25:00', '2026-06-20T10:05:30Z'),
  photo('p-eu-5', 'trip-europe', 'berlinCathedral', '2026-06-08T22:15:00', '2026-06-20T10:05:40Z'),
  photo('p-eu-6', 'trip-europe', 'treviFountain', '2026-06-10T18:30:00', '2026-06-20T10:05:50Z'),
  photo('p-eu-7', 'trip-europe', 'helsinkiCathedral', '2026-06-13T21:10:00', '2026-06-20T10:06:00Z', {
    capture_utc_offset: '+03:00',
  }),

  photo('p-hel-1', 'trip-helsinki', 'uspenskiCathedral', '2026-09-12T12:00:00', '2026-09-14T08:10:00Z', {
    capture_utc_offset: '+03:00',
  }),
  photo('p-hel-2', 'trip-helsinki', 'suomenlinna', '2026-09-13T15:45:00', '2026-09-14T08:10:20Z', {
    capture_utc_offset: '+03:00',
  }),

  photo('p-rom-1', 'trip-rome', 'colosseum', '2026-09-20T10:00:00', '2026-09-28T17:35:00Z'),
  // GPS is present, but the place label is only a suggestion until the owner confirms it.
  photo('p-rom-2', 'trip-rome', 'pantheon', '2026-09-21T20:30:00', '2026-09-28T17:35:30Z', {
    label_status: 'suggested',
  }),
  // Scanned print of St Peter's Basilica: no EXIF, so no location and no capture time.
  {
    id: 'p-rom-3',
    trip_id: 'trip-rome',
    state: 'needs-location',
    thumb_url: stPeters,
    display_url: stPeters,
    capture_time_local: null,
    capture_utc_offset: null,
    uploaded_at: '2026-09-28T17:36:00Z',
    lat: null,
    lng: null,
    country: null,
    city: null,
    place_name: null,
    label_status: 'pending',
    location_source: null,
  },
]

// Doc 3.3: only photos with usable coordinates are map pins.
function isLocated(p: Photo): boolean {
  return p.lat !== null && p.lng !== null
}
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))]
}
// Capture order; photos without a capture time go last, as in the journey log.
function byCapture(a: Pick<Photo, 'capture_time_local'>, b: Pick<Photo, 'capture_time_local'>): number {
  if (a.capture_time_local === b.capture_time_local) return 0
  if (a.capture_time_local === null) return 1
  if (b.capture_time_local === null) return -1
  return a.capture_time_local.localeCompare(b.capture_time_local)
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
/**
 * Simulated network latency, so loading states are actually exercised.
 * Rejects with an AbortError on abort, the same way fetch does.
 */
function delay<T>(value: T, ms = 250, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve(value)
    }, ms)
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}
export function mockSummary(signal?: AbortSignal): Promise<MeSummary> {
  const located = photos.filter(isLocated)
  return delay({
    photo_count: photos.length,
    country_count: distinct(located.map((p) => p.country)).length,
    city_count: distinct(located.map((p) => p.city)).length,
    to_review_count: photos.filter((p) => p.state === 'needs-location' || p.label_status === 'suggested').length,
    recently_uploaded: [...photos].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at)).slice(0, 8),
  }, undefined, signal)
}
export function mockListTrips(signal?: AbortSignal): Promise<Page<TripSummary>> {
  const items = [...trips].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(summarise)
  return delay({ items, next_cursor: null }, undefined, signal)
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

/** A 404 the way `client.ts` will surface one from fetch. */
export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`)
    this.name = 'NotFoundError'
  }
}

export function mockGetTrip(id: string, signal?: AbortSignal): Promise<TripDetail> {
  const row = trips.find((t) => t.id === id)
  if (!row) return Promise.reject(new NotFoundError('Trip'))
  return delay({ ...summarise(row), cover_photo_id: row.cover_photo_id }, undefined, signal)
}

/** Every photo of the trip, located or not, in capture order (journey log). */
export function mockTripPhotos(id: string, signal?: AbortSignal): Promise<Page<Photo>> {
  const items = photos.filter((p) => p.trip_id === id).sort(byCapture)
  return delay({ items, next_cursor: null }, undefined, signal)
}

const MAP_LIMIT = 2000

function inBBox(p: MapPhoto, bbox: MapPhotoQuery['bbox']): boolean {
  if (!bbox) return true
  const [west, south, east, north] = bbox
  const { lat, lng } = p
  // A box that crosses the antimeridian has west > east.
  const lngOk = west <= east ? lng >= west && lng <= east : lng >= west || lng <= east
  return lngOk && lat >= south && lat <= north
}

function matchesText(p: MapPhoto, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [p.place_name, p.city, p.country, p.trip_title].some((v) => v?.toLowerCase().includes(needle))
}

function matchesDates(p: MapPhoto, from?: string, to?: string): boolean {
  if (!from && !to) return true
  const day = p.capture_time_local?.slice(0, 10)
  // A photo without a capture time cannot satisfy a date filter.
  if (!day) return false
  return (!from || day >= from) && (!to || day <= to)
}

export function mockMapPhotos(query: MapPhotoQuery, signal?: AbortSignal): Promise<MapPhotoPage> {
  const titles = new Map(trips.map((t) => [t.id, t.title]))
  const own: MapPhoto[] = photos.filter(isLocated).map((p) => ({
    id: p.id,
    trip_id: p.trip_id,
    trip_title: titles.get(p.trip_id) ?? '',
    lat: p.lat as number,
    lng: p.lng as number,
    thumb_url: p.thumb_url,
    display_url: p.display_url,
    capture_time_local: p.capture_time_local,
    city: p.city,
    country: p.country,
    place_name: p.place_name,
  }))
  const hits = own
    .filter((p) => !query.trip_id || p.trip_id === query.trip_id)
    .filter((p) => matchesDates(p, query.from, query.to))
    .filter((p) => matchesText(p, query.q ?? ''))
    .filter((p) => inBBox(p, query.bbox))
    .sort(byCapture)
  return delay({ items: hits.slice(0, MAP_LIMIT), truncated: hits.length > MAP_LIMIT }, 150, signal)
}

function city(name: string, country: string, lat: number, lng: number): Place {
  return {
    id: `city-${name.toLowerCase().replace(/\W+/g, '-')}`,
    name,
    // A city-state ("Vatican City") is not labelled twice.
    label: name === country ? name : `${name}, ${country}`,
    kind: 'city',
    lat,
    lng,
    zoom: 12,
    city: name,
    country,
  }
}

function country(name: string, lat: number, lng: number, zoom: number): Place {
  return {
    id: `country-${name.toLowerCase().replace(/\W+/g, '-')}`,
    name,
    label: name,
    kind: 'country',
    lat,
    lng,
    zoom,
    city: null,
    country: name,
  }
}

/** A small gazetteer standing in for the geocoding provider behind /api/places/search. */
const CITIES: Place[] = [
  city('Paris', 'France', 48.8566, 2.3522),
  city('Nice', 'France', 43.7102, 7.262),
  city('London', 'United Kingdom', 51.5072, -0.1276),
  city('Edinburgh', 'United Kingdom', 55.9533, -3.1883),
  city('Dublin', 'Ireland', 53.3498, -6.2603),
  city('Berlin', 'Germany', 52.52, 13.405),
  city('Munich', 'Germany', 48.1351, 11.582),
  city('Rome', 'Italy', 41.9028, 12.4964),
  city('Vatican City', 'Vatican City', 41.9029, 12.4534),
  city('Florence', 'Italy', 43.7696, 11.2558),
  city('Venice', 'Italy', 45.4408, 12.3155),
  city('Milan', 'Italy', 45.4642, 9.19),
  city('Naples', 'Italy', 40.8518, 14.2681),
  city('Helsinki', 'Finland', 60.1699, 24.9384),
  city('Espoo', 'Finland', 60.2055, 24.6559),
  city('Vantaa', 'Finland', 60.2934, 25.0378),
  city('Porvoo', 'Finland', 60.3932, 25.6638),
  city('Tampere', 'Finland', 61.4978, 23.761),
  city('Turku', 'Finland', 60.4518, 22.2666),
  city('Oulu', 'Finland', 65.0121, 25.4651),
  city('Rovaniemi', 'Finland', 66.5039, 25.7294),
  city('Tallinn', 'Estonia', 59.437, 24.7536),
  city('Riga', 'Latvia', 56.9496, 24.1052),
  city('Stockholm', 'Sweden', 59.3293, 18.0686),
  city('Oslo', 'Norway', 59.9139, 10.7522),
  city('Copenhagen', 'Denmark', 55.6761, 12.5683),
  city('Reykjavik', 'Iceland', 64.1466, -21.9426),
  city('Amsterdam', 'Netherlands', 52.3676, 4.9041),
  city('Brussels', 'Belgium', 50.8503, 4.3517),
  city('Zurich', 'Switzerland', 47.3769, 8.5417),
  city('Prague', 'Czechia', 50.0755, 14.4378),
  city('Vienna', 'Austria', 48.2082, 16.3738),
  city('Budapest', 'Hungary', 47.4979, 19.0402),
  city('Warsaw', 'Poland', 52.2297, 21.0122),
  city('Krakow', 'Poland', 50.0647, 19.945),
  city('Athens', 'Greece', 37.9838, 23.7275),
  city('Istanbul', 'Turkey', 41.0082, 28.9784),
  city('Dubrovnik', 'Croatia', 42.6507, 18.0944),
  city('Barcelona', 'Spain', 41.3874, 2.1686),
  city('Madrid', 'Spain', 40.4168, -3.7038),
  city('Seville', 'Spain', 37.3891, -5.9845),
  city('Lisbon', 'Portugal', 38.7223, -9.1393),
  city('Porto', 'Portugal', 41.1579, -8.6291),
  city('New York', 'United States', 40.7128, -74.006),
  city('San Francisco', 'United States', 37.7749, -122.4194),
  city('Los Angeles', 'United States', 34.0522, -118.2437),
  city('Toronto', 'Canada', 43.6532, -79.3832),
  city('Mexico City', 'Mexico', 19.4326, -99.1332),
  city('Rio de Janeiro', 'Brazil', -22.9068, -43.1729),
  city('Cape Town', 'South Africa', -33.9249, 18.4241),
  city('Cairo', 'Egypt', 30.0444, 31.2357),
  city('Dubai', 'United Arab Emirates', 25.2048, 55.2708),
  city('Bangkok', 'Thailand', 13.7563, 100.5018),
  city('Singapore', 'Singapore', 1.3521, 103.8198),
  city('Seoul', 'South Korea', 37.5665, 126.978),
  city('Tokyo', 'Japan', 35.6762, 139.6503),
  city('Kyoto', 'Japan', 35.0116, 135.7681),
  city('Sydney', 'Australia', -33.8688, 151.2093),
  city('Melbourne', 'Australia', -37.8136, 144.9631),
  city('Auckland', 'New Zealand', -36.8485, 174.7633),
]
const COUNTRIES: Place[] = [
  country('France', 46.6, 2.4, 5),
  country('Italy', 42.8, 12.6, 5),
  country('Germany', 51.1, 10.4, 5),
  country('Finland', 64.5, 26, 4),
  country('Sweden', 62, 15, 4),
  country('Norway', 64.5, 12, 4),
  country('Estonia', 58.6, 25, 6),
  country('United Kingdom', 54, -2.5, 5),
  country('Spain', 40.2, -3.6, 5),
  country('Portugal', 39.6, -8, 6),
  country('Greece', 39, 22, 6),
  country('United States', 39.5, -98.5, 3),
  country('Japan', 36.5, 138, 5),
  country('Australia', -25, 134, 4),
]

export function mockSearchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const needle = q.trim().toLowerCase()
  if (needle.length < 2) return delay([], 0, signal)
  const all = [...COUNTRIES, ...CITIES]
  const starts = all.filter((p) => p.name.toLowerCase().startsWith(needle))
  const contains = all.filter((p) => !starts.includes(p) && p.label.toLowerCase().includes(needle))
  return delay([...starts, ...contains].slice(0, 6), 200, signal)
}

/** Great-circle distance in kilometres. */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

interface Labels {
  city: string | null
  country: string | null
  place_name: string | null
  label_status: Photo['label_status']
}

/**
 * Reverse-geocoding stand-in for the resolver (doc 7): the nearest known
 * city labels the point when it is close enough to be believable. Within
 * 15 km the label is taken as is; up to 50 km it is only a suggestion for
 * the owner to confirm; further away the point keeps no label rather than a
 * wrong one.
 */
function resolveLabels(lat: number, lng: number): Labels {
  let best = CITIES[0]
  let bestKm = Infinity
  for (const place of CITIES) {
    const km = distanceKm(lat, lng, place.lat, place.lng)
    if (km < bestKm) {
      best = place
      bestKm = km
    }
  }
  if (bestKm > 50) return { city: null, country: null, place_name: null, label_status: 'pending' }
  return {
    city: best.city,
    country: best.country,
    place_name: best.label,
    label_status: bestKm <= 15 ? 'confirmed' : 'suggested',
  }
}

/**
 * Applies a correction to the one photo row. Every aggregate (Dashboard
 * totals, trip cards, map pins, the place filter) is derived from that row,
 * so they all move together, as doc 3.3 requires. Capture time is untouched.
 */
export function mockPatchLocation(id: string, patch: LocationPatch, signal?: AbortSignal): Promise<Photo> {
  const index = photos.findIndex((p) => p.id === id)
  if (index < 0) return Promise.reject(new NotFoundError('Photo'))
  const current = photos[index]
  let next: Photo
  if ('confirm_label' in patch) {
    if (current.lat === null) return Promise.reject(new Error('Photo has no location to confirm'))
    next = { ...current, label_status: 'confirmed' }
  } else {
    const labels = resolveLabels(patch.lat, patch.lng)
    next = {
      ...current,
      ...labels,
      // The owner chose this spot, so a label found for it is not a mere suggestion.
      label_status: labels.place_name ? 'confirmed' : 'pending',
      state: current.state === 'needs-location' ? 'ready' : current.state,
      lat: patch.lat,
      lng: patch.lng,
      location_source: 'manual',
    }
  }
  photos[index] = next
  return delay(next, undefined, signal)
}

/** Doc 6.1: JPEG and PNG only from Increment 1, at most 25 MB per file. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** How many files of one batch are in flight at once. */
const UPLOAD_CONCURRENCY = 3

/** Photos already registered, by client_file_id, so a repeated upload never duplicates one (doc 7.1). */
const registered = new Map<string, string>()

async function processFile(
  tripId: string,
  client_file_id: string,
  file: File,
  report: (item: UploadItem) => void,
): Promise<void> {
  let item: UploadItem = { client_file_id, file_name: file.name, state: 'pending', error: null, photo: null }
  const existing = photos.find((p) => p.id === registered.get(client_file_id))
  if (existing) {
    report({ ...item, state: existing.state, photo: existing })
    return
  }
  const fail = (error: string) => report({ ...item, state: 'failed', error })
  report(item)

  item = { ...item, state: 'uploading' }
  report(item)
  await delay(null, 300 + Math.random() * 300)

  if (/\.(heic|heif)$/i.test(file.name)) {
    fail('HEIC is not supported yet. Export the photo as JPEG and upload it again.')
    return
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    fail('The file is larger than 25 MB.')
    return
  }

  item = { ...item, state: 'processing' }
  report(item)
  const kind = sniffImageKind(new Uint8Array(await file.slice(0, 8).arrayBuffer()))
  if (!kind) {
    fail('This is not a JPEG or PNG image.')
    return
  }
  // The worker decodes every image (doc 7.1); a file that cannot be decoded fails with a reason.
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
  } catch {
    fail('The image could not be read. The file may be damaged.')
    return
  }
  const meta = await readPhotoMetadata(file, kind)
  await delay(null, 300)

  const located = meta.lat !== null && meta.lng !== null
  const labels: Labels = located
    ? resolveLabels(meta.lat as number, meta.lng as number)
    : { city: null, country: null, place_name: null, label_status: 'pending' }
  const url = URL.createObjectURL(file)
  const row: Photo = {
    id: `p-${client_file_id}`,
    trip_id: tripId,
    state: located ? 'ready' : 'needs-location',
    thumb_url: url,
    display_url: url,
    capture_time_local: meta.captureLocal,
    capture_utc_offset: meta.captureOffset,
    uploaded_at: new Date().toISOString(),
    lat: meta.lat,
    lng: meta.lng,
    ...labels,
    location_source: located ? 'exif' : null,
  }
  photos.push(row)
  registered.set(client_file_id, row.id)
  report({ ...item, state: row.state, photo: row })
}

/**
 * Uploads a batch the way doc 7.1 describes (register the batch, upload each
 * file, complete it so the worker extracts EXIF and labels the place), with
 * `report` receiving every state change. A failed file never stops the rest.
 */
export async function mockUploadPhotos(
  tripId: string,
  files: { client_file_id: string; file: File }[],
  report: (item: UploadItem) => void,
): Promise<void> {
  if (!trips.some((t) => t.id === tripId)) throw new NotFoundError('Trip')
  const queue = [...files]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      await processFile(tripId, next.client_file_id, next.file, report)
    }
  }
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker))
}
