import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { boot, checkLayout, openAccountMenu, openTrip } from './helpers'

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

// Flow and clarity polish (26 November): no new features, the same flows made explicit.

test('every trip card cover has the same size, whatever the photo shape', async ({ page }) => {
  await boot(page)
  const covers = page.locator('.trip-card-cover')
  await expect(covers).toHaveCount(3)
  const boxes = await covers.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height))
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(1)
  const cards = await page.locator('.trip-card').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top))
  expect(new Set(cards.map((top) => Math.round(top))).size).toBeLessThanOrEqual(3)
})

test('the account menu holds Sign out and Delete account, and closes with Escape', async ({ page }) => {
  await boot(page)
  const button = page.getByRole('button', { name: 'Account: Demo account' })
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0)
  await openAccountMenu(page)
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Delete account…' })).toBeVisible()
  await checkLayout(page)
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(button).toBeFocused()

  // A click elsewhere closes it too.
  await openAccountMenu(page)
  const viewport = page.viewportSize()!
  await page.mouse.click(4, viewport.height - 4)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('a new owner gets a getting-started guide that ticks itself off and can be hidden', async ({ page }) => {
  await boot(page, { scenario: 'empty' })
  const guide = page.getByRole('region', { name: 'Getting started' })
  await expect(guide).toContainText('0 of 3 done')
  await expect(guide.getByRole('button', { name: 'Choose photos' })).toBeDisabled()
  await checkLayout(page)

  await guide.getByRole('button', { name: 'Start a trip' }).click()
  await page.getByRole('textbox', { name: 'Trip name' }).fill('Lapland')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Lapland', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dashboard' }).first().click()
  await expect(guide).toContainText('1 of 3 done')
  await expect(guide.getByText('Create a trip (done)')).toBeAttached()

  await guide.getByRole('button', { name: 'Hide the getting started guide' }).click()
  await expect(guide).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0)
})

test('the guide shows only what is left, and Review places opens the trip that needs it', async ({ page }) => {
  await boot(page)
  await expect(page.locator('.trip-card')).toHaveCount(3)
  const guide = page.getByRole('region', { name: 'Getting started' })
  await expect(guide).toContainText('2 of 3 done')
  await expect(guide.getByText('Upload photos (done)')).toBeAttached()
  await guide.getByRole('button', { name: 'Review places' }).click()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
})

test('checking one photo place completes onboarding even when other photos need review', async ({ page }) => {
  await boot(page)
  const guide = page.getByRole('region', { name: 'Getting started' })
  await expect(guide).toContainText('2 of 3 done')
  await expect(guide).toContainText('Review or confirm the place of one photo')
  await guide.getByRole('button', { name: 'Review places' }).click()
  await page.getByRole('button', { name: 'Review next' }).click()
  await page.getByRole('button', { name: 'Confirm Pantheon, Rome', exact: true }).click()
  // Wait for the asynchronous save and onboarding marker before navigating.
  await expect(page.locator('.trip-saved')).toHaveText('Location saved: Pantheon, Rome.')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mapmory.guide.places-reviewed.demo'))).toBe('1')
  await page.getByRole('button', { name: 'Dashboard' }).first().click()
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0)
})

test('guide dismissal is saved for the demo account, not as a browser-global preference', async ({ page }) => {
  await boot(page, { scenario: 'empty' })
  await page.getByRole('button', { name: 'Hide the getting started guide' }).click()
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('mapmory.guide.hidden')))
  expect(keys).toContain('mapmory.guide.hidden.demo')
  expect(keys).not.toContain('mapmory.guide.hidden')
  expect(keys).not.toContain('mapmory.guide.hidden.another-account')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Getting started' })).toHaveCount(0)
})

test('deleting a trip says which trip went, and the message can be dismissed', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Weekend in Helsinki')
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, delete trip' }).click()
  const notice = page.getByRole('status').filter({ hasText: '“Weekend in Helsinki” and its photos were deleted.' })
  await expect(notice).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss message' }).click()
  await expect(notice).toHaveCount(0)
})

test('after an upload, the next step for a photo without a location is one click away', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Weekend in Helsinki')
  await page.getByRole('button', { name: 'Upload photos' }).first().click()
  await page.locator('.upl input[type=file]').setInputFiles(fixture('no-metadata.png'))
  const next = page.getByRole('button', { name: 'Place the photo without a location' })
  await expect(next).toBeVisible()
  await next.click()
  await expect(page.getByRole('combobox', { name: 'Search for the place' })).toBeVisible()
})

test('sign-up explains the password rule and can show the password', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  const password = page.getByLabel('Password', { exact: true })
  await expect(password).toHaveAccessibleDescription(/At least 6 characters/)
  await password.fill('secret-words')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  await checkLayout(page)
})

test('Skip to content moves keyboard focus past the header', async ({ page }) => {
  await boot(page)
  // A fresh page load starts keyboard focus at the top of the document.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})
