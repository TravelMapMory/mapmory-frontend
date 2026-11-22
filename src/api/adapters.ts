/*
 * Converts contract-shaped JSON (contract.ts) into the view models in
 * types.ts. The mock and the real backend both answer in contract shapes and
 * both go through these functions, so the screens see one format. The
 * backend grows one endpoint at a time, so fields it does not send yet get
 * neutral defaults here instead of breaking the screens.
 */
import type { ApiBatch, ApiPage, ApiPhoto, ApiRejectedFile, ApiTrip } from './contract'
import type { LocationSource, Page, Photo, TripDetail, TripSummary, UploadItem } from './types'

export type { ApiTrip } from './contract'

export function toTripSummary(trip: ApiTrip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    // The backend sends "" for a trip without notes.
    notes: trip.notes ? trip.notes : null,
    created_at: trip.created_at,
    cover_url: trip.cover?.image.url ?? null,
    cover_expires_at: trip.cover?.image.expires_at ?? null,
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
export function toTripPage(page: ApiPage<ApiTrip>): Page<TripSummary> {
  return { items: page.items.map(toTripSummary), next_cursor: page.next_cursor }
}

/** Backend GET /api/trips/{id} uses the same shape as the list item. */
export function toTripDetail(trip: ApiTrip): TripDetail {
  return { ...toTripSummary(trip), cover_photo_id: trip.cover?.photo_id ?? null }
}

/**
 * Where the effective position came from. The contract keeps the EXIF pair
 * unchanged after import, so a position that differs from it (or exists
 * without it) was set by the owner.
 */
function locationSource(photo: ApiPhoto): LocationSource | null {
  if (photo.lat === null || photo.lng === null) return null
  return photo.lat === photo.exif_lat && photo.lng === photo.exif_lng ? 'exif' : 'manual'
}

export function toPhoto(photo: ApiPhoto): Photo {
  const placeName = photo.place_name ?? null
  return {
    id: photo.id,
    trip_id: photo.trip_id,
    state: photo.state,
    error_code: photo.error_code,
    // The contract has one display rendition; it serves as the thumbnail until a smaller one exists.
    thumb_url: photo.display_image?.url ?? null,
    display_url: photo.display_image?.url ?? null,
    image_expires_at: photo.display_image?.expires_at ?? null,
    capture_time_local: photo.capture_time_local,
    capture_utc_offset: photo.capture_utc_offset,
    uploaded_at: photo.uploaded_at,
    lat: photo.lat,
    lng: photo.lng,
    country: photo.country ?? null,
    city: photo.city ?? null,
    place_name: placeName,
    // Without labels from the server there is nothing to confirm yet.
    label_status: photo.label_status ?? (placeName ? 'confirmed' : 'pending'),
    location_source: locationSource(photo),
  }
}

export function toPhotoPage(page: ApiPage<ApiPhoto>): Page<Photo> {
  return { items: page.items.map(toPhoto), next_cursor: page.next_cursor }
}

/** Readable text for an upload rejection or processing error code. */
export function uploadErrorMessage(code: string): string {
  switch (code) {
    case 'unsupported_type':
      return 'This is not a JPEG or PNG image.'
    case 'file_too_large':
      return 'The file is larger than 25 MB.'
    case 'invalid_image':
      return 'The image could not be read. The file may be damaged.'
    default:
      return 'The photo could not be processed. Try again.'
  }
}

/** A registered photo as one row of the upload list. */
export function toUploadItem(photo: ApiPhoto, fileName: string): UploadItem {
  return {
    client_file_id: photo.client_file_id,
    file_name: fileName,
    state: photo.state,
    error: photo.state === 'failed' ? uploadErrorMessage(photo.error_code ?? '') : null,
    photo: toPhoto(photo),
  }
}

/** A file refused at registration: it never became a photo, so it is failed for good. */
export function toRejectedUploadItem(file: ApiRejectedFile, fileName: string): UploadItem {
  return {
    client_file_id: file.client_file_id,
    file_name: fileName,
    state: 'failed',
    error: uploadErrorMessage(file.error.code),
    photo: null,
  }
}

/**
 * GET /api/batches/{id} after a reload: the browser no longer knows the file
 * names, so `fileNames` maps the ones it still has and the rest fall back to
 * the client file id.
 */
export function toBatchItems(batch: ApiBatch, fileNames: ReadonlyMap<string, string> = new Map()): UploadItem[] {
  return batch.photos.map((photo) => toUploadItem(photo, fileNames.get(photo.client_file_id) ?? photo.client_file_id))
}
