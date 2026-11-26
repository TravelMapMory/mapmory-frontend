import { expect, test } from '@playwright/test'
import { photoLocationLabel, photoPlaceName } from '../../src/photoLocation'
import type { Photo } from '../../src/api/types'

const base: Photo = {
  id: 'photo-1', trip_id: 'trip-1', state: 'ready', error_code: null,
  thumb_url: null, display_url: null, image_expires_at: null,
  capture_time_local: null, capture_utc_offset: null, uploaded_at: null,
  lat: 60.2, lng: 24.7, country: 'Finland', city: 'Espoo',
  place_name: null, label_attribution: null, label_status: 'confirmed',
  location_source: 'manual',
}

test('a located photo without a specific place name displays its city', () => {
  expect(photoLocationLabel(base)).toBe('Espoo')
  expect(photoPlaceName(base)).toBe('Espoo')
})

test('specific places take precedence over city labels', () => {
  expect(photoLocationLabel({ ...base, place_name: 'Otaniemi' })).toBe('Otaniemi')
})

test('country and coordinate-only fallbacks distinguish known and missing locations', () => {
  expect(photoLocationLabel({ ...base, city: null })).toBe('Finland')
  expect(photoLocationLabel({ ...base, city: null, country: null })).toBe('Location set')
  expect(photoLocationLabel({ ...base, lat: null, lng: null })).toBe('No location')
  expect(photoPlaceName({ ...base, lat: null, lng: null })).toBeNull()
})
