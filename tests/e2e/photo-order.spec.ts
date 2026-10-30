import { test, expect } from './fixtures'
import { boot, openTrip } from './helpers'

// The 'ordering' scenario stores these out of order; this is capture order with its tie-breaks.
const DATED = ['Trevi Fountain, Rome', 'Pantheon, Rome', 'Eiffel Tower, Paris', 'Big Ben, London', 'Colosseum, Rome']
const UNDATED = ['Helsinki Cathedral, Helsinki', 'Suomenlinna, Helsinki']

test('gallery lists photos in capture order with stable tie-breaks and undated photos in their own group', async ({ page }) => {
  await boot(page, { scenario: 'ordering' })
  await openTrip(page, 'Rome with family')
  await expect(page.locator('.trip-tile-place')).toHaveText([...DATED, ...UNDATED])
  await expect(page.getByRole('heading', { name: 'No capture date', exact: true })).toBeVisible()
  // The heading sits between the dated and the undated tiles.
  const lists = page.locator('.trip-gallery')
  await expect(lists).toHaveCount(2)
  await expect(lists.nth(0).locator('.trip-tile-place')).toHaveText(DATED)
  await expect(lists.nth(1).locator('.trip-tile-place')).toHaveText(UNDATED)

  // A malformed EXIF date reads as no capture time, and only the photo without an offset says so.
  const tile = (place: string) => page.locator('.trip-tile').filter({ hasText: place })
  await expect(tile('Helsinki Cathedral').locator('.trip-caption')).toHaveText('No capture time')
  await expect(tile('Pantheon').locator('.trip-caption')).toHaveText('20 Sept 2026, 09:00 · time zone unknown')
  await expect(tile('Trevi Fountain').locator('.trip-caption')).toHaveText('20 Sept 2026, 09:00')
  await expect(page.getByText('time zone unknown', { exact: false })).toHaveCount(1)
})

test('journey uses the same order, grouped by local capture day', async ({ page }) => {
  await boot(page, { scenario: 'ordering' })
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Journey', exact: true }).click()
  await expect(page.locator('.trip-day-title')).toHaveText([
    'Day 1 · Sunday, 20 September 2026',
    'Day 2 · Monday, 21 September 2026',
    'No capture date',
  ])
  await expect(page.locator('.trip-row .trip-tile-place')).toHaveText([...DATED, ...UNDATED])
  const row = (place: string) => page.locator('.trip-row').filter({ hasText: place })
  await expect(row('Pantheon').locator('.trip-caption')).toHaveText('09:00 · time zone unknown')
  await expect(row('Trevi Fountain').locator('.trip-caption')).toHaveText('09:00')
  await expect(row('Helsinki Cathedral').locator('.trip-caption')).toHaveText('Time unknown')
})

for (const view of ['Gallery', 'Journey'] as const) {
  test(`viewer pages through photos in the ${view.toLowerCase()} order`, async ({ page }) => {
    await boot(page, { scenario: 'ordering' })
    await openTrip(page, 'Rome with family')
    await page.getByRole('button', { name: view, exact: true }).click()
    await page.getByRole('button', { name: 'View photo at Trevi Fountain, Rome' }).click()
    const dialog = page.getByRole('dialog')
    const seen: string[] = []
    for (let i = 0; i < DATED.length + UNDATED.length; i++) {
      seen.push((await dialog.locator('.viewer-place').textContent()) ?? '')
      if (i === 1) await expect(dialog.locator('.viewer-caption')).toContainText('time zone unknown')
      await page.keyboard.press('ArrowRight')
    }
    expect(seen).toEqual([...DATED, ...UNDATED])
  })
}
