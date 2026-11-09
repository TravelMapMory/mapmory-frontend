/*
 * The only module screens import for data. Each function names the endpoint it
 * stands for (doc 5.2).
 *
 * Endpoints move from the mock to the Go backend one at a time: an endpoint
 * calls the backend when VITE_API_URL is set and it is listed in LIVE below,
 * otherwise it keeps using the mock. Add an endpoint to LIVE once the backend
 * serves it; when all are live, the mock can go.
 */
import { toPhotoPage, toTripDetail, toTripPage, toTripSummary } from './adapters'
import type { ApiPage, ApiPhoto, ApiTrip } from './contract'
import { ApiError, request } from './http'
import { PUBLIC_CLUSTER_LIMIT } from './limits'
import { normalizeBBox } from './publicGrid'
import {
  mockCreateShare,
  mockCreateTrip,
  mockGetTrip,
  mockListShares,
  mockListTrips,
  mockMapPhotos,
  mockPatchLocation,
  mockPublicMap,
  mockPublicShare,
  mockRevokeShare,
  mockSearchPlaces,
  mockSharedCollection,
  mockSummary,
  mockTripPhotos,
  mockUpdateTrip,
  mockUploadPhotos,
} from './mock'
import type {
  CreateShareInput,
  CreateTripInput,
  UpdateTripInput,
  LocationPatch,
  MapPhotoPage,
  MapPhotoQuery,
  MeSummary,
  Page,
  Photo,
  Place,
  PublicMapPage,
  PublicMapQuery,
  Share,
  SharedCollection,
  TripDetail,
  TripSummary,
  UploadItem,
} from './types'

type Endpoint =
  | 'summary'
  | 'listTrips'
  | 'createTrip'
  | 'getTrip'
  | 'updateTrip'
  | 'tripPhotos'
  | 'mapPhotos'
  | 'searchPlaces'
  | 'patchLocation'
  | 'upload'
  | 'listShares'
  | 'createShare'
  | 'revokeShare'
  | 'sharedCollection'
  | 'publicMap'
  | 'publicShare'

/** Endpoints mapmory-backend serves today. */
const LIVE: ReadonlySet<Endpoint> = new Set<Endpoint>(['listTrips', 'createTrip', 'getTrip', 'updateTrip'])

const backendEnabled = Boolean(import.meta.env.VITE_API_URL)

/** Sharing is a mock-only capability until the backend supports public links. */
export const sharingAvailable = !backendEnabled

function mockSharingUnavailable(): ApiError {
  return new ApiError(503, 'not_implemented', 'Persistent sharing is not available yet.')
}

function live(endpoint: Endpoint): boolean {
  return backendEnabled && LIVE.has(endpoint)
}

/** GET /api/me/summary */
export async function getSummary(signal?: AbortSignal): Promise<MeSummary | null> {
  if (live('summary')) {
    return request<MeSummary>('GET', '/api/me/summary', { signal })
  }
  // Real trips without a summary API must not display demo statistics or photos.
  if (live('listTrips')) return null
  return mockSummary(signal)
}

/** GET /api/trips */
export async function listTrips(signal?: AbortSignal): Promise<Page<TripSummary>> {
  const page = live('listTrips') ? await request<ApiPage<ApiTrip>>('GET', '/api/trips', { signal }) : await mockListTrips(signal)
  return toTripPage(page)
}

/** POST /api/trips */
export async function createTrip(input: CreateTripInput): Promise<TripSummary> {
  const trip = live('createTrip') ? await request<ApiTrip>('POST', '/api/trips', { body: input }) : await mockCreateTrip(input)
  return toTripSummary(trip)
}
/** GET /api/trips/{id} */
export async function getTrip(id: string, signal?: AbortSignal): Promise<TripDetail> {
  const trip = live('getTrip')
    ? await request<ApiTrip>('GET', `/api/trips/${encodeURIComponent(id)}`, { signal })
    : await mockGetTrip(id, signal)
  return toTripDetail(trip)
}
/**
 * PATCH /api/trips/{id} — the owner's title and notes. Proposed for the
 * contract (backend #46); 400 for an empty title, 404 for a trip that is
 * missing or not the caller's.
 */
export async function updateTrip(id: string, input: UpdateTripInput): Promise<TripDetail> {
  if (!live('updateTrip')) return mockUpdateTrip(id, input)
  return toTripDetail(await request<ApiTrip>('PATCH', `/api/trips/${encodeURIComponent(id)}`, { body: input }))
}
/** GET /api/trips/{id}/photos — all photos, including ones without a location. */
export async function listTripPhotos(id: string, signal?: AbortSignal): Promise<Page<Photo>> {
  if (live('tripPhotos')) {
    return toPhotoPage(await request<ApiPage<ApiPhoto>>('GET', `/api/trips/${encodeURIComponent(id)}/photos`, { signal }))
  }
  // A real trip whose photos the backend does not serve yet: never mix in demo photos.
  if (live('getTrip')) return { items: [], next_cursor: null }
  return toPhotoPage(await mockTripPhotos(id, signal))
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

/** Sharing remains mock-backed only until the persistent share API exists. */
export function listShares(tripId: string, signal?: AbortSignal): Promise<Share[]> {
  if (!sharingAvailable) return Promise.reject(mockSharingUnavailable())
  return mockListShares(tripId, signal)
}

export function createShare(tripId: string, input: CreateShareInput): Promise<Share> {
  if (!sharingAvailable) return Promise.reject(mockSharingUnavailable())
  return mockCreateShare(tripId, input)
}

export function revokeShare(id: string): Promise<void> {
  if (!sharingAvailable) return Promise.reject(mockSharingUnavailable())
  return mockRevokeShare(id)
}

export function getSharedCollection(token: string, signal?: AbortSignal): Promise<SharedCollection> {
  if (!sharingAvailable) return Promise.reject(mockSharingUnavailable())
  return mockSharedCollection(token, signal)
}

/** A public endpoint the backend does not serve yet: real visitors must never see demo photos. */
function publicUnavailable(): ApiError {
  return new ApiError(503, 'not_implemented', 'The public map is not available yet.')
}

/**
 * GET /api/public/map?bbox=west,south,east,north&zoom=z, callable without
 * signing in. The server groups public photos into grid cells for the zoom
 * and returns at most 200 clusters; the browser trims to that too, so a
 * misbehaving server cannot flood the map.
 */
export async function getPublicMap(query: PublicMapQuery, signal?: AbortSignal): Promise<PublicMapPage> {
  const bbox = normalizeBBox(query.bbox)
  const zoom = Math.round(query.zoom)
  let page: PublicMapPage
  if (live('publicMap')) {
    page = await request<PublicMapPage>('GET', '/api/public/map', {
      query: { bbox: bbox.map((v) => v.toFixed(5)).join(','), zoom },
      signal,
    })
  } else if (backendEnabled) {
    throw publicUnavailable()
  } else {
    page = await mockPublicMap({ bbox, zoom }, signal)
  }
  if (page.clusters.length <= PUBLIC_CLUSTER_LIMIT) return page
  return { clusters: page.clusters.slice(0, PUBLIC_CLUSTER_LIMIT), truncated: true }
}

/** GET /api/public/shares/{id}: the photos of one public share, placed by city. */
export async function getPublicShare(id: string, signal?: AbortSignal): Promise<SharedCollection> {
  if (live('publicShare')) {
    return request<SharedCollection>('GET', `/api/public/shares/${encodeURIComponent(id)}`, { signal })
  }
  if (backendEnabled) throw publicUnavailable()
  return mockPublicShare(id, signal)
}
