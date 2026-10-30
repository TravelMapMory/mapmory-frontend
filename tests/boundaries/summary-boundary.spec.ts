
import { expect, test } from '@playwright/test'

/**
 * Load the actual frontend API client through Vite.
 *
 * The path is a browser URL, not a TypeScript import path.
 * A dynamic path lets Vite resolve the module at runtime.
 */
async function getDashboardSummary(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/api/client.ts'
    const { getSummary } = await import(/* @vite-ignore */ modulePath)
    return getSummary()
  })
}

test.describe('Dashboard summary: mock/live boundary', () => {
  test('mock mode retains demonstration statistics and photos', async ({
    page,
  }) => {
    await page.goto('http://127.0.0.1:4181/')

    const summary = await getDashboardSummary(page)

    // Standalone prototype mode should retain its demonstration data.
    expect(summary).not.toBeNull()
    expect(summary?.photo_count).toBeGreaterThan(0)
    expect(summary?.recently_uploaded.length).toBeGreaterThan(0)
  })

  test('live trips never use demonstration summary data', async ({
    page,
  }) => {
    let summaryRequests = 0

    await page.route('**/api/me/summary', async (route) => {
      summaryRequests++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.goto('http://127.0.0.1:4182/')

    const summary = await getDashboardSummary(page)

    // Trip APIs are live, but the summary API is not implemented yet.
    // Returning null prevents unrelated demo statistics and photos
    // from appearing alongside the authenticated user's real trips.
    expect(summary).toBeNull()

    // The frontend must not call an endpoint absent from LIVE.
    expect(summaryRequests).toBe(0)
  })
})
