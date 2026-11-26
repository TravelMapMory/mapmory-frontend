import { expect, test } from '@playwright/test'
import {
  toBatchItems,
  toMapPhotoPage,
  toPhoto,
  toPhotoPage,
  toPlace,
  toRejectedUploadItem,
  toShare,
  toSharedCollection,
  toSummary,
  toTripDetail,
  toUploadItem,
  uploadErrorMessage,
} from '../../src/api/adapters'
import type { ApiMapPhotoPage, ApiMeSummary, ApiPhoto, ApiPlace, ApiShare, ApiSharedCollection, ApiTrip } from '../../src/api/contract'

// Baseline photo from the earlier API contract, without optional
// place-label fields added in OpenAPI 0.0.8.
const contractPhoto: ApiPhoto = {
  id: '0b8f6a0e-1c62-4f0b-9d55-3f1f7e0c2a10',
  trip_id: '6f1c0f62-4c1e-4a59-9a43-6b2f0a3e8c11',
  batch_id: '3a0d1c55-9e8b-4b7c-8f1e-2d6c5b4a3f21',
  client_file_id: 'file-1',
  state: 'ready',
  error_code: null,
  uploaded_at: '2026-10-14T10:05:00Z',
  capture_time_local: '2026-10-12T09:30:00',
  capture_utc_offset: '+09:00',
  exif_lat: 35.0116,
  exif_lng: 135.7681,
  lat: 35.0116,
  lng: 135.7681,
  display_image: { url: 'https://storage.test/display.jpg', expires_at: '2026-10-14T11:05:00Z' },
}

test('a contract photo becomes a view photo with image expiry and neutral labels', () => {
  expect(toPhoto(contractPhoto)).toEqual({
    id: contractPhoto.id,
    trip_id: contractPhoto.trip_id,
    state: 'ready',
    error_code: null,
    thumb_url: 'https://storage.test/display.jpg',
    display_url: 'https://storage.test/display.jpg',
    image_expires_at: '2026-10-14T11:05:00Z',
    capture_time_local: '2026-10-12T09:30:00',
    capture_utc_offset: '+09:00',
    uploaded_at: '2026-10-14T10:05:00Z',
    lat: 35.0116,
    lng: 135.7681,
    country: null,
    city: null,
    place_name: null,
    label_attribution: null,
    label_status: 'pending',
    location_source: 'exif',
  })
})

test('nullable contract fields stay null rather than becoming empty values', () => {
  const pending: ApiPhoto = {
    ...contractPhoto,
    state: 'pending',
    uploaded_at: null,
    capture_time_local: null,
    capture_utc_offset: null,
    exif_lat: null,
    exif_lng: null,
    lat: null,
    lng: null,
    display_image: null,
  }
  expect(toPhoto(pending)).toMatchObject({
    thumb_url: null,
    display_url: null,
    image_expires_at: null,
    uploaded_at: null,
    capture_time_local: null,
    capture_utc_offset: null,
    lat: null,
    lng: null,
    location_source: null,
  })
  expect(toPhoto(pending).label_attribution).toBeNull()
})

test('a position that differs from the EXIF one, or has none, is a manual correction', () => {
  expect(toPhoto({ ...contractPhoto, lat: 35.0, lng: 135.7 }).location_source).toBe('manual')
  expect(toPhoto({ ...contractPhoto, exif_lat: null, exif_lng: null }).location_source).toBe('manual')
})

test('place labels pass through once the backend sends them', () => {
  const labelled = toPhoto({ ...contractPhoto, country: 'Japan', city: 'Kyoto', place_name: 'Kyoto, Japan', label_status: 'suggested' })
  expect(labelled).toMatchObject({ country: 'Japan', city: 'Kyoto', place_name: 'Kyoto, Japan', label_status: 'suggested' })
  // A label without a status is taken as the resolver's final answer.
  expect(toPhoto({ ...contractPhoto, place_name: 'Kyoto, Japan' }).label_status).toBe('confirmed')
})

test('a photo page keeps the server order and cursor', () => {
  const second = { ...contractPhoto, id: 'second' }
  const page = toPhotoPage({ items: [contractPhoto, second], next_cursor: 'c2' })
  expect(page.items.map((p) => p.id)).toEqual([contractPhoto.id, 'second'])
  expect(page.next_cursor).toBe('c2')
})

