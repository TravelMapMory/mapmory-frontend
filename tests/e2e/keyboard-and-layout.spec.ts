import { test, expect } from './fixtures'
import { boot, openMap, openTrip, dashboard, checkLayout, tabTo } from './helpers'

async function keyboardControls(page: import('@playwright/test').Page) {
  const controls = page.locator('button:visible:not([disabled]), input:visible:not([disabled]), select:visible:not([disabled])')
  for (const target of await controls.all()) {
    await tabTo(page, target)
    await expect(target).toBeFocused()
    const focus = await target.evaluate((element) => {
      // Search fields and map pins deliberately put the ring on a wrapper or child.
      const candidates = [element, element.parentElement, ...element.querySelectorAll('*')]
      return candidates.some((node) => {
        if (!node) return false
        const style = getComputedStyle(node)
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
      })
    })
    expect(focus, `visible focus on ${await target.getAttribute('aria-label') ?? await target.textContent()}`).toBe(true)
  }
}

test('every enabled form and navigation control can be reached by Tab with visible focus', async ({ page }) => {
  await boot(page)
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await keyboardControls(page)
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await page.getByLabel('Trip name').fill('Keyboard trip')
  await keyboardControls(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await keyboardControls(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await openMap(page)
  await keyboardControls(page)
  await dashboard(page)
  await openTrip(page, 'Rome with family')
  await keyboardControls(page)
  await page.getByRole('button', { name: 'Set location', exact: true }).click()
  await keyboardControls(page)
})

test('expanded forms, suggestions, journey and upload fit every configured width', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await page.getByLabel('Trip name').fill('T'.repeat(120))
  await checkLayout(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await openMap(page)
  await page.getByRole('combobox', { name: 'Find a place' }).fill('Paris')
  await expect(page.getByRole('option', { name: 'Paris, France' })).toBeVisible()
  await checkLayout(page)
  await dashboard(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Journey', exact: true }).click()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Upload photos', exact: true }).click()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Set location', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search for the place' }).fill('Paris')
  await expect(page.getByRole('option', { name: 'Paris, France' })).toBeVisible()
  await checkLayout(page)
})

test('photo and trip navigation layout fits without covering adjacent controls', async ({ page }) => {
  await boot(page, { scenario: 'places' })
  await openMap(page, 4)
  await page.getByRole('button', { name: '3 photos near Paris', exact: true }).click()
  await expect(page.locator('.mp-selected')).toBeVisible()
  await checkLayout(page)
  for (const label of ['Previous photo', 'Next photo', 'Close photo details', 'Next trip: Paris trip B']) {
    const target = page.getByRole('button', { name: label, exact: true })
    await target.scrollIntoViewIfNeeded()
    expect(await target.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return hit === element || element.contains(hit)
    }), `${label} is not covered`).toBe(true)
  }
  await page.getByRole('button', { name: 'Close photo details' }).click()
  await expect(page.locator('.mp-selected')).toHaveCount(0)
})

test('keyboard submit does not create duplicates while the form is saving', async ({ page }) => {
  await boot(page, { delayMs: 400 })
  await expect(page.locator('.trip-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await page.getByLabel('Trip name').fill('Single trip')
  await page.getByLabel('Trip name').press('Enter')
  await expect(page.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await page.getByLabel('Trip name').press('Enter')
  await expect(page.getByRole('heading', { name: 'Single trip', exact: true })).toBeVisible()
  await dashboard(page)
  await expect(page.locator('.trip-card')).toHaveCount(4)
})

test('new search text cannot select an old suggestion during debounce', async ({ page }) => {
  await boot(page)
  await openMap(page)
  const search = page.getByRole('combobox', { name: 'Find a place' })
  await search.fill('Paris')
  await expect(page.getByRole('option', { name: 'Paris, France' })).toBeVisible()
  await search.fill('Tokyo')
  await search.press('Enter')
  await expect(search).toHaveValue('Tokyo')
  await expect(page.getByRole('option', { name: 'Tokyo, Japan' })).toBeVisible()
  await search.fill('P')
  await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/)
})

test('date filtering excludes unknown capture dates without hiding them in Trip', async ({ page }) => {
  await boot(page, { scenario: 'undated' })
  await openMap(page)
  await page.getByLabel('From', { exact: true }).fill('2026-01-01')
  await expect(page.locator('.mp-count')).toHaveText('0 photos on the map')
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(page.locator('.mp-count')).toHaveText('11 photos on the map')
  await dashboard(page)
  await openTrip(page, 'Europe by rail')
  await expect(page.locator('.trip-tile')).toHaveCount(7)
})

test('long place and trip labels fit the open map details', async ({ page }) => {
  await boot(page, { scenario: 'long-content' })
  await openMap(page)
  await page.getByRole('searchbox', { name: 'Filter my photos' }).fill('C'.repeat(120))
  await expect(page.locator('.mp-count')).toHaveText('1 photo on the map')
  await page.getByRole('button', { name: `Photo at ${'P'.repeat(180)}`, exact: true }).click()
  await expect(page.locator('.mp-selected')).toBeVisible()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Close photo details' }).click()
  await expect(page.locator('.mp-selected')).toHaveCount(0)
})
