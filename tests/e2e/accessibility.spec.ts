import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { boot, openAccountMenu, openTrip } from './helpers'

/*
 * Automated WCAG 2.1 A/AA checks (design doc 4.3) on every main screen. axe
 * finds a subset of problems only; keyboard and focus behaviour are covered by
 * the other specs. The Leaflet tile layer is third-party and excluded.
 */
async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.leaflet-tile-pane')
    .analyze()
  const problems = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`,
  )
  expect(problems, `accessibility problems on ${name}`).toEqual([])
}

test('landing and sign-up pages', async ({ page }) => {
  await page.goto('/')
  await expectAccessible(page, 'landing')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expectAccessible(page, 'sign-up')
})

test('Dashboard and account menu', async ({ page }) => {
  await boot(page)
  await expectAccessible(page, 'dashboard')
  await openAccountMenu(page)
  await expectAccessible(page, 'account menu')
})

test('empty Dashboard with the getting-started guide', async ({ page }) => {
  await boot(page, { scenario: 'empty' })
  await expect(page.getByRole('region', { name: 'Getting started' })).toBeVisible()
  await expectAccessible(page, 'empty dashboard with guide')
})

test('trip page with upload, sharing and delete confirmation open', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await expectAccessible(page, 'trip')
  await page.getByRole('button', { name: 'Upload photos' }).first().click()
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click()
  await expectAccessible(page, 'trip with panels')
})

test('map, public map and a public share', async ({ page }) => {
  await boot(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.locator('.mp-count')).toBeVisible()
  await expectAccessible(page, 'map')
  await page.goto('/map/public')
  await expect(page.getByRole('heading', { name: 'Public map' })).toBeVisible()
  await expectAccessible(page, 'public map')
  await page.goto('/public/share-pub-helsinki')
  await expect(page.getByRole('heading', { name: 'Helsinki by the sea' })).toBeVisible()
  await expectAccessible(page, 'public share')
})
