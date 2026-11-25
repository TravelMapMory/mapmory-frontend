import { expect, test } from '@playwright/test'
import { sharedPins } from '../../src/sharedPins'
import type { SharedPhoto } from '../../src/api/types'

function photo(id: string, city: string | null, lat: number | null, lng: number | null): SharedPhoto {
  return {
    id, city, country: city ? 'Japan' : null,
    display_lat: lat, display_lng: lng,
    display_url: null, thumb_url: null, capture_time_local: null,
  }
}

test('photos without a city still appear at their approximate shared positions', () => {
  const pins = sharedPins([photo('a', null, 35.04, 135.71), photo('b', null, 35.05, 135.72)])
  expect(pins).toHaveLength(2)
  expect(pins.map((p) => [p.city, p.lat, p.lng])).toEqual([
    ['Approximate location', 35.04, 135.71],
    ['Approximate location', 35.05, 135.72],
  ])
})

test('photos at the same coarse place share a pin without exposing any other coordinates', () => {
  const pins = sharedPins([
    photo('a', 'Kyoto', 35.01, 135.77),
    photo('b', 'Kyoto', 35.01, 135.77),
    photo('c', null, 35.04, 135.71),
    photo('d', null, 35.04, 135.71),
    photo('no-position', null, null, null),
  ])
  expect(pins).toHaveLength(2)
  expect(pins.map((p) => p.photos.map((item) => item.id))).toEqual([['a', 'b'], ['c', 'd']])
})

test('different coordinates are never combined just because the city name matches', () => {
  const pins = sharedPins([photo('a', 'Kyoto', 35.01, 135.77), photo('b', 'Kyoto', 35.05, 135.72)])
  expect(pins).toHaveLength(2)
})
