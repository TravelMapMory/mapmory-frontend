import { expect, test, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:4181'
const LIVE = 'http://127.0.0.1:4182'

/** Import the actual Vite-selected client in the browser, as in summary-boundary.spec.ts. */
async function sharingState(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/api/client.ts'
    const client = await import(/* @vite-ignore */ modulePath)
    const outcomes = await Promise.allSettled([
      client.listShares('trip-europe'),
      client.createShare('trip-europe', { title: 'Test', photo_ids: ['p-eu-1'] }),
      client.revokeShare('share-old'),
      client.getSharedCollection('demo-europe'),
    ])
    return {
      available: client.sharingAvailable,
      results: outcomes.map((result) => result.status === 'rejected'
        ? { status: result.status, code: result.reason?.code }
        : { status: result.status }),
    }
  })
}

test('mock mode offers sharing and public demo collection', async ({ page }) => {
  await page.goto(`${MOCK}/s/demo-europe`)
  await expect(page.getByText('Highlights from Europe by rail')).toBeVisible()
  const state = await sharingState(page)
  expect(state.available).toBe(true)
  expect(state.results.every((result) => result.status === 'fulfilled')).toBe(true)
})

test('live mode rejects every mock-sharing API operation', async ({ page }) => {
  await page.goto(`${LIVE}/`)
  const state = await sharingState(page)
  expect(state.available).toBe(false)
  expect(state.results).toEqual(Array.from({ length: 4 }, () => ({ status: 'rejected', code: 'not_implemented' })))
})

test('live mode does not serve public demo links, including after sign-out', async ({ page }) => {
  for (const token of ['demo-europe', 'demo-revoked']) {
    await page.goto(`${LIVE}/s/${token}`)
    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.getByText('Highlights from Europe by rail')).toHaveCount(0)
    await expect(page.locator('.shared')).toHaveCount(0)
  }
})


test('live owner trip shows Share as disabled even when the trip loads successfully', async ({ page }) => {
  // Use demo authentication for this boundary test.
  // The live Vite server must have Firebase disabled.
  await page.addInitScript(() => {
    sessionStorage.setItem('mapmory.signedIn', '1')
  })

  // Mock only the backend trip response, while retaining live API routing.
  await page.route('**/api/trips/trip-live', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'trip-live',
        title: 'Persistent trip',
        notes: '',
        created_at: '2026-10-31T12:00:00Z',
        cover: null,
        photo_count: 0,
        located_count: 0,
        cities: [],
        countries: [],
        start_date: null,
        end_date: null,
        visibility: 'private',
      }),
    })
  })

  // Trip photos are live as well; an empty trip keeps the test about sharing.
  await page.route('**/api/trips/trip-live/photos?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], next_cursor: null }) }),
  )

  await page.goto(`${LIVE}/trips/trip-live`)

  // Verify that we reached the real Trip screen rather than a login,
  // loading, error, or not-found screen.
  await expect(
    page.getByRole('heading', { name: 'Persistent trip' }),
  ).toBeVisible()

  // Persistent trip editing must remain functional.
  await expect(
    page.getByRole('button', { name: 'Edit details' }),
  ).toBeVisible()

  // Sharing remains discoverable but cannot be used in live mode.
  const share = page.getByRole('button', {
    name: 'Share (coming soon)',
  })

  await expect(share).toBeVisible()
  await expect(share).toBeDisabled()

  // The mock sharing panel must never appear for persistent trips.
  await expect(
    page.getByRole('heading', { name: 'Share by link' }),
  ).toHaveCount(0)
})
