/*
 * The only module screens import for data. Each function names the endpoint it
 * stands for (doc 5.2). The mock uses frontend view models; backend integration
 * also needs contract adapters, authentication, pagination and upload recovery.
 */
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

/** GET /api/me/summary */
export function getSummary(signal?: AbortSignal): Promise<MeSummary> {
  return mockSummary(signal)
}

/** GET /api/trips */
export function listTrips(signal?: AbortSignal): Promise<Page<TripSummary>> {
  return mockListTrips(signal)
}

/** POST /api/trips */
export function createTrip(input: CreateTripInput): Promise<TripSummary> {
  return mockCreateTrip(input)
}
/** GET /api/trips/{id} */
export function getTrip(id: string, signal?: AbortSignal): Promise<TripDetail> {
  return mockGetTrip(id, signal)
}
/** GET /api/trips/{id}/photos — all photos, including ones without a location. */
export function listTripPhotos(id: string, signal?: AbortSignal): Promise<Page<Photo>> {
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
