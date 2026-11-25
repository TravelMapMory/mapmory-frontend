import { expect, test, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:4181'
const LIVE = 'http://127.0.0.1:4182'

const share = {
  id: 'share-live',
  trip_id: 'trip-live',
  mode: 'link' as const,
  title: 'Selected trip photos',
  description: null,
  photo_ids: ['photo-a'],
  token: 'abcdefghijklmnopqrstuvwxyz',
  created_at: '2026-11-25T08:00:00Z',
  revoked_at: null,
}

const collection = {
  title: 'Selected trip photos',
  description: 'Shared from a real trip',
  created_at: '2026-11-25T08:00:00Z',
  photos: [{
    id: 'photo-a',
    display_image: { url: 'https://storage.example.test/display/photo-a.jpg', expires_at: '2026-11-25T09:00:00Z' },
    capture_time_local: null,
    city: 'Kyoto',
    country: 'Japan',
    display_lat: 35.0116,
    display_lng: 135.7681,
  }],
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/** Import the actual Vite-selected client, not a separately mocked copy. */
async function clientState(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/api/client.ts'
    const client = await import(/* @vite-ignore */ modulePath)
    return { sharingAvailable: client.sharingAvailable }
  })
}

test('mock mode retains its demonstration sharing without a backend', async ({ page }) => {
  await page.goto(`${MOCK}/s/demo-europe`)
  await expect(page.getByRole('heading', { name: 'Highlights from Europe by rail' })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(3)
  expect((await clientState(page)).sharingAvailable).toBe(true)
})

test('live owner operations use authenticated endpoints and adapt share tokens', async ({ page }) => {
  const requests: { method: string; path: string; authorization: string | undefined; body: unknown }[] = []
  await page.route('**/api/trips/trip-live/shares', async (route) => {
    const request = route.request()
    requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      authorization: request.headers().authorization,
      body: request.postDataJSON() ?? null,
    })
    if (request.method() === 'GET') await route.fulfill(json({ items: [share] }))
    else if (request.method() === 'POST') await route.fulfill(json(share, 201))
    else await route.fulfill(json({ error: { code: 'unexpected_method', message: 'Unexpected method' } }, 405))
  })
  await page.route('**/api/shares/share-live', async (route) => {
    requests.push({
      method: route.request().method(),
      path: new URL(route.request().url()).pathname,
      authorization: route.request().headers().authorization,
      body: null,
    })
    await route.fulfill({ status: 204, body: '' })
  })
  await page.goto(`${LIVE}/`)
  const result = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const client = await import(/* @vite-ignore */ clientPath)
    const httpPath = '/src/api/http.ts'
    const { setTokenProvider } = await import(/* @vite-ignore */ httpPath)
    setTokenProvider(async () => 'test-id-token')
    const listed = await client.listShares('trip-live')
    const created = await client.createShare('trip-live', {
      mode: 'link', title: 'Selected trip photos', description: null, photo_ids: ['photo-a'],
    })
    await client.revokeShare(created.id)
    return { available: client.sharingAvailable, listed, created }
  })
  expect(result.available).toBe(true)
  expect(result.listed).toHaveLength(1)
  expect(result.listed[0].url).toBe(`${LIVE}/s/${share.token}`)
  expect(result.created.url).toBe(`${LIVE}/s/${share.token}`)
  expect(result.created).not.toHaveProperty('token')
  expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
    'GET /api/trips/trip-live/shares',
    'POST /api/trips/trip-live/shares',
    'DELETE /api/shares/share-live',
  ])
  expect(requests.every((request) => request.authorization === 'Bearer test-id-token')).toBe(true)
  expect(requests[1].body).toEqual({
    mode: 'link', title: 'Selected trip photos', description: null, photo_ids: ['photo-a'],
  })
})

test('live share creation errors propagate and cannot create mock shares', async ({ page }) => {
  await page.route('**/api/trips/trip-live/shares', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill(json({ error: { code: 'invalid_photos', message: 'Photos cannot be shared' } }, 400))
    } else {
      await route.fulfill(json({ items: [] }))
    }
  })
  await page.goto(`${LIVE}/`)
  const result = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const client = await import(/* @vite-ignore */ clientPath)
    try {
      await client.createShare('trip-live', { mode: 'link', title: 'Invalid', photo_ids: ['unknown-photo'] })
      return { success: true }
    } catch (error: unknown) {
      return { success: false, status: (error as { status?: number }).status, code: (error as { code?: string }).code }
    }
  })
  expect(result).toEqual({ success: false, status: 400, code: 'invalid_photos' })
  const listed = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { listShares } = await import(/* @vite-ignore */ clientPath)
    return listShares('trip-live')
  })
  expect(listed).toEqual([])
})

test('anonymous live link uses the selected display image, never a demo collection', async ({ page }) => {
  let requestCount = 0
  await page.route(`**/api/s/${share.token}`, async (route) => {
    requestCount++
    expect(route.request().headers().authorization).toBeUndefined()
    await route.fulfill(json(collection))
  })
  await page.goto(`${LIVE}/s/${share.token}`)
  await expect(page.getByRole('heading', { name: collection.title })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(1)
  await expect(page.locator('.shared-tile img')).toHaveAttribute('src', collection.photos[0].display_image.url)
  await expect(page.getByText('Highlights from Europe by rail')).toHaveCount(0)
  expect(requestCount).toBe(1)
})

test('live missing and revoked links show distinct errors without mock fallback', async ({ page }) => {
  for (const [token, status, code, heading] of [
    ['demo-europe', 404, 'share_not_found', "This link doesn't work"],
    ['demo-revoked', 410, 'share_revoked', 'This link has been turned off'],
  ] as const) {
    await page.route(`**/api/s/${token}`, (route) => route.fulfill(json({ error: { code, message: code } }, status)))
    await page.goto(`${LIVE}/s/${token}`)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.locator('.shared-tile')).toHaveCount(0)
    await expect(page.getByText('Highlights from Europe by rail')).toHaveCount(0)
    await page.unroute(`**/api/s/${token}`)
  }
})

