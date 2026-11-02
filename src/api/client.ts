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
import type { ApiBatch, ApiPage, ApiPhoto, ApiRegisteredBatch, ApiRegisterUpload, ApiTrip } from './contract'
import { addRegistration, hasOpenRegistrations, loadRegistrations, updateRegistration } from './uploadRegistry'
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
    // The screens order the whole trip by capture time, so load every page.
    const items: ApiPhoto[] = []
    let cursor: string | null = null
    do {
      const page: ApiPage<ApiPhoto> = await request<ApiPage<ApiPhoto>>('GET', `/api/trips/${encodeURIComponent(id)}/photos`, {
        query: { limit: 100, cursor },
        signal,
      })
      items.push(...page.items)
      cursor = page.next_cursor
    } while (cursor)
    return toPhotoPage({ items, next_cursor: null })
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

/** A signed upload URL is only used while it has at least this long left. */
const UPLOAD_URL_MARGIN_MS = 60_000
const UPLOAD_CONCURRENCY = 3
const INTERRUPTED = 'The upload was interrupted. Choose the file again to finish it.'

function isFinal(state: UploadItem['state']): boolean {
  return state === 'ready' || state === 'needs-location' || state === 'failed'
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Registers files with POST /api/trips/{id}/batches and remembers each
 * accepted one. Rejected files are returned with their reason.
 */
async function registerFiles(
  tripId: string,
  files: { client_file_id: string; file: File }[],
): Promise<ApiRegisteredBatch> {
  const body: ApiRegisterUpload = {
    files: files.map(({ client_file_id, file }) => ({
      client_file_id,
      size_bytes: file.size,
      content_type: file.type || 'application/octet-stream',
    })),
  }
  const batch = await request<ApiRegisteredBatch>('POST', `/api/trips/${encodeURIComponent(tripId)}/batches`, { body })
  const names = new Map(files.map((f) => [f.client_file_id, f.file.name]))
  for (const accepted of batch.accepted_files) {
    addRegistration(tripId, accepted.client_file_id, {
      batch_id: batch.batch_id,
      photo_id: accepted.photo_id,
      file_name: names.get(accepted.client_file_id) ?? accepted.client_file_id,
      upload: accepted.upload,
      registered_at: new Date().toISOString(),
      finished: false,
    })
  }
  return batch
}

/** GET /api/batches/{id} until the photo leaves processing, for a concurrent /complete. */
async function waitForPhoto(batchId: string, clientFileId: string): Promise<ApiPhoto> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const batch = await request<ApiBatch>('GET', `/api/batches/${encodeURIComponent(batchId)}`)
    const photo = batch.photos.find((p) => p.client_file_id === clientFileId)
    if (photo && isFinal(photo.state)) return photo
  }
  throw new Error('The photo is still being processed. Try again in a minute.')
}

/**
 * Sends one registered file: PUT to its signed URL while the URL is still
 * valid, then /complete. /complete never reprocesses a finished photo, so
 * repeating this after any failure is safe. Only when the URL has expired
 * and the bytes never arrived is the file registered again.
 */
async function sendFile(
  tripId: string,
  clientFileId: string,
  file: File,
  update: (change: Partial<UploadItem>) => void,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const registration = loadRegistrations(tripId)[clientFileId]
    const urlUsable = Date.parse(registration.upload.expires_at) - Date.now() > UPLOAD_URL_MARGIN_MS
    if (urlUsable) {
      update({ state: 'uploading', error: null })
      const { method, url, headers } = registration.upload
      const response = await fetch(url, { method, headers, body: file })
      if (!response.ok) throw new Error(`The upload to Cloud Storage failed (${response.status}). Try again.`)
    }
    update({ state: 'processing', error: null })
    const path = `/api/batches/${encodeURIComponent(registration.batch_id)}/files/${encodeURIComponent(clientFileId)}/complete`
    let photo: ApiPhoto
    try {
      photo = await request<ApiPhoto>('POST', path)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'processing_in_progress') {
        photo = await waitForPhoto(registration.batch_id, clientFileId)
      } else if (error instanceof ApiError && error.code === 'upload_missing' && !urlUsable && attempt === 0) {
        // The old URL expired before the bytes arrived: register the file again.
        updateRegistration(tripId, clientFileId, null)
        const batch = await registerFiles(tripId, [{ client_file_id: clientFileId, file }])
        const rejected = batch.rejected_files[0]
        if (rejected) throw new Error(uploadErrorMessage(rejected.error.code), { cause: error })
        continue
      } else {
        throw error
      }
    }
    updateRegistration(tripId, clientFileId, { finished: isFinal(photo.state) })
    update(toUploadItem(photo, registration.file_name))
    return
  }
}

