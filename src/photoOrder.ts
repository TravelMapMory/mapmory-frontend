import { parseCaptureTime } from './captureTime'

/*
 * Photo ordering (frontend #25), the one set of rules every list uses. The API
 * returns photos already in this order; the screens sort again so a page,
 * a correction or an upload can never leave a list half-ordered.
 *
 * Capture order: by the camera's local wall time, oldest first. It is not
 * converted to UTC, because many photos have no offset and the journey groups
 * by the local day the photo was taken. Photos without a usable capture time
 * come last. Ties go to the earlier upload, then to the photo id, so equal
 * times always come out in the same order.
 *
 * Upload order (Recently uploaded): newest upload first, ties by photo id.
 */

interface Orderable {
  id: string
  capture_time_local: string | null
  /** Optional: map markers do not carry it. Null until the upload completes. */
  uploaded_at?: string | null
}

/** The capture time when the file had a valid one, else null (missing or malformed EXIF). */
export function captureTime(photo: Pick<Orderable, 'capture_time_local'>): string | null {
  return parseCaptureTime(photo.capture_time_local) ? photo.capture_time_local : null
}

/** The local calendar day the photo was taken ("2026-06-01"), or null when unknown. */
export function captureDay(photo: Pick<Orderable, 'capture_time_local'>): string | null {
  return captureTime(photo)?.slice(0, 10) ?? null
}

function byId(a: Orderable, b: Orderable): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Missing values sort last in either direction. */
function compareMissingLast(a: string | null | undefined, b: string | null | undefined, direction: 1 | -1): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -direction : direction
}

/** Gallery, journey, viewer and map order. */
export function compareByCapture(a: Orderable, b: Orderable): number {
  return (
    compareMissingLast(captureTime(a), captureTime(b), 1) ||
    compareMissingLast(a.uploaded_at, b.uploaded_at, 1) ||
    byId(a, b)
  )
}

/** Recently uploaded: newest first. */
export function compareByUpload(a: Orderable, b: Orderable): number {
  return compareMissingLast(a.uploaded_at, b.uploaded_at, -1) || byId(a, b)
}

export function sortByCapture<T extends Orderable>(photos: readonly T[]): T[] {
  return [...photos].sort(compareByCapture)
}

export function sortByUpload<T extends Orderable>(photos: readonly T[]): T[] {
  return [...photos].sort(compareByUpload)
}
