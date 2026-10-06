import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { checkLayout, openRome, tabTo } from './helpers'

const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') await route.continue()
    else await route.abort()
  })
  await page.goto('/')
  await openRome(page)
  await tabTo(page, page.getByRole('button', { name: 'Upload photos', exact: true }))
  await page.keyboard.press('Enter')
})

test('demo uploads show progress, retain GPS/time, and offer correction for missing GPS', async ({ page }) => {
  const input = page.locator('.upl input[type=file]')
  await tabTo(page, input)
  await expect(input).toBeFocused()
  await input.setInputFiles([fixture('with-gps.jpg'), fixture('no-metadata.png')])
  await expect(page.locator('.upl-state').filter({ hasText: 'Uploading' }).first()).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Done: 1 on the map, 1 need a location, 0 failed' })).toBeVisible()
  const located = page.locator('.upl-item').filter({ hasText: 'with-gps.jpg' })
  await expect(located).toContainText('Ready')
  await expect(located).toContainText('GPS 48.8583, 2.2944')
  await expect(located).toContainText('Taken 1 Jun 2026, 09:12')
  const missing = page.locator('.upl-item').filter({ hasText: 'no-metadata.png' })
  await expect(missing).toContainText('Needs location')
  await tabTo(page, missing.getByRole('button', { name: 'Set location', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Search for the place', exact: true })).toBeFocused()
  await checkLayout(page)
})

test('malformed EXIF dates display as unknown without breaking the trip', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.locator('.upl input[type=file]').setInputFiles(fixture('invalid-date.jpg'))
  const item = page.locator('.upl-item').filter({ hasText: 'invalid-date.jpg' })
  await expect(item).toContainText('Ready')
  await expect(item).toContainText('No capture time in file')
  await expect(item).toContainText('GPS 48.8583, 2.2944')
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('invalid files show a readable failure and keyboard-accessible retry', async ({ page }) => {
  await page.locator('.upl input[type=file]').setInputFiles({ name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') })
  const item = page.locator('.upl-item').filter({ hasText: 'not-an-image.txt' })
  await expect(item).toContainText('Failed')
  await expect(item).toContainText('This is not a JPEG or PNG image.')
  await tabTo(page, item.getByRole('button', { name: 'Retry', exact: true }))
  await page.keyboard.press('Enter')
  await expect(item).toContainText('Uploading')
  await expect(item).toContainText('Failed')
  await expect(page.locator('.upl-item')).toHaveCount(1)
})

test('the exact contract byte limit is accepted and one byte over is rejected', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser run is sufficient for the size boundary.')
  const png = readFileSync(fixture('no-metadata.png'))
  const padded = (size: number) => { const buffer = Buffer.alloc(size); png.copy(buffer); return buffer }
  await page.locator('.upl input[type=file]').setInputFiles([
    { name: 'at-limit.png', mimeType: 'image/png', buffer: padded(25_000_000) },
    { name: 'over-limit.png', mimeType: 'image/png', buffer: padded(25_000_001) },
  ])
  const accepted = page.locator('.upl-item').filter({ hasText: 'at-limit.png' })
  const rejected = page.locator('.upl-item').filter({ hasText: 'over-limit.png' })
  await expect(accepted).toContainText('Needs location')
  await expect(rejected).toContainText('Failed')
  await expect(rejected).toContainText('The file is larger than 25 MB.')
})
