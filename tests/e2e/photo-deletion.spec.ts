import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { boot, checkLayout, dashboard, failNext, openTrip, tabTo } from './helpers'

// Frontend #59: deleting one photo, with the backend's DELETE /api/photos/{id}
// (backend #67) played by the demo API.

const viewer = (page: Page) => page.getByRole('dialog')
const question = (page: Page) => page.getByRole('group', { name: 'Delete this photo?' })

async function openPhoto(page: Page, place: string) {
  await page.getByRole('button', { name: `View photo at ${place}`, exact: true }).click()
  await expect(viewer(page).locator('.viewer-place')).toHaveText(place)
}

test('Delete photo asks first; Keep and Escape change nothing', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openPhoto(page, 'Colosseum, Rome')

  const remove = viewer(page).getByRole('button', { name: 'Delete photo', exact: true })
  await remove.click()
  await expect(question(page)).toContainText('Colosseum, Rome is removed from this trip and from every share')
  await expect(question(page)).toContainText('cannot be undone')
  // The safe choice has focus first, and paging is paused while the question is open.
  await expect(question(page).getByRole('button', { name: 'Keep photo' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Colosseum, Rome')
  await checkLayout(page)
  // axe cannot see the viewer's dark ::backdrop, so it checks the new light
  // confirmation card only (the viewer's white-on-dark text is unchanged).
  const results = await new AxeBuilder({ page })
    .include('.photo-delete')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])

  await question(page).getByRole('button', { name: 'Keep photo' }).click()
  await expect(question(page)).toHaveCount(0)
  await expect(remove).toBeFocused()

  // Escape closes only the question; a second Escape closes the viewer.
  await remove.click()
  await page.keyboard.press('Escape')
  await expect(question(page)).toHaveCount(0)
  await expect(viewer(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer(page)).toHaveCount(0)

  // Nothing was deleted.
  await expect(page.locator('.trip-meta')).toContainText('3 photos')
  await expect(page.getByRole('button', { name: 'View photo at Colosseum, Rome', exact: true })).toBeVisible()
})

test('deleting a photo moves the viewer on and updates the trip, its cover and its share', async ({ page }) => {
  await boot(page)
  const rome = page.getByRole('article', { name: 'Rome with family', exact: true })
  await expect(rome.locator('.trip-card-cover img')).toHaveAttribute('src', /rome\.jpg/)
  await openTrip(page, 'Rome with family')
  await expect(page.locator('.trip-review')).toContainText('2 photos need your review')

  await openPhoto(page, 'Colosseum, Rome')
  await expect(viewer(page).locator('.viewer-count')).toHaveText('1 of 3')
  await viewer(page).getByRole('button', { name: 'Delete photo', exact: true }).click()
  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()

  // The viewer shows the next photo, and the trip behind it is already reloaded.
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Pantheon, Rome')
  await expect(viewer(page).locator('.viewer-count')).toHaveText('1 of 2')
  await expect(viewer(page).getByRole('button', { name: 'Delete photo', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.trip-saved')).toHaveText('Photo deleted.')
  await expect(page.locator('.trip-meta')).toContainText('2 photos')
  await expect(page.getByRole('button', { name: 'View photo at Colosseum, Rome', exact: true })).toHaveCount(0)
  await expect(page.locator('.trip-review')).toContainText('2 photos need your review')

  // The public share no longer includes the photo.
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(page.getByRole('listitem', { name: 'The Colosseum in the morning' })).toContainText('0 photos')

  // The Dashboard card counts two photos and its cover falls back to the next one.
  await dashboard(page)
  await expect(rome).toContainText('2 photos')
  await expect(rome.locator('.trip-card-cover img')).toHaveAttribute('src', /rome-pantheon\.jpg/)
})

test('a failed deletion keeps the photo, says so, and can be retried', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openPhoto(page, 'Colosseum, Rome')
  await viewer(page).getByRole('button', { name: 'Delete photo', exact: true }).click()
  await failNext(page, 'deletePhoto')
  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()

  await expect(question(page).getByRole('alert')).toHaveText(
    'The photo could not be deleted, so it is still in your trip. Try again.',
  )
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Colosseum, Rome')
  await expect(page.locator('.trip-meta')).toContainText('3 photos')

  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Pantheon, Rome')
  await expect(viewer(page).locator('.viewer-count')).toHaveText('1 of 2')
})

test('deleting the last photos closes the viewer and leaves an empty trip', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Weekend in Helsinki')
  await page.locator('.trip-view').last().click()
  await expect(viewer(page).locator('.viewer-count')).toHaveText('2 of 2')
  const first = (await page.locator('.trip-view').first().getAttribute('aria-label'))!.replace('View photo at ', '')

  // The last photo has no next one, so the viewer goes back to the previous photo.
  await viewer(page).getByRole('button', { name: 'Delete photo', exact: true }).click()
  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()
  await expect(viewer(page).locator('.viewer-place')).toHaveText(first)
  await expect(viewer(page).locator('.viewer-count')).toHaveText('1 of 1')

  await viewer(page).getByRole('button', { name: 'Delete photo', exact: true }).click()
  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()
  await expect(viewer(page)).toHaveCount(0)
  await expect(page.getByText('No photos in this trip yet.')).toBeVisible()
  await expect(page.locator('.trip-meta')).toContainText('0 photos')
})

test('a failed upload has Delete photo on its tile; photos still processing have none', async ({ page }) => {
  await boot(page, { scenario: 'photo-states' })
  await openTrip(page, 'Rome with family')
  await expect(page.locator('.trip-meta')).toContainText('6 photos')
  const failed = page.locator('.trip-tile').filter({ hasText: 'Upload failed' })
  await expect(page.locator('.trip-tile').filter({ hasText: 'Processing' }).getByRole('button', { name: 'Delete photo' })).toHaveCount(0)

  const remove = failed.getByRole('button', { name: 'Delete photo', exact: true })
  await remove.click()
  await expect(question(page)).toContainText('This failed upload is removed from this trip')
  await question(page).getByRole('button', { name: 'Keep photo' }).click()
  await expect(remove).toBeFocused()

  await remove.click()
  await question(page).getByRole('button', { name: 'Yes, delete photo' }).click()
  await expect(page.locator('.trip-tile').filter({ hasText: 'Upload failed' })).toHaveCount(0)
  await expect(page.locator('.trip-meta')).toContainText('5 photos')
})

test('a photo can be deleted with the keyboard alone', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await tabTo(page, page.getByRole('button', { name: 'View photo at Colosseum, Rome', exact: true }))
  await page.keyboard.press('Enter')
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Colosseum, Rome')

  await tabTo(page, viewer(page).getByRole('button', { name: 'Delete photo', exact: true }))
  await page.keyboard.press('Enter')
  await expect(question(page).getByRole('button', { name: 'Keep photo' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(question(page).getByRole('button', { name: 'Yes, delete photo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(viewer(page).locator('.viewer-place')).toHaveText('Pantheon, Rome')
})
