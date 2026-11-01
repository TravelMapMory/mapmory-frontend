/*
 * The only module screens import for data. Each function names the endpoint it
 * stands for (doc 5.2).
 *
 * Endpoints move from the mock to the Go backend one at a time: an endpoint
 * calls the backend when VITE_API_URL is set and it is listed in LIVE below,
 * otherwise it keeps using the mock. Add an endpoint to LIVE once the backend
 * serves it; when all are live, the mock can go.
 */
import { toPhotoPage, toTripDetail, toTripPage, toTripSummary, toUploadItem, uploadErrorMessage } from './adapters'
import type { ApiPage, ApiPhoto, ApiRegisteredBatch, ApiRegisterUpload, ApiTrip } from './contract'
import { ApiError, request } from './http'
import {
  mockCreateShare,
  mockCreateTrip,
  mockGetTrip,
  mockListShares,
  mockListTrips,
  mockMapPhotos,
  mockPatchLocation,
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

/** Endpoints mapmory-backend serves today. */
const LIVE: ReadonlySet<Endpoint> = new Set<Endpoint>(['listTrips', 'createTrip', 'getTrip', 'updateTrip', 'upload', 'tripPhotos'])

const backendEnabled = Boolean(import.meta.env.VITE_API_URL)

/** Sharing is a mock-only capability until the backend supports public links. */
export const sharingAvailable = !backendEnabled

function locationCorrectionUnavailable(): ApiError {
  return new ApiError(503, 'not_implemented', 'Correcting a photo location is not available yet.')
}

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
  // Real photos are not in the mock; correction waits for backend #43.
  if (live('tripPhotos')) return Promise.reject(locationCorrectionUnavailable())
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
  if (live('upload')) return liveUploadPhotos(tripId, files, onUpdate)
  return mockUploadPhotos(tripId, files, onUpdate)
}

/**
 * Registers the batch, PUTs each accepted file to its signed Cloud Storage
 * URL (the browser sends no Firebase token there), then asks the backend to
 * process it. Rejected files and failed uploads are reported per file, so
 * one bad file never stops the others.
 */
async function liveUploadPhotos(
  tripId: string,
  files: { client_file_id: string; file: File }[],
  report: (item: UploadItem) => void,
): Promise<void> {
  const items = new Map<string, UploadItem>()
  const update = (id: string, change: Partial<UploadItem>) => {
    const item = { ...items.get(id)!, ...change }
    items.set(id, item)
    report(item)
  }
  for (const { client_file_id, file } of files) {
    items.set(client_file_id, { client_file_id, file_name: file.name, state: 'pending', error: null, photo: null })
    report(items.get(client_file_id)!)
  }

  const body: ApiRegisterUpload = {
    files: files.map(({ client_file_id, file }) => ({
      client_file_id,
      size_bytes: file.size,
      content_type: file.type || 'application/octet-stream',
    })),
  }
  let batch: ApiRegisteredBatch
  try {
    batch = await request<ApiRegisteredBatch>('POST', `/api/trips/${encodeURIComponent(tripId)}/batches`, { body })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.'
    for (const { client_file_id } of files) update(client_file_id, { state: 'failed', error: message })
    return
  }
  for (const rejected of batch.rejected_files) {
    update(rejected.client_file_id, { state: 'failed', error: uploadErrorMessage(rejected.error.code) })
  }

  const byId = new Map(files.map((f) => [f.client_file_id, f.file]))
  const queue = [...batch.accepted_files]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { client_file_id, upload } = next
      update(client_file_id, { state: 'uploading' })
      try {
        const response = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: byId.get(client_file_id) })
        if (!response.ok) throw new Error(`Cloud Storage answered ${response.status}.`)
        update(client_file_id, { state: 'processing' })
        const photo = await request<ApiPhoto>(
          'POST',
          `/api/batches/${encodeURIComponent(batch.batch_id)}/files/${encodeURIComponent(client_file_id)}/complete`,
        )
        const item = toUploadItem(photo, items.get(client_file_id)!.file_name)
        update(client_file_id, item)
      } catch (error) {
        update(client_file_id, { state: 'failed', error: error instanceof Error ? error.message : 'Upload failed.' })
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
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