/**
 * Registers new files, PUTs each accepted file to its signed Cloud Storage
 * URL (the browser sends no Firebase token there), then asks the backend to
 * process it. A file this browser already registered for the trip is not
 * registered again (see uploadRegistry.ts). Rejected files and failures are
 * reported per file, so one bad file never stops the others.
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

  const known = loadRegistrations(tripId)
  const fresh = files.filter((f) => !known[f.client_file_id])
  if (fresh.length > 0) {
    try {
      const batch = await registerFiles(tripId, fresh)
      for (const rejected of batch.rejected_files) {
        update(rejected.client_file_id, { state: 'failed', error: uploadErrorMessage(rejected.error.code) })
      }
    } catch (error) {
      for (const { client_file_id } of fresh) update(client_file_id, { state: 'failed', error: messageOf(error, 'Registration failed.') })
    }
  }

  const registered = loadRegistrations(tripId)
  const queue = files.filter((f) => registered[f.client_file_id])
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const id = next.client_file_id
      try {
        await sendFile(tripId, id, next.file, (change) => update(id, change))
      } catch (error) {
        update(id, { state: 'failed', error: messageOf(error, 'The upload failed. Try again.') })
      }
    }
  }
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker))
}

/** Whether this browser has uploads for the trip that did not finish, e.g. before a reload. */
export function hasUnfinishedUploads(tripId: string): boolean {
  return live('upload') && hasOpenRegistrations(tripId)
}

/**
 * Upload rows to show again after a reload: the backend state of every file
 * this browser registered for the trip but did not see finish (issue #31).
 * A file whose bytes never arrived needs to be chosen again; the same file
 * then resumes its registration instead of creating a new photo.
 */
export async function restoreUploads(tripId: string, signal?: AbortSignal): Promise<UploadItem[]> {
  if (!live('upload')) return []
  const open = Object.entries(loadRegistrations(tripId)).filter(([, entry]) => !entry.finished)
  const batchIds = [...new Set(open.map(([, entry]) => entry.batch_id))]
  const batches = new Map<string, ApiBatch | null>()
  for (const id of batchIds) {
    try {
      batches.set(id, await request<ApiBatch>('GET', `/api/batches/${encodeURIComponent(id)}`, { signal }))
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) batches.set(id, null)
      else throw error
    }
  }
  const items: UploadItem[] = []
  for (const [clientFileId, entry] of open) {
    const photo = batches.get(entry.batch_id)?.photos.find((p) => p.client_file_id === clientFileId)
    if (!photo) {
      updateRegistration(tripId, clientFileId, null)
      continue
    }
    if (isFinal(photo.state)) {
      updateRegistration(tripId, clientFileId, { finished: true })
      items.push(toUploadItem(photo, entry.file_name))
    } else if (photo.state === 'processing') {
      items.push({ ...toUploadItem(photo, entry.file_name), state: 'processing' })
    } else {
      // No photo attached: the panel would otherwise show the gallery's pending state.
      items.push({ client_file_id: clientFileId, file_name: entry.file_name, state: 'failed', error: INTERRUPTED, photo: null })
    }
  }
  return items
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
