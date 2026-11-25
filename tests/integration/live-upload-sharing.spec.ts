/**
 * Real-backend upload and sharing smoke test.
 *
 * This deliberately creates persistent test records. Use a disposable DB/account.
 * Requires MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN; never commit tokens.
 * Backend must be database-backed and have GCS or local photo storage configured.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test, type APIRequestContext } from '@playwright/test'

const api = process.env.MAPMORY_TEST_API_URL?.replace(/\/$/, '')
const token = process.env.MAPMORY_TEST_ID_TOKEN
const otherToken = process.env.MAPMORY_TEST_OTHER_ID_TOKEN
const gpsFixture = fileURLToPath(new URL('../fixtures/with-gps.jpg', import.meta.url))
const noGpsFixture = fileURLToPath(new URL('../fixtures/no-metadata.png', import.meta.url))

interface UploadTarget { method: 'PUT'; url: string; headers: Record<string, string> }
interface RegisteredBatch {
  batch_id: string
  accepted_files: Array<{ client_file_id: string; photo_id: string; upload: UploadTarget }>
  rejected_files: Array<{ client_file_id: string; error: { code: string } }>
}
interface Photo {
  id: string
  state: 'ready' | 'needs-location' | 'failed' | 'pending' | 'processing' | 'uploading'
  lat: number | null
  lng: number | null
  exif_lat: number | null
  exif_lng: number | null
  display_image: { url: string; expires_at: string } | null
}
interface Share { id: string; mode: 'link' | 'public'; token: string; photo_ids: string[] }
interface SharedPhoto {
  id: string
  display_lat: number | null
  display_lng: number | null
  display_image: { url: string } | null
  exif_lat?: never
  exif_lng?: never
  lat?: never
  lng?: never
}
interface Collection { title: string; photos: SharedPhoto[] }

const headers = (idToken: string) => ({ Authorization: `Bearer ${idToken}` })

async function addPhoto(request: APIRequestContext, tripId: string, path: string, contentType: string): Promise<Photo> {
  const bytes = await readFile(path)
  const fileId = `smoke-${Math.random().toString(36).slice(2)}`
  const registeredResponse = await request.post(`${api}/api/trips/${tripId}/batches`, {
    headers: headers(token!),
    data: { files: [{ client_file_id: fileId, size_bytes: bytes.length, content_type: contentType }] },
  })
  expect(registeredResponse.status(), 'register batch').toBe(201)
  const registered = (await registeredResponse.json()) as RegisteredBatch
  expect(registered.rejected_files, 'no file rejection').toEqual([])
  expect(registered.accepted_files).toHaveLength(1)
  const upload = registered.accepted_files[0].upload
  expect(upload.method).toBe('PUT')

  // Upload bytes to the backend-issued signed URL, without any Firebase Authorization header.
  const put = await request.put(upload.url, { headers: upload.headers, data: bytes })
  expect(put.ok(), `signed PUT returned ${put.status()}`).toBeTruthy()

  const completed = await request.post(
    `${api}/api/batches/${registered.batch_id}/files/${encodeURIComponent(fileId)}/complete`,
    { headers: headers(token!) },
  )
  expect(completed.status(), 'complete upload').toBe(200)
  const photo = (await completed.json()) as Photo
  expect(photo.id).toBe(registered.accepted_files[0].photo_id)
  expect(['ready', 'needs-location']).toContain(photo.state)
  expect(photo.display_image?.url).toBeTruthy()
  const display = await request.get(photo.display_image!.url)
  expect(display.ok(), 'signed processed display GET').toBeTruthy()
  expect(display.headers()['content-type']).toContain('image/jpeg')
  return photo
}

async function createShare(request: APIRequestContext, tripId: string, photoId: string, mode: 'link' | 'public'): Promise<Share> {
  const response = await request.post(`${api}/api/trips/${tripId}/shares`, {
    headers: headers(token!),
    data: { mode, title: `Local ${mode} smoke test`, photo_ids: [photoId] },
  })
  expect(response.status(), `create ${mode} share`).toBe(201)
  const share = (await response.json()) as Share
  expect(share.photo_ids).toEqual([photoId])
  expect(share.token.length).toBeGreaterThanOrEqual(22)
  return share
}

async function revoke(request: APIRequestContext, shareId: string) {
  const response = await request.delete(`${api}/api/shares/${shareId}`, { headers: headers(token!) })
  expect(response.status(), 'revoke share').toBe(204)
}

test('live storage: process two photos, share a selected photo, and revoke both audiences', async ({ request }) => {
  test.skip(!api || !token, 'Set MAPMORY_TEST_API_URL and MAPMORY_TEST_ID_TOKEN to test a real backend')
  test.setTimeout(120_000)
  const health = await request.get(`${api}/healthz`)
  expect(health.status(), 'backend health').toBe(200)
  const unauth = await request.get(`${api}/api/trips`)
  expect(unauth.status(), 'database mode must require authentication').toBe(401)

  const tripResponse = await request.post(`${api}/api/trips`, {
    headers: headers(token!),
    data: { title: `Local photo smoke ${Date.now()}`, notes: 'Disposable integration data' },
  })
  expect(tripResponse.status()).toBe(201)
  const trip = (await tripResponse.json()) as { id: string }

  const gps = await addPhoto(request, trip.id, gpsFixture, 'image/jpeg')
  const noGps = await addPhoto(request, trip.id, noGpsFixture, 'image/png')
  expect(gps.state).toBe('ready')
  expect(gps.lat).not.toBeNull()
  expect(gps.lng).not.toBeNull()
  expect(noGps.state).toBe('needs-location')

  const photoList = await request.get(`${api}/api/trips/${trip.id}/photos?limit=20`, { headers: headers(token!) })
  expect(photoList.status()).toBe(200)
  const photos = (await photoList.json()) as { items: Photo[] }
  expect(photos.items.map((p) => p.id)).toEqual(expect.arrayContaining([gps.id, noGps.id]))

  const link = await createShare(request, trip.id, gps.id, 'link')
  const recipientResponse = await request.get(`${api}/api/s/${link.token}`)
  expect(recipientResponse.status()).toBe(200)
  const recipient = (await recipientResponse.json()) as Collection
  expect(recipient.photos.map((p) => p.id)).toEqual([gps.id])
  const serialized = JSON.stringify(recipient)
  for (const forbidden of ['exif_lat', 'exif_lng', 'exif', 'original_url', 'trip_id']) {
    expect(serialized, `recipient must not contain ${forbidden}`).not.toContain(`"${forbidden}"`)
  }
  expect(recipient.photos[0].display_image?.url).toBeTruthy()
  expect((await request.get(recipient.photos[0].display_image!.url)).ok()).toBeTruthy()
  const hidden = await request.get(`${api}/api/public/shares/${link.id}`)
  expect(hidden.status(), 'link share is not publicly discoverable by ID').toBe(404)

  // Optional second Firebase identity checks ownership without revealing private trip IDs.
  if (otherToken) {
    const foreignRead = await request.get(`${api}/api/trips/${trip.id}`, { headers: headers(otherToken) })
    expect(foreignRead.status()).toBe(404)
  }

  await revoke(request, link.id)
  expect((await request.get(`${api}/api/s/${link.token}`)).status()).toBe(410)

  const published = await createShare(request, trip.id, gps.id, 'public')
  const publicView = await request.get(`${api}/api/public/shares/${published.id}`)
  expect(publicView.status()).toBe(200)
  const publicCollection = (await publicView.json()) as Collection
  expect(publicCollection.photos.map((p) => p.id)).toEqual([gps.id])

  // Public map has a hard cap, so not every share is guaranteed visible in a busy test DB.
  // A public share's own detail endpoint must still be accessible anonymously.
  await revoke(request, published.id)
  expect((await request.get(`${api}/api/public/shares/${published.id}`)).status()).toBe(404)
})
