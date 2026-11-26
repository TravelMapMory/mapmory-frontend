import type { Photo } from './api/types'

type LocatedFields = Pick<Photo, 'lat' | 'lng' | 'place_name' | 'city' | 'country'>

/** A named place, when available. Coordinates alone are not a place name. */
export function photoPlaceName(photo: LocatedFields): string | null {
  if (photo.lat === null || photo.lng === null) return null
  return photo.place_name || photo.city || photo.country || null
}

/** A location-aware display label shared by the dashboard, gallery and viewer. */
export function photoLocationLabel(photo: LocatedFields): string {
  if (photo.lat === null || photo.lng === null) return 'No location'
  return photoPlaceName(photo) ?? 'Location set'
}

/** Only an existing named suggestion can be confirmed without changing coordinates. */
export function suggestedPhotoPlaceName(photo: LocatedFields & Pick<Photo, 'label_status'>): string | null {
  return photo.label_status === 'suggested' ? photoPlaceName(photo) : null
}
