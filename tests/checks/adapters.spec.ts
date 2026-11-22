import { expect, test } from '@playwright/test'
import {
  toBatchItems,
  toPhoto,
  toPhotoPage,
  toRejectedUploadItem,
  toTripDetail,
  toUploadItem,
  uploadErrorMessage,
} from '../../src/api/adapters'
import type { ApiPhoto, ApiTrip } from '../../src/api/contract'

// A photo exactly as the contract (openapi.yaml 0.0.5) defines it: no place labels yet.
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
