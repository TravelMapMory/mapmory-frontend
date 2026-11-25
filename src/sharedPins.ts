import type { SharedPhoto } from './api/types'

/** Pins represent only the coordinates explicitly approved for sharing. */
export interface SharedPin {
  key: string
  city: string
  lat: number
  lng: number
  photos: SharedPhoto[]
}

export function sharedPins(photos: SharedPhoto[]): SharedPin[] {
  const pins = new Map<string, SharedPin>()
  for (const photo of photos) {
    const { display_lat: lat, display_lng: lng } = photo
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue
    // Never group different coarse positions just because they lack city names.
    const key = JSON.stringify([photo.city ?? null, photo.country ?? null, lat, lng])
    const pin = pins.get(key) ?? { key, city: photo.city || 'Approximate location', lat, lng, photos: [] }
    pin.photos.push(photo)
    pins.set(key, pin)
  }
  return [...pins.values()]
}
