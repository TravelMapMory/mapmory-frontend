import type { Photo } from './api/types'

/** A named place, when available. Coordinates alone are not a place name. */
export function photoPlaceName(photo: Photo): string | null {
  if (photo.lat === null || photo.lng === null) return null
  return photo.place_name || photo.city || photo.country || null
}

/** A location-aware display label shared by the dashboard, gallery and viewer. */
export function photoLocationLabel(photo: Photo): string {
  if (photo.lat === null || photo.lng === null) return 'No location'
  return photoPlaceName(photo) ?? 'Location set'
}