test('trip detail exposes the cover photo id and image expiry', () => {
  const trip: ApiTrip = {
    id: 't1',
    title: 'Kyoto',
    notes: '',
    created_at: '2026-10-14T10:00:00Z',
    photo_count: 1,
    cover: { photo_id: contractPhoto.id, image: { url: 'https://storage.test/c.jpg', expires_at: '2026-10-14T11:00:00Z' } },
  }
  expect(toTripDetail(trip)).toMatchObject({
    cover_photo_id: contractPhoto.id,
    cover_url: 'https://storage.test/c.jpg',
    cover_expires_at: '2026-10-14T11:00:00Z',
  })
})

test('upload rejections and processing failures get readable messages', () => {
  expect(uploadErrorMessage('unsupported_type')).toBe('This is not a JPEG or PNG image.')
  expect(uploadErrorMessage('file_too_large')).toBe('The file is larger than 25 MB.')
  expect(uploadErrorMessage('something_new')).toBe('The photo could not be processed. Try again.')

  expect(toRejectedUploadItem({ client_file_id: 'f2', error: { code: 'file_too_large', message: 'too big' } }, 'big.jpg')).toEqual({
    client_file_id: 'f2',
    file_name: 'big.jpg',
    state: 'failed',
    error: 'The file is larger than 25 MB.',
    photo: null,
  })

  const failed = toUploadItem({ ...contractPhoto, state: 'failed', error_code: 'invalid_image', display_image: null }, 'broken.jpg')
  expect(failed).toMatchObject({ state: 'failed', error: 'The image could not be read. The file may be damaged.' })
  expect(failed.photo?.error_code).toBe('invalid_image')
  expect(toUploadItem(contractPhoto, 'ok.jpg').error).toBeNull()
})

test('a batch restored after reload names files it still knows and falls back to the client id', () => {
  const batch = {
    id: contractPhoto.batch_id,
    trip_id: contractPhoto.trip_id,
    photos: [contractPhoto, { ...contractPhoto, id: 'p2', client_file_id: 'file-2', state: 'processing' as const }],
  }
  const items = toBatchItems(batch, new Map([['file-1', 'kyoto.jpg']]))
  expect(items.map((i) => [i.file_name, i.state])).toEqual([
    ['kyoto.jpg', 'ready'],
    ['file-2', 'processing'],
  ])
})

// Contract 0.0.8 (backend place labels, owner map and summary).
test('a labelled photo keeps the server label status and its place labels', () => {
  const photo = toPhoto({
    ...contractPhoto,
    country: 'Japan',
    city: 'Kyoto',
    place_name: 'Fushimi Inari Taisha',
    label_status: 'suggested',
    label_attribution: 'Powered by Geoapify · © OpenStreetMap contributors',
  })
  expect(photo.label_attribution).toBe(
    'Powered by Geoapify · © OpenStreetMap contributors',
  )
  expect(photo.label_status).toBe('suggested')
  expect([photo.city, photo.country, photo.place_name]).toEqual(['Kyoto', 'Japan', 'Fushimi Inari Taisha'])
  expect(photo.location_source).toBe('exif')
})

test('a corrected photo is a manual location while EXIF stays the import value', () => {
  const photo = toPhoto({ ...contractPhoto, lat: 34.967, lng: 135.773, label_status: 'confirmed', city: 'Kyoto' })
  expect(photo.location_source).toBe('manual')
  expect(photo.label_status).toBe('confirmed')
})

test('owner map markers use the display image as thumbnail and keep truncation', () => {
  const page: ApiMapPhotoPage = {
    truncated: true,
    items: [
      {
        id: 'p1',
        trip_id: 't1',
        trip_title: 'Japan 2025',
        lat: 35.0116,
        lng: 135.7681,
        display_image: { url: 'https://storage.example/display/p1.jpg', expires_at: '2026-11-22T20:00:00Z' },
        capture_time_local: '2025-05-12T09:00:00',
        city: 'Kyoto',
        country: 'Japan',
        place_name: null,
      },
      {
        id: 'p2',
        trip_id: 't1',
        trip_title: 'Japan 2025',
        lat: 34.69,
        lng: 135.5,
        display_image: null,
        capture_time_local: null,
        city: null,
        country: null,
        place_name: null,
      },
    ],
  }
  const result = toMapPhotoPage(page)
  expect(result.truncated).toBe(true)
  expect(result.items[0]).toEqual({
    id: 'p1',
    trip_id: 't1',
    trip_title: 'Japan 2025',
    lat: 35.0116,
    lng: 135.7681,
    thumb_url: 'https://storage.example/display/p1.jpg',
    display_url: 'https://storage.example/display/p1.jpg',
    capture_time_local: '2025-05-12T09:00:00',
    city: 'Kyoto',
    country: 'Japan',
    place_name: null,
  })
  expect(result.items[1].thumb_url).toBeNull()
})

