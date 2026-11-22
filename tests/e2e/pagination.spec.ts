import { test, expect } from './fixtures'
import { boot, dashboard, failNext, openTrip } from './helpers'

// The seed data with pages of two: trips 2 + 1, Europe's photos 2 + 2 + 2 + 1.
const PAGED = { pageSize: 2 }
const EUROPE = [
  'Eiffel Tower, Paris',
  'Tour Montparnasse, Paris',
  'Big Ben, London',
  'Brandenburg Gate, Berlin',
  'Berlin Cathedral, Berlin',
  'Trevi Fountain, Rome',
  'Helsinki Cathedral, Helsinki',
]

test('Dashboard loads trips page by page without duplicates', async ({ page }) => {
  await boot(page, PAGED)
  await expect(page.locator('.trip-card')).toHaveCount(2)
  await expect(page.locator('.load-more-summary')).toHaveText('Showing 2 trips')
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await expect(page.getByRole('article', { name: 'Europe by rail', exact: true })).toBeVisible()
  // The last page has no cursor, so the control goes away.
  await expect(page.getByRole('button', { name: 'Load more trips' })).toHaveCount(0)
})

test('the Map trip filter and the upload picker list every trip, not only the first page', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Upload photos', exact: true }).first().click()
  await expect(page.getByLabel('Trip', { exact: true }).locator('option')).toHaveText([
    'Rome with family',
    'Weekend in Helsinki',
    'Europe by rail',
  ])
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.getByLabel('Trip', { exact: true }).locator('option')).toContainText([
    'Rome with family',
    'Weekend in Helsinki',
    'Europe by rail',
  ])
})

test('trip photos load page by page in capture order until the trip is complete', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  const places = page.locator('.trip-tile-place')
  await expect(places).toHaveText(EUROPE.slice(0, 2))
  await expect(page.locator('.load-more-summary')).toHaveText('Showing 2 of 7 photos')

  const more = page.getByRole('button', { name: 'Load more photos' })
  await more.click()
  await expect(places).toHaveText(EUROPE.slice(0, 4))
  await more.click()
  await expect(places).toHaveText(EUROPE.slice(0, 6))
  await more.click()
  await expect(places).toHaveText(EUROPE)
  await expect(more).toHaveCount(0)

  // Journey shows the same loaded photos, day by day.
  await page.getByRole('button', { name: 'Journey', exact: true }).click()
  await expect(page.locator('.trip-row .trip-tile-place')).toHaveText(EUROPE)
})

test('repeated clicks while a page loads request it only once', async ({ page }) => {
  await boot(page, { ...PAGED, delayMs: 400 })
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  const more = page.getByRole('button', { name: 'Load more photos' })
  // Three clicks in the same instant, as a fast double or triple click would send them.
  await more.evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
    button.click()
  })
  await expect(page.getByRole('button', { name: 'Loading…' })).toHaveAttribute('aria-disabled', 'true')
  await expect(more).toBeVisible()
  await expect(page.locator('.trip-tile-place')).toHaveText(EUROPE.slice(0, 4))
  await expect(page.locator('.load-more-summary')).toHaveText('Showing 4 of 7 photos')
})

test('a failed page keeps the loaded photos and can be retried', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  await failNext(page, 'tripPhotos')
  await page.getByRole('button', { name: 'Load more photos' }).click()
  await expect(page.getByRole('alert')).toHaveText('More photos could not be loaded.')
  await expect(page.locator('.trip-tile-place')).toHaveText(EUROPE.slice(0, 2))
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.trip-tile-place')).toHaveText(EUROPE.slice(0, 4))
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a failed trip page on the Dashboard can be retried', async ({ page }) => {
  await boot(page, PAGED)
  await failNext(page, 'listTrips')
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await expect(page.getByRole('alert')).toHaveText('More trips could not be loaded.')
  await expect(page.locator('.trip-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.trip-card')).toHaveCount(3)
})

test('a correction reloads the trip without losing the pages already opened', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  await page.getByRole('button', { name: 'Load more photos' }).click()
  await expect(page.locator('.trip-tile')).toHaveCount(4)

  await page.locator('.trip-tile').filter({ hasText: 'Big Ben' }).getByRole('button', { name: 'Change location' }).click()
  await page.getByRole('combobox', { name: 'Search for the place' }).fill('Tokyo')
  await page.getByRole('option', { name: 'Tokyo, Japan' }).click()
  await page.getByRole('button', { name: 'Save location' }).click()
  await expect(page.locator('.trip-saved')).toContainText('Location saved')
  // Same four photos, same order, the corrected one updated in place.
  await expect(page.locator('.trip-tile')).toHaveCount(4)
  await expect(page.locator('.trip-tile').nth(2)).toContainText('Tokyo')
  await expect(page.locator('.load-more-summary')).toHaveText('Showing 4 of 7 photos')
})

test('the viewer stays on its photo as pages arrive and Next at the end loads the next page', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  await page.getByRole('button', { name: 'View photo at Tour Montparnasse, Paris' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.viewer-place')).toHaveText('Tour Montparnasse, Paris')
  await expect(dialog.locator('.viewer-count')).toHaveText('2 of 2 loaded')

  // Next at the last loaded photo fetches the next page and moves on to it.
  await page.keyboard.press('ArrowRight')
  await expect(dialog.locator('.viewer-place')).toHaveText('Big Ben, London')
  await expect(dialog.locator('.viewer-count')).toHaveText('3 of 4 loaded')
  await page.keyboard.press('ArrowLeft')
  await expect(dialog.locator('.viewer-place')).toHaveText('Tour Montparnasse, Paris')
  await page.keyboard.press('Escape')

  // At the very end of the trip, Next stays put.
  await page.getByRole('button', { name: 'Load more photos' }).click()
  await page.getByRole('button', { name: 'Load more photos' }).click()
  await expect(page.locator('.trip-tile')).toHaveCount(7)
  await page.getByRole('button', { name: 'View photo at Helsinki Cathedral, Helsinki' }).click()
  await expect(dialog.locator('.viewer-count')).toHaveText('7 of 7')
  await page.keyboard.press('ArrowRight')
  await expect(dialog.locator('.viewer-place')).toHaveText('Helsinki Cathedral, Helsinki')
  await expect(dialog.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true')
})

test('a failed page from the viewer says so and Next retries it', async ({ page }) => {
  await boot(page, PAGED)
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  await page.getByRole('button', { name: 'View photo at Tour Montparnasse, Paris' }).click()
  const dialog = page.getByRole('dialog')
  await failNext(page, 'tripPhotos')
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('alert')).toContainText('More photos could not be loaded')
  await expect(dialog.locator('.viewer-place')).toHaveText('Tour Montparnasse, Paris')
  await page.keyboard.press('ArrowRight')
  await expect(dialog.locator('.viewer-place')).toHaveText('Big Ben, London')
})

test('switching trips while a page loads never mixes in the old trip', async ({ page }) => {
  await boot(page, { ...PAGED, delayMs: 600 })
  await page.getByRole('button', { name: 'Load more trips' }).click()
  await openTrip(page, 'Europe by rail')
  await page.getByRole('button', { name: 'Load more photos' }).click()
  // Leave before the page arrives, then open another trip.
  await dashboard(page)
  await openTrip(page, 'Weekend in Helsinki')
  await expect(page.locator('.trip-tile-place')).toHaveText(['Uspenski Cathedral, Helsinki', 'Suomenlinna, Helsinki'])
  await page.waitForTimeout(800)
  await expect(page.locator('.trip-tile')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Load more photos' })).toHaveCount(0)
})
