/*
 * The only module screens import for data. Each function names the endpoint it
 * stands for (doc 5.2).
 *
 * Endpoints move from the mock to the Go backend one at a time: an endpoint
 * calls the backend when VITE_API_URL is set and it is listed in LIVE below,
 * otherwise it keeps using the mock. Add an endpoint to LIVE once the backend
 * serves it; when all are live, the mock can go.
 */
import { toTripDetail, toTripPage, toTripSummary, type ApiTrip } from './adapters'
import { request } from './http'
import {
  mockCreateTrip,
  mockGetTrip,
  mockListTrips,
  mockMapPhotos,
  mockPatchLocation,
  mockSearchPlaces,
  mockSummary,
  mockTripPhotos,
  mockUploadPhotos,
} from './mock'
import type {
  CreateTripInput,
  LocationPatch,
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

type Endpoint =
  | 'summary'
  | 'listTrips'
  | 'createTrip'
  | 'getTrip'
  | 'tripPhotos'
  | 'mapPhotos'
  | 'searchPlaces'
  | 'patchLocation'
  | 'upload'

/** Endpoints mapmory-backend serves today. */
const LIVE: ReadonlySet<Endpoint> = new Set<Endpoint>(['listTrips', 'createTrip', 'getTrip'])

const backendEnabled = Boolean(import.meta.env.VITE_API_URL)

function live(endpoint: Endpoint): boolean {
  return backendEnabled && LIVE.has(endpoint)
}

/** GET /api/me/summary */
export function getSummary(signal?: AbortSignal): Promise<MeSummary> {
  return mockSummary(signal)
}

/** GET /api/trips */
export async function listTrips(signal?: AbortSignal): Promise<Page<TripSummary>> {
  if (!live('listTrips')) return mockListTrips(signal)
  return toTripPage(await request<Page<ApiTrip>>('GET', '/api/trips', { signal }))
}

/** POST /api/trips */
export async function createTrip(input: CreateTripInput): Promise<TripSummary> {
  if (!live('createTrip')) return mockCreateTrip(input)
  return toTripSummary(await request<ApiTrip>('POST', '/api/trips', { body: input }))
}
/** GET /api/trips/{id} */
export async function getTrip(id: string, signal?: AbortSignal): Promise<TripDetail> {
  if (!live('getTrip')) return mockGetTrip(id, signal)
  return toTripDetail(await request<ApiTrip>('GET', `/api/trips/${encodeURIComponent(id)}`, { signal }))
}
/** GET /api/trips/{id}/photos — all photos, including ones without a location. */
export function listTripPhotos(id: string, signal?: AbortSignal): Promise<Page<Photo>> {
  // Photos are not served by the backend yet. Never mix demo photos with a real trip.
  if (live('getTrip')) return Promise.resolve({ items: [], next_cursor: null })
  return mockTripPhotos(id, signal)
}
/** GET /api/map/photos — the owner's located photos in the bbox, at most 2,000. */
export function getMapPhotos(query: MapPhotoQuery, signal?: AbortSignal): Promise<MapPhotoPage> {
  return mockMapPhotos(query, signal)
}
/** GET /api/places/search — world places, callable without signing in. */
export function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  return mockSearchPlaces(q, signal)
}
/** PATCH /api/photos/{id}/location */
export function patchPhotoLocation(id: string, patch: LocationPatch): Promise<Photo> {
  return mockPatchLocation(id, patch)
}
/**
 * Upload flow (doc 7.1): POST /api/trips/{id}/batches registers the files,
 * each one is PUT to its signed Cloud Storage URL, then
 * POST /api/batches/{id}/files/{client_file_id}/complete makes the server
 * extract EXIF and label the place. `onUpdate` receives every state change;
 * after a reload the state comes from GET /api/batches/{id}.
 */
export function uploadPhotos(
  tripId: string,
  files: { client_file_id: string; file: File }[],
  onUpdate: (item: UploadItem) => void,
): Promise<void> {
  return mockUploadPhotos(tripId, files, onUpdate)
}
