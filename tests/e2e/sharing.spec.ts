import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { boot, checkLayout, failNext, openTrip } from './helpers'

/** Opens an address inside the running app, so the in-memory mock keeps the links created in this test. */
async function visit(page: Page, url: string) {
  await page.evaluate((href) => {
    window.history.pushState(null, '', new URL(href).pathname)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, url)
}

async function openShare(page: Page, trip: string) {
  await openTrip(page, trip)
  const share = page.getByRole('button', { name: 'Share', exact: true })
  await share.click()
  await expect(share).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Sharing' })).toBeVisible()
}

test('owner shares chosen photos by link and a signed-out recipient sees only those, by city', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Rome with family')
  await expect(page.getByText('This trip has no active shares.')).toBeVisible()
  await page.getByRole('button', { name: 'New share' }).click()
  await expect(page.getByText('3 of 3 photos selected')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Pantheon, Rome' }).uncheck()
  await expect(page.getByText('2 of 3 photos selected')).toBeVisible()
  await expect(page.getByText('Exact locations and the rest of this trip stay private.', { exact: false })).toBeVisible()
  await page.getByLabel('Title').fill('Rome for grandma')
  await page.getByLabel(/Description/).fill('The best two')
  await page.getByRole('button', { name: 'Preview share' }).click()
  await expect(page.getByRole('heading', { name: 'Review your share' })).toBeVisible()
  await expect(page.getByText('2 selected photos')).toBeVisible()
  await expect(page.getByText('The best two')).toBeVisible()
  await expect(page.getByText('Anyone with the link can open this collection without signing in.')).toBeVisible()
  await page.getByRole('button', { name: 'Create link' }).click()

  const link = page.getByRole('listitem', { name: 'Rome for grandma' })
  await expect(link).toContainText('2 photos')
  await expect(link.getByRole('button', { name: 'Copy link' })).toBeFocused()
  const url = await link.getByRole('textbox').inputValue()
  expect(url).toMatch(/\/s\/[A-Za-z0-9_-]{20,}$/)
  await link.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.locator('.share-message')).toHaveText(/Link copied|link is selected/)
  await checkLayout(page)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await visit(page, url)
  await expect(page.getByRole('heading', { name: 'Rome for grandma' })).toBeVisible()
  await expect(page.getByText('Shared with you')).toBeVisible()
  await expect(page.getByText('The best two')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.locator('.shared-tile')).toHaveCount(2)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon')).toHaveAttribute('title', '1 photo in Rome')

  // Nothing beyond city level, and nothing from the photo that was left out.
  const html = await page.content()
  expect(html).not.toContain('Pantheon')
  expect(html).not.toContain('Colosseum')
  expect(html).not.toContain('41.8902')
  await checkLayout(page)
})