test('live public shares are retrieved by ID without credentials', async ({ page }) => {
  const id = 'share-public'
  let count = 0
  await page.route(`**/api/public/shares/${id}`, async (route) => {
    count++
    expect(route.request().headers().authorization).toBeUndefined()
    await route.fulfill(json(collection))
  })
  await page.goto(`${LIVE}/`)
  // Call the actual client to avoid relying on a particular route layout.
  const got = await page.evaluate(async (shareId) => {
    const clientPath = '/src/api/client.ts'
    const { getPublicShare } = await import(/* @vite-ignore */ clientPath)
    return getPublicShare(shareId)
  }, id)
  expect(got.photos).toHaveLength(1)
  expect(got.photos[0].display_url).toBe(collection.photos[0].display_image.url)
  expect(got.photos[0].display_lat).toBe(35.0116)
  expect(count).toBeGreaterThanOrEqual(1)
})

test('link-only shares cannot be retrieved through the live public-share endpoint', async ({ page }) => {
  await page.route('**/api/public/shares/link-only', (route) =>
    route.fulfill(json({ error: { code: 'share_not_found', message: 'Not public' } }, 404)),
  )
  await page.goto(`${LIVE}/`)
  const result = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { getPublicShare } = await import(/* @vite-ignore */ clientPath)
    try {
      await getPublicShare('link-only')
      return { success: true }
    } catch (error: unknown) {
      return { success: false, status: (error as { status?: number }).status }
    }
  })
  expect(result).toEqual({ success: false, status: 404 })
})

test('live public-map errors never fall back to demo clusters', async ({ page }) => {
  await page.route('**/api/public/map?*', (route) =>
    route.fulfill(json({ error: { code: 'backend_unavailable', message: 'Unavailable' } }, 503)),
  )
  await page.goto(`${LIVE}/`)
  const result = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { getPublicMap } = await import(/* @vite-ignore */ clientPath)
    try {
      await getPublicMap({ bbox: [130, 30, 140, 40], zoom: 6 })
      return { success: true }
    } catch (error: unknown) {
      return { success: false, status: (error as { status?: number }).status, code: (error as { code?: string }).code }
    }
  })
  expect(result).toEqual({ success: false, status: 503, code: 'backend_unavailable' })
})

test('live public map sends normalized bounds and keeps the backend truncation flag', async ({ page }) => {
  const seen: { path: string; bbox: string | null; zoom: string | null }[] = []
  await page.route('**/api/public/map?*', async (route) => {
    const url = new URL(route.request().url())
    seen.push({ path: url.pathname, bbox: url.searchParams.get('bbox'), zoom: url.searchParams.get('zoom') })
    await route.fulfill(json({
      clusters: [{
        id: '6/20/14', lat: 35.0116, lng: 135.7681, count: 1, label: 'Kyoto',
        cover_url: 'https://storage.example.test/cover.jpg', bounds: [135.7681, 35.0116, 135.7681, 35.0116],
        share_count: 1, shares: [{ id: 'share-public', title: 'Kyoto', cover_url: null, photo_count: 1 }],
      }],
      truncated: true,
    }))
  })
  await page.goto(`${LIVE}/`)
  const result = await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const { getPublicMap } = await import(/* @vite-ignore */ clientPath)
    return getPublicMap({ bbox: [130, 30, 140, 40], zoom: 6 })
  })
  expect(seen).toEqual([{ path: '/api/public/map', bbox: '130.00000,30.00000,140.00000,40.00000', zoom: '6' }])
  expect(result.truncated).toBe(true)
  expect(result.clusters).toHaveLength(1)
  expect(result.clusters[0].shares[0].id).toBe('share-public')
})

test('live trip enables the Share panel and fetches only its own shares', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('mapmory.signedIn', '1'))
  await page.route('**/api/trips/trip-live', (route) => route.fulfill(json({
    id: 'trip-live', title: 'Persistent trip', notes: '', created_at: '2026-10-31T12:00:00Z',
    cover: null, photo_count: 0, located_count: 0, cities: [], countries: [],
    start_date: null, end_date: null, visibility: 'private',
  })))
  await page.route('**/api/trips/trip-live/photos?*', (route) => route.fulfill(json({ items: [], next_cursor: null })))
  let shareLists = 0
  await page.route('**/api/trips/trip-live/shares', (route) => {
    shareLists++
    return route.fulfill(json({ items: [] }))
  })
  await page.goto(`${LIVE}/trips/trip-live`)
  await expect(page.getByRole('heading', { name: 'Persistent trip' })).toBeVisible()
  const button = page.getByRole('button', { name: 'Share', exact: true })
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByRole('heading', { name: 'Sharing' })).toBeVisible()
  await expect(page.getByText('This trip has no active shares.')).toBeVisible()
  expect(shareLists).toBeGreaterThan(0)
})
