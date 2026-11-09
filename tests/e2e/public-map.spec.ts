import type { Page } from '@playwright/test'
import type { AcceptanceOptions } from '../../src/api/acceptanceOptions'
import { test, expect } from './fixtures'
import { boot, checkLayout, openMap, tabTo } from './helpers'

/**
 * Seeded public shares (src/api/mock.ts): Paris ×2 and Berlin ×1 from one
 * share, Helsinki ×2, Rome ×1. A reported share (Trevi Fountain, Rome) and
 * an unpublished one (London) must never appear, nor any private photo.
 */
const EUROPE = { lat: 52, lng: 12, zoom: 3 }

/** Starts the app with the public map framed on `view`, as if the visitor had left it there. */
async function prepare(page: Page, options: AcceptanceOptions = {}, view = EUROPE) {
  await page.addInitScript(
    ([value, saved]) => {
      Object.assign(globalThis, { __MAPMORY_ACCEPTANCE__: value })
      sessionStorage.setItem('mapmory.publicMapView', JSON.stringify(saved))
    },
    [options, view] as const,
  )
}

async function openPublicMap(page: Page, options: AcceptanceOptions = {}, view = EUROPE) {
  await prepare(page, options, view)
  await page.goto('/map/public')
  await expect(page.getByRole('heading', { name: 'Public map', exact: true })).toBeVisible()
}

const count = (page: Page) => page.locator('.mp-count')
const markers = (page: Page) => page.locator('.mapscreen-canvas .leaflet-marker-icon')

