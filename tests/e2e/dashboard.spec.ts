import { test, expect } from './fixtures'
import { boot, dashboard, failNext, openTrip, checkLayout } from './helpers'

test('totals, trip summaries and recently uploaded agree with seeded data', async ({ page }) => {
  await boot(page)
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await expect(page.locator('.stat-tile-value')).toHaveText(['12', '5', '5', '2'])
  await expect(page.locator('.trip-card-title')).toHaveText(['Rome with family', 'Weekend in Helsinki', 'Europe by rail'])
  await expect(page.locator('.dash-recent-item')).toHaveCount(8)
  await expect(page.locator('.dash-recent-item').first()).toContainText('Needs location')
  await expect(page.getByText('Sorted by upload date')).toBeVisible()
})

test('create validates blank titles, trims whitespace and opens a private empty trip', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Trip name' })
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('maxlength', '120')
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
  await name.fill('   ')
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled()
  await name.fill('  Kyoto autumn  ')
  await name.press('Enter')
  await expect(page.getByRole('heading', { name: 'Kyoto autumn', exact: true })).toBeVisible()
  await expect(page.getByText('No photos in this trip yet.', { exact: false })).toBeVisible()
  await expect(page.getByText('Private', { exact: true })).toBeVisible()
  await dashboard(page)
  await expect(page.locator('.trip-card')).toHaveCount(4)
  await expect(page.locator('.trip-card-title').first()).toHaveText('Kyoto autumn')
})

test('Cancel and Escape discard creation without creating a trip', async ({ page }) => {
  await boot(page)
  for (const cancel of ['button', 'escape']) {
    await page.getByRole('button', { name: 'Create trip', exact: true }).click()
    await page.getByLabel('Trip name').fill('Discard me')
    if (cancel === 'button') await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    else await page.keyboard.press('Escape')
    await expect(page.getByLabel('Trip name')).toHaveCount(0)
    await expect(page.locator('.trip-card')).toHaveCount(3)
  }
})

test('failed creation retains input and can be retried once', async ({ page }) => {
  await boot(page)
  await failNext(page, 'createTrip')
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await page.getByLabel('Trip name').fill('Retry trip')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be created')
  await expect(page.getByLabel('Trip name')).toHaveValue('Retry trip')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Retry trip', exact: true })).toBeVisible()
  await dashboard(page)
  await expect(page.locator('.trip-card')).toHaveCount(4)
})

test('empty Dashboard offers creation and disables upload until a trip exists', async ({ page }) => {
  await boot(page, { scenario: 'empty' })
  await expect(page.getByRole('heading', { name: 'No trips yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeDisabled()
  await expect(page.getByText('Photos you upload will appear here.')).toBeVisible()
  await page.getByRole('button', { name: 'Create your first trip' }).click()
  await page.getByLabel('Trip name').fill('First trip')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'First trip', exact: true })).toBeVisible()
  await dashboard(page)
  await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeEnabled()
})

test('Dashboard load failure has a working retry', async ({ page }) => {
  await boot(page, { failures: { summary: 1 } })
  await expect(page.getByRole('alert')).toContainText('Dashboard could not be loaded')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('upload chooser changes destination and both dismissal controls work', async ({ page }) => {
  await boot(page)
  for (const cancel of ['button', 'escape']) {
    await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
    await page.getByLabel('Trip', { exact: true }).selectOption('trip-europe')
    await expect(page.getByLabel('Trip', { exact: true })).toHaveValue('trip-europe')
    if (cancel === 'button') await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    else await page.getByLabel('Trip', { exact: true }).press('Escape')
    await expect(page.getByLabel('Trip', { exact: true })).toHaveCount(0)
    await expect(page.locator('.trip-card')).toHaveCount(3)
  }
})

test('each trip card opens its own trip and map filter', async ({ page }) => {
  await boot(page)
  for (const [title, id, count] of [['Rome with family', 'trip-rome', 2], ['Weekend in Helsinki', 'trip-helsinki', 2], ['Europe by rail', 'trip-europe', 7]] as const) {
    await openTrip(page, title)
    await dashboard(page)
    await page.getByRole('article', { name: title, exact: true }).getByRole('button', { name: 'Show on map' }).click()
    await expect(page.getByLabel('Trip', { exact: true })).toHaveValue(id)
    await expect(page.locator('.mp-count')).toHaveText(`${count} photos on the map`)
    await dashboard(page)
  }
})

test('long trip and place text fits Dashboard and Trip', async ({ page }) => {
  await boot(page, { scenario: 'long-content' })
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await checkLayout(page)
  await openTrip(page, 'T'.repeat(120))
  await checkLayout(page)
})
