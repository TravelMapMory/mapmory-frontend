import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page, type Route } from '@playwright/test'

/*
 * The live upload flow (frontend #21, #30, #31) against a fake backend and a
 * fake Cloud Storage, both served through page.route. The fake follows the
 * backend contract: a photo is registered once, /complete returns 409
 * upload_missing until its bytes arrive and never reprocesses a finished photo.
 */

const LIVE = 'http://127.0.0.1:4182'
const TRIP = 'trip-live'
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

interface FakePhoto {
  id: string
  batch_id: string
  client_file_id: string
  state: 'pending' | 'ready' | 'failed'
}

class FakeBackend {
  photos: FakePhoto[] = []
  uploaded = new Set<string>()
  registrations = 0
  registeredFiles = 0
  puts = 0
  completes = 0
  /** Status codes for the next PUTs; 200 once empty. */
  putStatuses: number[] = []
  /** Status codes for the next /complete calls before the real answer. */
  completeStatuses: number[] = []
  /** Expiry of newly signed upload URLs. */
  uploadExpiresAt = () => new Date(Date.now() + 15 * 60_000).toISOString()
  /** Leave PUTs unanswered, as when the tab is closed mid-upload. */
  hangPuts = false

  apiPhoto(photo: FakePhoto) {
    const ready = photo.state === 'ready'
    return {
      id: photo.id,
      trip_id: TRIP,
      batch_id: photo.batch_id,
      client_file_id: photo.client_file_id,
      state: photo.state,
      error_code: null,
      uploaded_at: ready ? '2026-11-02T10:00:00Z' : null,
      capture_time_local: ready ? '2026-06-01T09:12:00' : null,
      capture_utc_offset: null,
      exif_lat: ready ? 48.8583 : null,
      exif_lng: ready ? 2.2944 : null,
      lat: ready ? 48.8583 : null,
      lng: ready ? 2.2944 : null,
      display_image: null,
    }
  }

  async install(page: Page) {
    await page.addInitScript(() => sessionStorage.setItem('mapmory.signedIn', '1'))
    await page.route('https://storage.googleapis.com/**', (route) => this.storage(route))
    // Only backend paths: a glob like **/api/** would also catch Vite's /src/api/*.ts modules.
    await page.route((url) => url.pathname.startsWith('/api/'), (route) => this.api(route))
  }

  async storage(route: Route) {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
    this.puts++
    if (this.hangPuts) return // never answered
    const status = this.putStatuses.shift() ?? 200
    if (status === 200) this.uploaded.add(new URL(request.url()).pathname.split('/').pop()!)
    return route.fulfill({ status, headers: { 'access-control-allow-origin': '*' }, body: '' })
  }

  async api(route: Route) {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const error = (status: number, code: string) => json(status, { error: { code, message: code } })

    if (request.method() === 'GET' && path === `/api/trips/${TRIP}`) {
      return json(200, { id: TRIP, title: 'Live trip', notes: '', created_at: '2026-11-01T12:00:00Z', cover: null, photo_count: 0 })
    }
    if (request.method() === 'GET' && path === `/api/trips/${TRIP}/photos`) {
      return json(200, { items: this.photos.map((p) => this.apiPhoto(p)), next_cursor: null })
    }
    if (request.method() === 'POST' && path === `/api/trips/${TRIP}/batches`) {
      this.registrations++
      const batchId = `batch-${this.registrations}`
      const files = (request.postDataJSON() as { files: { client_file_id: string; content_type: string; size_bytes: number }[] }).files
      const accepted = []
      const rejected = []
      for (const file of files) {
        if (!['image/jpeg', 'image/png'].includes(file.content_type)) {
          rejected.push({ client_file_id: file.client_file_id, error: { code: 'unsupported_type', message: 'unsupported' } })
          continue
        }
        this.registeredFiles++
        const photo: FakePhoto = { id: `photo-${this.registeredFiles}`, batch_id: batchId, client_file_id: file.client_file_id, state: 'pending' }
        this.photos.push(photo)
        accepted.push({
          client_file_id: file.client_file_id,
          photo_id: photo.id,
          upload: {
            method: 'PUT',
            url: `https://storage.googleapis.com/test-bucket/${photo.id}`,
            headers: { 'Content-Type': file.content_type },
            expires_at: this.uploadExpiresAt(),
          },
        })
      }
      return json(201, { batch_id: batchId, accepted_files: accepted, rejected_files: rejected })
    }
    const complete = path.match(/^\/api\/batches\/([^/]+)\/files\/([^/]+)\/complete$/)
    if (request.method() === 'POST' && complete) {
      this.completes++
      const photo = this.photos.find((p) => p.batch_id === complete[1] && p.client_file_id === decodeURIComponent(complete[2]))
      if (!photo) return error(404, 'not_found')
      const status = this.completeStatuses.shift()
      if (status) return error(status, 'internal_error')
      if (photo.state === 'pending') {
        if (!this.uploaded.has(photo.id)) return error(409, 'upload_missing')
        photo.state = 'ready'
      }
      return json(200, this.apiPhoto(photo))
    }
    const batch = path.match(/^\/api\/batches\/([^/]+)$/)
    if (request.method() === 'GET' && batch) {
      const photos = this.photos.filter((p) => p.batch_id === batch[1])
      if (photos.length === 0) return error(404, 'not_found')
      return json(200, { id: batch[1], trip_id: TRIP, photos: photos.map((p) => this.apiPhoto(p)) })
    }
    return error(404, 'not_found')
  }
}