test('a signed-out visitor opens the public map from the landing page', async ({ page }) => {
  await prepare(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the public map', exact: true }).click()
  await expect(page).toHaveURL(/\/map\/public$/)
  await expect(page.getByRole('heading', { name: 'Public map', exact: true })).toBeVisible()
  // No owner navigation and no private collection filter (doc 4).
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Map mode' })).toHaveCount(0)
  await expect(page.getByRole('searchbox', { name: 'Filter my photos' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Find a place' })).toBeVisible()
  await expect(count(page)).toHaveText('6 public photos in this area')
  await checkLayout(page)

  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Log in to MapMory', exact: true })).toBeVisible()
})

test('only listed public shares appear, placed by city', async ({ page }) => {
  await openPublicMap(page)
  await expect(count(page)).toHaveText('6 public photos in this area')
  await expect(markers(page)).toHaveCount(4)
  for (const name of ['2 public photos near Paris', 'Public photo in Berlin', 'Public photo in Rome', '2 public photos near Helsinki']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  }
  // London's share was unpublished; Trevi Fountain's was reported, so Rome has only the Colosseum.
  await expect(page.getByRole('button', { name: /London/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /photos near Rome/ })).toHaveCount(0)
})

test('a place cluster lists its shares, which open as their own page and lead back', async ({ page }) => {
  await openPublicMap(page)
  await page.getByRole('button', { name: '2 public photos near Paris', exact: true }).click()
  const heading = page.getByRole('heading', { name: 'Paris', exact: true })
  await expect(heading).toBeFocused()
  await expect(page.getByText('2 public photos from 1 share', { exact: true })).toBeVisible()
  const share = page.getByRole('button', { name: /Paris and Berlin highlights/ })
  await expect(share).toContainText('2 photos here')
  await expect(share).toContainText('Public')
  await checkLayout(page)

  await share.click()
  await expect(page).toHaveURL(/\/public\/share-pub-europe$/)
  await expect(page.getByRole('heading', { name: 'Paris and Berlin highlights', exact: true })).toBeVisible()
  await expect(page.getByText('Shared publicly', { exact: true })).toBeVisible()
  // The whole share (3 photos), but nothing else from the trip.
  await expect(page.locator('.shared-tile')).toHaveCount(3)
  await expect(page.getByText('Photos are placed by city only.')).toBeVisible()
  await checkLayout(page)

  await page.getByRole('button', { name: 'Public map', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Public map', exact: true })).toBeVisible()
  // The map comes back where the visitor left it.
  await expect(page.getByRole('button', { name: '2 public photos near Paris', exact: true })).toBeVisible()
})

test('Escape and Close dismiss the selected place', async ({ page }) => {
  await openPublicMap(page)
  await page.getByRole('button', { name: '2 public photos near Helsinki', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Helsinki', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Helsinki', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '2 public photos near Helsinki', exact: true }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Helsinki', exact: true })).toHaveCount(0)
})

test('a pin opens from the keyboard', async ({ page }) => {
  await openPublicMap(page)
  const pin = page.getByRole('button', { name: 'Public photo in Rome', exact: true })
  await tabTo(page, pin)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Rome', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: /The Colosseum in the morning/ })).toContainText('1 photo here')
})

test('a cluster covering several cities zooms in and asks for the new area', async ({ page }) => {
  await openPublicMap(page, {}, { lat: 50, lng: 10, zoom: 2 })
  const merged = page.getByRole('button', { name: '4 public photos near Paris', exact: true })
  await expect(merged).toBeVisible()
  await merged.click()
  await expect(page.getByRole('button', { name: '2 public photos near Paris', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Public photo in Berlin', exact: true })).toBeVisible()
  // Zooming in is not a selection.
  await expect(page.getByRole('heading', { name: 'Paris', exact: true })).toHaveCount(0)
})

test('Find a place moves the map, and an area without public photos says so', async ({ page }) => {
  await openPublicMap(page)
  const search = page.getByRole('combobox', { name: 'Find a place' })
  await search.fill('Helsinki')
  await page.getByRole('option', { name: 'Helsinki, Finland', exact: true }).click()
  await expect(count(page)).toHaveText('2 public photos in this area')
  await expect(markers(page)).toHaveCount(1)

  await search.fill('Tokyo')
  await page.getByRole('option', { name: 'Tokyo, Japan', exact: true }).click()
  await expect(count(page)).toHaveText('0 public photos in this area')
  await expect(page.getByText('No public photos in this area yet.', { exact: false })).toBeVisible()
  await expect(markers(page)).toHaveCount(0)
})

test('a failed load can be retried', async ({ page }) => {
  await openPublicMap(page, { failures: { publicMap: 1 } })
  await expect(page.getByRole('alert')).toContainText('Public photos could not be loaded.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(count(page)).toHaveText('6 public photos in this area')
})

test('the server answer is capped at 200 clusters and says so', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Needs a screen large enough for more than 200 grid cells.')
  await page.setViewportSize({ width: 1920, height: 1200 })
  await openPublicMap(page, { scenario: 'public-many' }, { lat: 48, lng: 10, zoom: 4 })
  await expect(page.getByText('Showing the 200 largest groups of photos in this area.', { exact: false })).toBeVisible()
  await expect(markers(page)).toHaveCount(200)

  // Zoomed in on one city the area holds far fewer groups, and the note goes away.
  await page.getByRole('combobox', { name: 'Find a place' }).fill('Paris')
  await page.getByRole('option', { name: 'Paris, France', exact: true }).click()
  await expect(count(page)).toHaveText('2 public photos in this area')
  await expect(page.getByText('Showing the 200 largest groups', { exact: false })).toHaveCount(0)
})

test('a share that is not listed publicly cannot be opened by its id', async ({ page }) => {
  await prepare(page)
  // Reported, unpublished, and a link-only share: all answer the same way.
  for (const id of ['share-pub-reported', 'share-pub-unpublished', 'share-europe']) {
    await page.goto(`/public/${id}`)
    await expect(page.getByRole('heading', { name: "This share isn't public", exact: true })).toBeVisible()
    await expect(page.locator('.shared-tile')).toHaveCount(0)
  }
})

test('a signed-in owner switches between My photos and Public', async ({ page }) => {
  await prepare(page)
  await boot(page)
  await openMap(page)
  const modes = page.getByRole('navigation', { name: 'Map mode' })
  await expect(modes.getByRole('button', { name: 'My photos', exact: true })).toHaveAttribute('aria-current', 'page')
  await modes.getByRole('button', { name: 'Public', exact: true }).click()
  await expect(page).toHaveURL(/\/map\/public$/)
  await expect(page.getByRole('heading', { name: 'Public map', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(modes.getByRole('button', { name: 'Public', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(count(page)).toHaveText('6 public photos in this area')
  await checkLayout(page)

  await modes.getByRole('button', { name: 'My photos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My photos', exact: true })).toBeVisible()
  await expect(page.locator('.mp-count')).toHaveText('11 photos on the map')
})
