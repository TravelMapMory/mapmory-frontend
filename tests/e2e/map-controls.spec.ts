import { test, expect } from './fixtures'
import { boot, dashboard, openMap, failNext, checkLayout } from './helpers'

for (const [query, count] of [['Paris', 2], ['France', 2], ['Europe by rail', 7], ['  rOmE  ', 3], ['zzzz', 0]] as const) {
  test(`photo filter matches ${query} and clears`, async ({ page }) => {
    await boot(page)
    await openMap(page)
    await page.getByRole('searchbox', { name: 'Filter my photos' }).fill(query)
    await expect(page.locator('.mp-count')).toHaveText(`${count} photos on the map`)
    if (!count) await expect(page.getByText('No photos match these filters.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).first().click()
    await expect(page.locator('.mp-count')).toHaveText('11 photos on the map')
    await expect(page.getByRole('searchbox', { name: 'Filter my photos' })).toHaveValue('')
  })
}

test('date endpoints are inclusive and combine with trip and text filters', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await page.getByLabel('From', { exact: true }).fill('2026-06-01')
  await page.getByLabel('To', { exact: true }).fill('2026-06-02')
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  await expect(page.getByLabel('From', { exact: true })).toHaveAttribute('max', '2026-06-02')
  await expect(page.getByLabel('To', { exact: true })).toHaveAttribute('min', '2026-06-01')
  await page.getByLabel('Trip', { exact: true }).selectOption('trip-europe')
  await page.getByRole('searchbox', { name: 'Filter my photos' }).fill('Paris')
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  await page.getByLabel('From', { exact: true }).fill('2026-06-02')
  await expect(page.locator('.mp-count')).toHaveText('1 photo on the map')
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  for (const label of ['Trip', 'From', 'To']) await expect(page.getByLabel(label, { exact: true })).toHaveValue('')
  await expect(page.locator('.mp-count')).toHaveText('11 photos on the map')
})

test('no-match message also appears with a selected trip', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await page.getByLabel('Trip', { exact: true }).selectOption('trip-europe')
  await page.getByRole('searchbox', { name: 'Filter my photos' }).fill('zzzz')
  await expect(page.locator('.mp-count')).toHaveText('0 photos on the map')
  await expect(page.getByText('No photos match these filters.')).toBeVisible()
})

test('rapid filter changes leave only the latest result', async ({ page }) => {
  await boot(page, { delayMs: 200 })
  await openMap(page)
  const filter = page.getByRole('searchbox', { name: 'Filter my photos' })
  await filter.fill('Paris')
  await filter.fill('Rome')
  await filter.fill('Helsinki')
  await expect(page.locator('.mp-count')).toHaveText('3 photos on the map')
  await expect(page.getByRole('button', { name: /photos near Helsinki/ })).toBeVisible()
})

test('empty owner map explains missing content', async ({ page }) => {
  await boot(page, { scenario: 'empty' })
  await openMap(page, 0)
  await expect(page.getByText('No located photos yet.', { exact: false })).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0)
})

test('unlocated trip provides a working correction route', async ({ page }) => {
  await boot(page, { scenario: 'unlocated' })
  await openMap(page, 0)
  await page.getByLabel('Trip', { exact: true }).selectOption('trip-rome')
  await expect(page.getByText('has no photos with a location yet', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Correct locations' }).click()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set location', exact: true })).toHaveCount(3)
})

test('partly located trip explains omissions and opens trip', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await page.getByLabel('Trip', { exact: true }).selectOption('trip-rome')
  await expect(page.getByText('1 photo in this trip without a location', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Correct locations' }).click()
  await expect(page.getByRole('button', { name: 'Set location', exact: true })).toBeVisible()
})

test('map read failure can be retried', async ({ page }) => {
  await boot(page)
  await failNext(page, 'mapPhotos')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Photos could not be loaded')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.mp-count')).toHaveText('11 photos on the map')
})

test('world search works independently of collection filtering', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await page.getByRole('searchbox', { name: 'Filter my photos' }).fill('Paris')
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  const search = page.getByRole('combobox', { name: 'Find a place' })
  await search.fill('Tokyo')
  await page.getByRole('option', { name: 'Tokyo, Japan', exact: true }).click()
  await expect(search).toHaveValue('Tokyo, Japan')
  // Paris pins move outside the map viewport when world search flies to Tokyo.
  await expect.poll(async () => {
    const frame = await page.locator('.mapscreen-canvas').boundingBox()
    const pin = await page.locator('.mapscreen-canvas .leaflet-marker-icon').first().boundingBox()
    return Boolean(frame && pin && (pin.x + pin.width < frame.x || pin.x > frame.x + frame.width || pin.y + pin.height < frame.y || pin.y > frame.y + frame.height))
  }).toBe(true)
  await expect(search).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  await expect(page.getByRole('searchbox', { name: 'Filter my photos' })).toHaveValue('Paris')
  await checkLayout(page)
  await page.getByRole('button', { name: 'Clear find a place' }).click()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
})

test('world search handles short queries, no matches, Escape and arrow-key selection', async ({ page }) => {
  await boot(page)
  await openMap(page)
  const search = page.getByRole('combobox', { name: 'Find a place' })
  await search.fill('P')
  await expect(search).toHaveAttribute('aria-expanded', 'false')
  await search.fill('zzzz')
  await expect(page.getByText('No places found', { exact: true })).toBeVisible()
  await search.fill('Paris')
  await expect(page.getByRole('option', { name: 'Paris, France' })).toBeVisible()
  await search.press('Escape')
  await expect(search).toHaveAttribute('aria-expanded', 'false')
  await search.press('ArrowDown')
  await expect(search).toHaveAttribute('aria-expanded', 'true')
  await search.press('Enter')
  await expect(search).toHaveValue('Paris, France')
  await expect(search).toHaveAttribute('aria-expanded', 'false')
})

