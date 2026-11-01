/*
 * Request and response bodies exactly as mapmory-backend's OpenAPI contract
 * defines them (openapi/openapi.yaml, draft 0.0.5). Screens never import this
 * file: adapters.ts turns these shapes into the view models in types.ts, for
 * the mock and the real backend alike.
 *
 * Fields marked "not in the contract yet" are ones the design doc (5.3) needs
 * but the draft does not define. They are optional, so a backend without them
 * still type-checks, and the adapters give them neutral defaults.
 */
import type { LabelStatus } from './types'

/** `DisplayImage`: a temporary signed URL. Refetch the resource after `expires_at`. */
export interface ApiDisplayImage {
  url: string
  /** RFC 3339 instant. */
  expires_at: string
}

/** `TripCover` */
export interface ApiTripCover {
  photo_id: string
  image: ApiDisplayImage
}

/** `Trip`, as GET/POST /api/trips and GET /api/trips/{id} return it. */
export interface ApiTrip {
  id: string
  title: string
  /** "" when the trip has no notes. */
  notes: string
  created_at: string
  photo_count: number
  cover: ApiTripCover | null
  // Aggregates the Dashboard needs; not in the contract yet.
  located_count?: number
  cities?: string[]
  countries?: string[]
  start_date?: string | null
  end_date?: string | null
  visibility?: 'private' | 'public'
}

/** `CreateTrip`, the POST /api/trips body. */
export interface ApiCreateTrip {
  title: string
  notes?: string
}

/** `PhotoState` */
export type ApiPhotoState = 'pending' | 'uploading' | 'processing' | 'ready' | 'needs-location' | 'failed'

/**
 * `Photo`, the owner's view of one photo. Each coordinate pair is set or null
 * as a whole; `exif_*` never changes after import, `lat`/`lng` are the
 * effective position after any correction.
 */
export interface ApiPhoto {
  id: string
  trip_id: string
  batch_id: string
  client_file_id: string
  state: ApiPhotoState
  error_code: string | null
  uploaded_at: string | null
  /** Camera wall time without offset, e.g. "2025-07-14T09:30:00". */
  capture_time_local: string | null
  /** e.g. "+09:00" */
  capture_utc_offset: string | null
  exif_lat: number | null
  exif_lng: number | null
  lat: number | null
  lng: number | null
  display_image: ApiDisplayImage | null
  // Place labels (doc 5.3); not in the contract yet.
  country?: string | null
  city?: string | null
  place_name?: string | null
  label_status?: LabelStatus
}

/** `TripPage`, `PhotoPage`: every list endpoint pages with an opaque cursor. */
export interface ApiPage<T> {
  items: T[]
  next_cursor: string | null
}

/** `Batch`, GET /api/batches/{id}: restores upload status after a reload. */
export interface ApiBatch {
  id: string
  trip_id: string
  photos: ApiPhoto[]
}

/** `UploadFile`, one entry of the POST /api/trips/{id}/batches body. */
export interface ApiUploadFile {
  client_file_id: string
  size_bytes: number
  content_type: string
}

/** `RegisterUpload`, the POST /api/trips/{id}/batches body. */
export interface ApiRegisterUpload {
  files: ApiUploadFile[]
}

/** `UploadTarget`: where the browser PUTs the bytes. No Firebase token goes to GCS. */
export interface ApiUploadTarget {
  method: 'PUT'
  url: string
  headers: Record<string, string>
  expires_at: string
}

/** `AcceptedFile` */
export interface ApiAcceptedFile {
  client_file_id: string
  photo_id: string
  upload: ApiUploadTarget
}

/** `UploadRejectionCode` */
export type ApiUploadRejectionCode = 'unsupported_type' | 'file_too_large'

/** `RejectedFile`: refused at registration, so it never becomes a photo. */
export interface ApiRejectedFile {
  client_file_id: string
  error: { code: ApiUploadRejectionCode; message: string }
}

/** `RegisteredBatch`: each requested file appears in exactly one of the two lists. */
export interface ApiRegisteredBatch {
  batch_id: string
  accepted_files: ApiAcceptedFile[]
  rejected_files: ApiRejectedFile[]
}

/** `Error`: the body of every non-2xx answer. */
export interface ApiErrorBody {
  error: { code: string; message: string }
}
