import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('owner map sends filters and uses the backend response', async ({ page }) => {
  const calls: { url: string; authorization: string | undefined }[] = []

  await page.route('**/api/map/photos?*', async (route) => {
    calls.push({
      url: route.request().url(),
      authorization: route.request().headers().authorization,
    })

    await route.fulfill({
      json: { items: [], truncated: true },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { getMapPhotos, setTokenProvider } =
      await import(/* @vite-ignore */ bridgeUrl)
    setTokenProvider(async () => 'test-token')

    return getMapPhotos({
      bbox: [10, 20, 30, 40],
      trip_id: 'trip-1',
      from: '2025-01-01',
      to: '2025-12-31',
      q: 'Kyoto',
    })
  })

  expect(result).toEqual({ items: [], truncated: true })
  expect(calls).toHaveLength(1)

  const url = new URL(calls[0].url)

  expect(url.pathname).toBe('/api/map/photos')
  expect(url.searchParams.get('bbox')).toBe('10,20,30,40')
  expect(url.searchParams.get('trip_id')).toBe('trip-1')
  expect(url.searchParams.get('from')).toBe('2025-01-01')
  expect(url.searchParams.get('to')).toBe('2025-12-31')
  expect(url.searchParams.get('q')).toBe('Kyoto')
  expect(calls[0].authorization).toBe('Bearer test-token')
})

test('place search trims its query and maps results', async ({ page }) => {
  let requestedQuery: string | null = null

  await page.route('**/api/places/search?*', async (route) => {
    requestedQuery = new URL(route.request().url()).searchParams.get('q')

    await route.fulfill({
      json: {
        items: [{
          id: 'kyoto',
          name: 'Kyoto',
          label: 'Kyoto, Japan',
          kind: 'city',
          lat: 35.0116,
          lng: 135.7681,
          zoom: 11,
          city: 'Kyoto',
          country: 'Japan',
        }],
      },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { searchPlaces } =
      await import(/* @vite-ignore */ bridgeUrl)
    return searchPlaces('  Kyoto  ')
  })

  expect(requestedQuery).toBe('Kyoto')
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({
    name: 'Kyoto',
    country: 'Japan',
    kind: 'city',
  })
})

test('location correction sends PATCH and preserves attribution', async ({ page }) => {
  let method = ''
  let body: unknown = null

  await page.route('**/api/photos/*/location', async (route) => {
    method = route.request().method()
    body = route.request().postDataJSON()

    await route.fulfill({
      json: {
        id: 'photo-1',
        trip_id: 'trip-1',
        batch_id: 'batch-1',
        client_file_id: 'file-1',
        state: 'ready',
        error_code: null,
        uploaded_at: '2025-05-12T10:00:00Z',
        capture_time_local: null,
        capture_utc_offset: null,
        exif_lat: null,
        exif_lng: null,
        lat: 34.967,
        lng: 135.773,
        display_image: null,
        country: 'Japan',
        city: 'Kyoto',
        place_name: 'Fushimi Inari Taisha',
        label_status: 'confirmed',
        label_attribution: 'Geoapify attribution',
      },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { patchPhotoLocation } =
      await import(/* @vite-ignore */ bridgeUrl)

    return patchPhotoLocation('photo-1', {
      lat: 34.967,
      lng: 135.773,
    })
  })

  expect(method).toBe('PATCH')
  expect(body).toEqual({ lat: 34.967, lng: 135.773 })
  expect(result).toMatchObject({
    id: 'photo-1',
    location_source: 'manual',
    label_status: 'confirmed',
    label_attribution: 'Geoapify attribution',
  })
})

test('summary uses live data without substituting mock statistics', async ({ page }) => {
  let requested = false

  await page.route('**/api/me/summary', async (route) => {
    requested = true

    await route.fulfill({
      json: {
        photo_count: 12,
        country_count: 2,
        city_count: 5,
        to_review_count: 3,
        recently_uploaded: [],
      },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { getSummary } =
      await import(/* @vite-ignore */ bridgeUrl)
    return getSummary()
  })

  expect(requested).toBe(true)
  expect(result).toMatchObject({
    photo_count: 12,
    country_count: 2,
    city_count: 5,
    to_review_count: 3,
    recently_uploaded: [],
  })
})

test('summary returns null when the backend has no summary route', async ({ page }) => {
  let requests = 0

  await page.route('**/api/me/summary', async (route) => {
    requests++
    await route.fulfill({
      status: 404,
      json: { error: { code: 'not_found', message: 'Not found' } },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { getSummary } = await import(/* @vite-ignore */ bridgeUrl)
    return getSummary()
  })

  expect(requests).toBe(1)
  expect(result).toBeNull()
})

test('summary propagates backend errors other than 404', async ({ page }) => {
  let requests = 0

  await page.route('**/api/me/summary', async (route) => {
    requests++
    await route.fulfill({
      status: 500,
      json: { error: { code: 'internal_error', message: 'Summary unavailable' } },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { getSummary } = await import(/* @vite-ignore */ bridgeUrl)
    try {
      await getSummary()
      return null
    } catch (error) {
      const e = error as { status?: number; code?: string; message?: string }
      return { status: e.status, code: e.code, message: e.message }
    }
  })

  expect(requests).toBe(1)
  expect(result).toEqual({
    status: 500,
    code: 'internal_error',
    message: 'Summary unavailable',
  })
})

test('provider failure is returned without falling back to mock search', async ({ page }) => {
  let requests = 0

  await page.route('**/api/places/search?*', async (route) => {
    requests++

    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'provider_unavailable',
          message: 'Place search is unavailable',
        },
      },
    })
  })

  const result = await page.evaluate(async () => {
    const bridgeUrl = '/tests/support/liveClientTestBridge.ts'
    const { searchPlaces } =
      await import(/* @vite-ignore */ bridgeUrl)

    try {
      await searchPlaces('Kyoto')
      return null
    } catch (error) {
      const e = error as { status?: number; code?: string }
      return { status: e.status, code: e.code }
    }
  })

  expect(requests).toBe(1)
  expect(result).toEqual({
    status: 503,
    code: 'provider_unavailable',
  })
})