async function openUploads(page: Page) {
  await page.goto(`${LIVE}/trips/${TRIP}`)
  await expect(page.getByRole('heading', { name: 'Live trip' })).toBeVisible()
  if ((await page.locator('.upl').count()) === 0) await page.getByRole('button', { name: 'Upload photos', exact: true }).first().click()
  return page.locator('.upl input[type=file]')
}

const row = (page: Page, name: string) => page.locator('.upl-item').filter({ hasText: name })

test('uploads register, PUT and complete, with per-file rejections', async ({ page }) => {
  const backend = new FakeBackend()
  await backend.install(page)
  const input = await openUploads(page)

  await input.setInputFiles([
    { name: 'with-gps.jpg', mimeType: 'image/jpeg', buffer: readFileSync(fixture('with-gps.jpg')) },
    { name: 'holiday.heic', mimeType: 'image/heic', buffer: Buffer.from('not really heic') },
  ])

  await expect(row(page, 'with-gps.jpg')).toContainText('Ready')
  await expect(row(page, 'with-gps.jpg')).toContainText('GPS 48.8583, 2.2944')
  await expect(row(page, 'holiday.heic')).toContainText('This is not a JPEG or PNG image.')
  expect([backend.registrations, backend.puts, backend.completes]).toEqual([1, 1, 1])
})

test('retry after a failed PUT reuses the registration', async ({ page }) => {
  const backend = new FakeBackend()
  backend.putStatuses = [500]
  await backend.install(page)
  const input = await openUploads(page)

  await input.setInputFiles(fixture('with-gps.jpg'))
  await expect(row(page, 'with-gps.jpg')).toContainText('The upload to Cloud Storage failed (500)')
  expect(backend.completes).toBe(0) // never complete a file whose PUT failed

  await row(page, 'with-gps.jpg').getByRole('button', { name: 'Retry' }).click()
  await expect(row(page, 'with-gps.jpg')).toContainText('Ready')
  expect([backend.registrations, backend.registeredFiles, backend.puts, backend.completes]).toEqual([1, 1, 2, 1])
})

test('retry after a failed /complete does not register again', async ({ page }) => {
  const backend = new FakeBackend()
  backend.completeStatuses = [500]
  await backend.install(page)
  const input = await openUploads(page)

  await input.setInputFiles(fixture('with-gps.jpg'))
  await expect(row(page, 'with-gps.jpg')).toContainText('Failed')

  await row(page, 'with-gps.jpg').getByRole('button', { name: 'Retry' }).click()
  await expect(row(page, 'with-gps.jpg')).toContainText('Ready')
  expect([backend.registrations, backend.registeredFiles, backend.completes]).toEqual([1, 1, 2])
  expect(backend.photos).toHaveLength(1)
})

test('after a reload an interrupted upload is shown and resumes with the same photo', async ({ page }) => {
  const backend = new FakeBackend()
  backend.hangPuts = true
  await backend.install(page)
  let input = await openUploads(page)

  await input.setInputFiles(fixture('with-gps.jpg'))
  await expect(row(page, 'with-gps.jpg')).toContainText('Uploading')
  // "Uploading" shows before the PUT is sent; wait until it is actually stuck.
  await expect.poll(() => backend.puts).toBe(1)

  backend.hangPuts = false
  await page.reload()
  // The panel reopens by itself and shows the backend's view of the file.
  await expect(row(page, 'with-gps.jpg')).toContainText('The upload was interrupted. Choose the file again to finish it.')

  input = page.locator('.upl input[type=file]')
  await input.setInputFiles(fixture('with-gps.jpg'))
  await expect(row(page, 'with-gps.jpg')).toContainText('Ready')
  expect([backend.registrations, backend.registeredFiles]).toEqual([1, 1])
  expect(backend.photos).toHaveLength(1)

  // Finished: a further reload does not reopen the panel.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Live trip' })).toBeVisible()
  await expect(page.locator('.upl')).toHaveCount(0)
})

test('an expired upload URL is replaced only when the bytes never arrived', async ({ page }) => {
  const backend = new FakeBackend()
  // The first URL is inside the one-minute safety margin, later ones are fresh.
  let signed = 0
  backend.uploadExpiresAt = () => new Date(Date.now() + (signed++ === 0 ? 30_000 : 15 * 60_000)).toISOString()
  await backend.install(page)
  const input = await openUploads(page)

  await input.setInputFiles(fixture('with-gps.jpg'))
  await expect(row(page, 'with-gps.jpg')).toContainText('Ready')
  // /complete answered upload_missing for the expired URL, so the file was registered again and sent.
  expect([backend.registrations, backend.puts, backend.completes]).toEqual([2, 1, 2])
})
