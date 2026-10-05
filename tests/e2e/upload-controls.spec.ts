import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'
import { boot, openTrip, dashboard, checkLayout } from './helpers'
const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname
const png = readFileSync(fixture('no-metadata.png'))

test('Dashboard upload uses selected destination and updates counts and recent uploads', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await page.getByLabel('Trip', { exact: true }).selectOption('trip-helsinki')
  await page.locator('.dash-file').setInputFiles({ name: 'dashboard-photo.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('heading', { name: 'Weekend in Helsinki', exact: true })).toBeVisible()
  await expect(page.locator('.upl-item')).toContainText('Needs location')
  await expect(page.locator('.trip-tile')).toHaveCount(3)
  await dashboard(page)
  await expect(page.locator('.stat-tile-value').first()).toHaveText('13')
  await expect(page.locator('.dash-recent-item').first()).toContainText('Needs location')
  await expect(page.getByRole('article', { name: 'Rome with family', exact: true })).toContainText('3 photos')
  await expect(page.getByRole('article', { name: 'Weekend in Helsinki', exact: true })).toContainText('3 photos')
})

test('mixed batch keeps valid photos, shows independent errors and completes progress', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await page.locator('.upl input[type=file]').setInputFiles([
    { name: 'with-gps.jpg', mimeType: 'image/jpeg', buffer: readFileSync(fixture('with-gps.jpg')) },
    { name: 'mixed-no-gps.png', mimeType: 'image/png', buffer: png },
    { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 0, 0]) },
    { name: 'phone.heic', mimeType: 'image/heic', buffer: Buffer.from('heic') },
  ])
  await expect(page.locator('.upl-item')).toHaveCount(4)
  await expect(page.getByRole('status').filter({ hasText: 'Done: 1 on the map, 1 need a location, 2 failed' })).toBeVisible()
  await expect(page.locator('.upl-item').filter({ hasText: 'broken.jpg' })).toContainText('Failed')
  await expect(page.locator('.upl-item').filter({ hasText: 'phone.heic' })).toContainText('HEIC')
  await expect(page.getByRole('progressbar', { name: 'Upload progress' })).toHaveAttribute('value', '4')
  await expect(page.locator('.trip-tile')).toHaveCount(5)
  await checkLayout(page)
})

test('drag and drop adds files, and further file selection appends to the same panel', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  const transfer = await page.evaluateHandle((bytes) => {
    const data = new DataTransfer()
    data.items.add(new File([Uint8Array.from(bytes)], 'dropped.png', { type: 'image/png', lastModified: 123 }))
    return data
  }, [...png])
  await page.locator('.upl-drop').dispatchEvent('dragover', { dataTransfer: transfer })
  await page.locator('.upl-drop').dispatchEvent('drop', { dataTransfer: transfer })
  await transfer.dispose()
  await expect(page.locator('.upl-item')).toContainText('Needs location')
  await page.locator('.upl input[type=file]').setInputFiles({ name: 'appended.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.upl-item')).toHaveCount(2)
  await expect(page.getByRole('status').filter({ hasText: 'Done: 0 on the map, 2 need a location, 0 failed' })).toBeVisible()
  await expect(page.locator('.trip-tile')).toHaveCount(5)
})

test('queued files finish independently and closing the panel does not break the trip', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  const toggle = page.getByRole('button', { name: 'Upload photos', exact: true })
  await toggle.click()
  await page.locator('.upl input[type=file]').setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `queued-${i}.png`, mimeType: 'image/png', buffer: png })))
  await expect(page.locator('.upl-state').filter({ hasText: 'Waiting' }).first()).toBeVisible()
  await toggle.click()
  await expect(page.locator('.upl')).toHaveCount(0)
  await expect(page.locator('.trip-tile')).toHaveCount(8)
  await toggle.click()
  await expect(page.locator('.upl input[type=file]')).toBeVisible()
  // The temporary mock does not recover the progress list when reopened.
  await expect(page.locator('.upl-item')).toHaveCount(0)
})

test('upload location action updates the row as well as the gallery', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await page.locator('.upl input[type=file]').setInputFiles({ name: 'correct-me.png', mimeType: 'image/png', buffer: png })
  const row = page.locator('.upl-item')
  await expect(row).toContainText('Needs location')
  await row.getByRole('button', { name: 'Set location', exact: true }).click()
  const search = page.getByRole('combobox', { name: 'Search for the place' })
  await search.fill('Paris')
  await page.getByRole('option', { name: 'Paris, France' }).click()
  await page.getByRole('button', { name: 'Save location' }).click()
  await expect(row).toContainText('Ready')
  await expect(row.getByRole('button', { name: 'Set location', exact: true })).toHaveCount(0)
})

test('reloading clears demo uploads as documented', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await page.locator('.upl input[type=file]').setInputFiles({ name: 'temporary.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.trip-tile')).toHaveCount(4)
  await page.reload()
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await openTrip(page, 'Rome with family')
  await expect(page.locator('.trip-tile')).toHaveCount(3)
})