test('a city pin narrows the recipient gallery to that city', async ({ page }) => {
  await page.goto('/s/demo-europe')
  await expect(page.getByRole('heading', { name: 'Highlights from Europe by rail' })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(3)
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3)
  await page.locator('.leaflet-marker-icon[title="1 photo in Paris"]').click()
  await expect(page.getByRole('heading', { name: 'Photos in Paris' })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(1)
  await page.getByRole('button', { name: 'Show all 3 photos' }).click()
  await expect(page.locator('.shared-tile')).toHaveCount(3)
})

test('revoked and unknown links say so instead of showing photos', async ({ page }) => {
  await page.goto('/s/demo-revoked')
  await expect(page.getByRole('heading', { name: 'This link has been turned off' })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(0)
  await page.goto('/s/not-a-real-token')
  await expect(page.getByRole('heading', { name: "This link doesn't work" })).toBeVisible()
  await page.getByRole('button', { name: 'Go to MapMory' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('owner revokes a link after confirming, and the link stops working at once', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Europe by rail')
  const link = page.getByRole('listitem', { name: 'Highlights from Europe by rail' })
  await link.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(link.getByText('Previously issued image URLs may remain accessible until they expire.', { exact: false })).toBeVisible()
  await link.getByRole('button', { name: 'Keep share' }).click()
  await expect(link).toBeVisible()
  await link.getByRole('button', { name: 'Revoke', exact: true }).click()
  await link.getByRole('button', { name: 'Revoke share' }).click()
  await expect(link).toHaveCount(0)
  await expect(page.locator('.share-message')).toContainText('New visits are blocked')
  await expect(page.getByText('This trip has no active shares.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sharing' })).toBeFocused()

  await visit(page, 'http://127.0.0.1/s/demo-europe')
  await expect(page.getByRole('heading', { name: 'This link has been turned off' })).toBeVisible()
})

test('a link needs at least one photo, and a failed create can be retried', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Weekend in Helsinki')
  await page.getByRole('button', { name: 'New share' }).click()
  await page.getByRole('button', { name: 'Select none' }).click()
  await expect(page.getByRole('button', { name: 'Preview share' })).toBeDisabled()
  await page.getByRole('button', { name: 'Select all' }).click()
  await page.getByRole('button', { name: 'Preview share' }).click()
  await failNext(page, 'createShare')
  await page.getByRole('button', { name: 'Create link' }).click()
  await expect(page.getByRole('alert')).toContainText('could not be created')
  await page.getByRole('button', { name: 'Create link' }).click()
  await expect(page.getByRole('listitem', { name: 'Weekend in Helsinki' })).toContainText('2 photos')
})

test('a failed link list offers retry', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Europe by rail')
  await failNext(page, 'listShares')
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be loaded')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('listitem', { name: 'Highlights from Europe by rail' })).toBeVisible()
})

test('a public share asks for consent, is marked Public and opens without an account', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Rome with family')
  await page.getByRole('button', { name: 'New share' }).click()
  // Link is the default audience; public is an explicit choice.
  await expect(page.getByRole('radio', { name: 'Anyone with the link' })).toBeChecked()
  await page.getByRole('radio', { name: /Public, also on the public map/ }).check()
  await expect(page.getByText('Only share photos of people who agreed to be shown publicly.', { exact: false })).toBeVisible()
  await page.getByLabel('Title').fill('Rome in public')
  await page.getByRole('button', { name: 'Preview share' }).click()
  await expect(page.getByText('Public: anyone can discover this collection on the public map, even without its link.')).toBeVisible()
  await page.getByRole('button', { name: 'Publish publicly' }).click()

  const share = page.getByRole('listitem', { name: 'Rome in public' })
  await expect(share).toContainText('Public')
  await expect(share).toContainText('3 photos')
  await expect(page.locator('.share-message')).toContainText('Public share created')
  const url = await share.getByRole('textbox').inputValue()
  await checkLayout(page)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await visit(page, url)
  await expect(page.getByRole('heading', { name: 'Rome in public' })).toBeVisible()
  await expect(page.locator('.shared-tile')).toHaveCount(3)
})


test('preview has no side effects, and back to edit retains the selection and audience', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Rome with family')
  await page.getByRole('button', { name: 'New share' }).click()
  await page.getByRole('checkbox', { name: 'Pantheon, Rome' }).uncheck()
  await page.getByLabel('Title').fill('A smaller Rome share')
  await page.getByRole('radio', { name: /Public, also on the public map/ }).check()
  await page.getByRole('button', { name: 'Preview share' }).click()
  await expect(page.getByRole('heading', { name: 'Review your share' })).toBeVisible()
  await expect(page.getByText('2 selected photos')).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'A smaller Rome share' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to edit' }).click()
  await expect(page.getByLabel('Title')).toHaveValue('A smaller Rome share')
  await expect(page.getByRole('radio', { name: /Public, also on the public map/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Pantheon, Rome' })).not.toBeChecked()
  await expect(page.getByRole('heading', { name: 'Create a share' })).toBeFocused()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('listitem', { name: 'A smaller Rome share' })).toHaveCount(0)
})


test('share preview explains privacy and warns only for selected suggested places', async ({ page }) => {
  await boot(page)
  await openShare(page, 'Rome with family')
  await page.getByRole('button', { name: 'New share' }).click()
  await page.getByRole('button', { name: 'Preview share' }).click()
  await expect(page.getByText('Detailed place names, exact GPS coordinates, and original photo metadata stay private.', { exact: false })).toBeVisible()
  // The Rome mock contains a selected Pantheon photo with label_status=suggested.
  await expect(page.locator('.share-preview-notice')).toContainText('1 selected photo has an automatically suggested place label')
  await expect(page.locator('.share-preview-notice')).toContainText('confirmation is not required')
  // No share is created by previewing; the owner may edit the selection.
  await page.getByRole('button', { name: 'Back to edit' }).click()
  await page.getByRole('checkbox', { name: 'Pantheon, Rome' }).uncheck()
  await page.getByRole('button', { name: 'Preview share' }).click()
  await expect(page.locator('.share-preview-notice')).toHaveCount(0)
  await expect(page.getByText('Detailed place names, exact GPS coordinates, and original photo metadata stay private.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('This trip has no active shares.')).toBeVisible()
})