test('the summary converts recent uploads into view-model photos', () => {
  const summary: ApiMeSummary = {
    photo_count: 12,
    country_count: 2,
    city_count: 5,
    to_review_count: 3,
    recently_uploaded: [{ ...contractPhoto, label_status: 'pending' }],
  }
  const result = toSummary(summary)
  expect([result.photo_count, result.country_count, result.city_count, result.to_review_count]).toEqual([12, 2, 5, 3])
  expect(result.recently_uploaded).toHaveLength(1)
  expect(result.recently_uploaded[0].thumb_url).toBe(contractPhoto.display_image?.url ?? null)
})

test('a place search hit keeps every field the map and correction dialog use', () => {
  const kyoto: ApiPlace = {
    id: 'g1',
    name: 'Kyoto',
    label: 'Kyoto, Japan',
    kind: 'city',
    lat: 35.0116,
    lng: 135.7681,
    zoom: 11,
    city: 'Kyoto',
    country: 'Japan',
  }
  expect(toPlace(kyoto)).toEqual(kyoto)
  expect(toPlace({ ...kyoto, kind: 'country', city: null, zoom: 5 }).city).toBeNull()
  for (const [kind, zoom] of [['locality', 14], ['street', 16], ['amenity', 17]] as const) {
    const detailed: ApiPlace = {
      ...kyoto,
      id: `helsinki-${kind}`,
      name: 'Rautatientori',
      label: 'Rautatientori, Helsinki, Finland',
      kind,
      zoom,
      city: 'Helsinki',
      country: 'Finland',
    }
    expect(toPlace(detailed)).toEqual(detailed)
  }
})

// Contract 0.0.9 (backend link and public shares).
test('a share turns its token into the recipient address and drops the raw token', () => {
  const share: ApiShare = {
    id: 's1',
    trip_id: 't1',
    mode: 'public',
    title: 'Kyoto',
    description: null,
    photo_ids: ['p1', 'p2'],
    token: 'abcdefghijklmnopqrstuv',
    created_at: '2026-11-22T20:00:00Z',
    revoked_at: null,
  }
  const result = toShare(share, 'https://mapmory.app')
  expect(result.url).toBe('https://mapmory.app/s/abcdefghijklmnopqrstuv')
  expect(result.mode).toBe('public')
  expect(result.photo_ids).toEqual(['p1', 'p2'])
  expect('token' in result).toBe(false)
})

test('a shared collection keeps only coarse positions and uses the display image', () => {
  const collection: ApiSharedCollection = {
    title: 'Kyoto',
    description: 'Autumn',
    created_at: '2026-11-22T20:00:00Z',
    photos: [
      {
        id: 'p1',
        display_image: { url: 'https://storage.example/display/p1.jpg', expires_at: '2026-11-22T21:00:00Z' },
        capture_time_local: '2025-05-12T09:00:00',
        city: 'Kyoto',
        country: 'Japan',
        display_lat: 35.0116,
        display_lng: 135.7681,
      },
      {
        id: 'p2',
        display_image: null,
        capture_time_local: null,
        city: null,
        country: null,
        display_lat: null,
        display_lng: null,
      },
    ],
  }
  const result = toSharedCollection(collection)
  expect(result.photos[0]).toEqual({
    id: 'p1',
    thumb_url: 'https://storage.example/display/p1.jpg',
    display_url: 'https://storage.example/display/p1.jpg',
    capture_time_local: '2025-05-12T09:00:00',
    city: 'Kyoto',
    country: 'Japan',
    display_lat: 35.0116,
    display_lng: 135.7681,
  })
  expect(result.photos[1].thumb_url).toBeNull()
  expect(result.description).toBe('Autumn')
})