test('search failure is distinguished from no results and new input retries', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await failNext(page, 'searchPlaces')
  const search = page.getByRole('combobox', { name: 'Find a place' })
  await search.fill('Paris')
  await expect(page.getByText('Place search could not be loaded. Try another search.')).toBeVisible()
  await search.fill('Rome')
  await expect(page.getByRole('option', { name: 'Rome, Italy' })).toBeVisible()
})

test('same-city photos group by trip without mixing countries; all navigation wraps', async ({ page }) => {
  await boot(page, { scenario: 'places' })
  await openMap(page, 4)
  await page.getByRole('button', { name: '3 photos near Paris', exact: true }).click()
  const details = page.locator('.mp-selected')
  await expect(details).toContainText('3 photos in 2 trips')
  const photos = page.getByRole('group', { name: 'Photos in Paris trip A', exact: true })
  await expect(photos).toContainText('1 / 2')
  await photos.getByRole('button', { name: 'Previous photo' }).click()
  await expect(photos).toContainText('2 / 2')
  await photos.getByRole('button', { name: 'Next photo' }).click()
  await expect(photos).toContainText('1 / 2')
  await details.getByRole('button', { name: 'Next trip: Paris trip B' }).click()
  await expect(details).toContainText('Trip 2 of 2')
  await expect(details.getByRole('button', { name: 'Next photo' })).toHaveCount(0)
  await details.getByRole('button', { name: 'Next trip: Paris trip A' }).click()
  await expect(details).toContainText('Trip 1 of 2')
  await details.getByRole('button', { name: 'Previous trip: Paris trip B' }).click()
  await details.getByRole('button', { name: 'Open trip' }).click()
  await expect(page.getByRole('heading', { name: 'Paris trip B', exact: true })).toBeVisible()
})

test('zoom and pan move the map without changing the collection filter', async ({ page }) => {
  await boot(page)
  await openMap(page)
  await page.getByRole('searchbox', { name: 'Filter my photos' }).fill('Paris')
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  const pin = page.getByRole('button', { name: 'Photo at Eiffel Tower, Paris', exact: true })
  await expect(pin).toBeVisible()
  const before = await pin.boundingBox()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await pin.boundingBox())!.x).not.toBe(before!.x)
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const map = page.locator('.mapscreen-map .leaflet-container')
  const box = await map.boundingBox()
  const at = await pin.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 60)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2 + 60, { steps: 10 })
  await page.mouse.up()
  await expect.poll(async () => (await pin.boundingBox())!.x).not.toBe(at!.x)
  await expect(page.locator('.mp-count')).toHaveText('2 photos on the map')
  await expect(page.getByRole('searchbox', { name: 'Filter my photos' })).toHaveValue('Paris')
})

test('the layers button picks a basemap, closes on Escape or an outside click, and keeps the choice', async ({ page }) => {
  await boot(page)
  await openMap(page)
  const layers = page.getByRole('button', { name: /^Map style/ })
  const styles = page.getByRole('group', { name: 'Map style' })
  await expect(layers).toHaveAccessibleName('Map style: Map')
  await expect(layers).toHaveAttribute('aria-expanded', 'false')

  await layers.click()
  await expect(layers).toHaveAttribute('aria-expanded', 'true')
  await expect(styles.getByRole('button')).toHaveText(['Map', 'Minimal', 'Terrain', 'Satellite'])
  await expect(styles.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(styles).toHaveCount(0)
  await expect(layers).toBeFocused()

  await layers.click()
  await page.locator('.mp-count').click()
  await expect(styles).toHaveCount(0)

  await layers.click()
  await styles.getByRole('button', { name: 'Minimal', exact: true }).click()
  await expect(page.locator('.leaflet-layer.basemap-grey')).toHaveCount(1)

  await layers.click()
  await styles.getByRole('button', { name: 'Terrain', exact: true }).click()
  await expect(page.locator('.leaflet-layer.basemap-grey')).toHaveCount(0)
  await expect(styles).toHaveCount(0)
  await expect(layers).toBeFocused()
  await expect(layers).toHaveAccessibleName('Map style: Terrain')
  await expect(page.locator('.leaflet-tile-pane img').first()).toHaveAttribute('src', /opentopomap/)

  // The choice is kept when the owner leaves the map and comes back.
  await dashboard(page)
  await openMap(page)
  await expect(page.getByRole('button', { name: /^Map style/ })).toHaveAccessibleName('Map style: Terrain')
  await checkLayout(page)
})


test.describe('with motion on', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('switching between My photos and Public never pushes the page past its settled height, so no scrollbar flashes', async ({ page }) => {
    await boot(page)
    await openMap(page)
    const modes = page.getByRole('navigation', { name: 'Map mode' })
    for (const name of ['Public', 'My photos']) {
      const { before, worst, settled } = await modes.getByRole('button', { name, exact: true }).evaluate(async (button) => {
        const overflow = () => {
          const body = document.querySelector('.app-body')
          return body ? body.scrollHeight - body.clientHeight : 0
        }
        const before = overflow()
        let worst = 0
        const start = performance.now()
        ;(button as HTMLButtonElement).click()
        await new Promise<void>((resolve) => {
          const tick = () => {
            worst = Math.max(worst, overflow())
            if (performance.now() - start < 700) requestAnimationFrame(tick)
            else resolve()
          }
          tick()
        })
        await new Promise((resolve) => setTimeout(resolve, 600))
        return { before, worst, settled: overflow() }
      })
      // Phone and tablet map pages scroll by design; only overflow beyond both settled screens would flash.
      expect(worst, `overflow while switching to ${name}`).toBeLessThanOrEqual(Math.max(before, settled))
    }
  })
})
