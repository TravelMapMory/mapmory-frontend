import { test, expect } from './fixtures'
import { boot, checkLayout, failNext, openTrip } from './helpers'

// Design doc 2.2 use case 6 (remove content), 3.5 (reports) and 3.6 (account deletion).

test('deleting a trip asks first, can be kept, and then removes it from the Dashboard', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')

  const open = page.getByRole('button', { name: 'Delete trip', exact: true })
  await open.click()
  await expect(open).toHaveAttribute('aria-expanded', 'true')
  const confirm = page.getByRole('group', { name: 'Delete this trip?' })
  await expect(confirm).toContainText('Delete Rome with family and its 3 photos?')
  await expect(confirm).toContainText('cannot be undone')
  // The safe choice has focus first, and keeping changes nothing.
  await expect(confirm.getByRole('button', { name: 'Keep trip' })).toBeFocused()
  await checkLayout(page)
  await confirm.getByRole('button', { name: 'Keep trip' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()

  await open.click()
  await page.getByRole('group', { name: 'Delete this trip?' }).getByRole('button', { name: 'Yes, delete trip' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Rome with family', exact: true })).toHaveCount(0)
  await expect(page.locator('.trip-card')).toHaveCount(2)
})

test('a failed trip deletion keeps the trip and can be retried', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Weekend in Helsinki')
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click()
  await failNext(page, 'deleteTrip')
  const confirm = page.getByRole('group', { name: 'Delete this trip?' })
  await confirm.getByRole('button', { name: 'Yes, delete trip' }).click()
  await expect(page.getByRole('alert')).toContainText('could not be deleted')
  await expect(page.getByRole('heading', { name: 'Weekend in Helsinki', exact: true })).toBeVisible()

  await confirm.getByRole('button', { name: 'Yes, delete trip' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Weekend in Helsinki', exact: true })).toHaveCount(0)
})

test('Escape closes the trip deletion without deleting', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Delete trip', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Delete this trip?' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
})

test('deleting the account needs an explicit confirmation and leaves an empty MapMory', async ({ page }) => {
  await boot(page)
  await page.getByRole('button', { name: 'Delete account' }).click()
  const panel = page.getByRole('region', { name: 'Delete your account?' })
  await expect(panel).toContainText('cannot be undone')
  const remove = panel.getByRole('button', { name: 'Yes, delete my account' })
  await expect(remove).toBeDisabled()
  await checkLayout(page)

  // Cancel keeps everything.
  await panel.getByRole('button', { name: 'Cancel' }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.trip-card')).toHaveCount(3)

  await page.getByRole('button', { name: 'Delete account' }).click()
  await failNext(page, 'deleteAccount')
  await panel.getByRole('checkbox').check()
  await remove.click()
  await expect(panel.getByRole('alert')).toContainText('could not be deleted')
  await expect(page.locator('.trip-card')).toHaveCount(3)

  await remove.click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()

  // Signing in again starts with nothing.
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.locator('.trip-card')).toHaveCount(0)
})

test('a visitor reports a public share, which then leaves the public map', async ({ page }) => {
  await page.goto('/public/share-pub-helsinki')
  await expect(page.getByRole('heading', { name: 'Helsinki by the sea' })).toBeVisible()
  await page.getByRole('button', { name: 'Report this share' }).click()
  const form = page.getByRole('form', { name: 'Report this share' })
  const send = form.getByRole('button', { name: 'Send report' })
  await expect(send).toBeDisabled()
  await form.getByLabel('What is wrong with it?').fill('Shows a person who did not agree to it')
  await checkLayout(page)
  await send.click()
  await expect(page.getByRole('status').filter({ hasText: 'will review this share' })).toBeVisible()

  // Reported shares are hidden until the team reviews them.
  await page.goto('/public/share-pub-helsinki')
  await expect(page.getByRole('heading', { name: "This share isn't public" })).toBeVisible()
})

test('link shares have no report button', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await page.getByRole('button', { name: 'New share' }).click()
  await page.getByLabel('Title').fill('For family')
  await page.getByRole('button', { name: 'Preview share' }).click()
  await page.getByRole('button', { name: 'Create link' }).click()
  const url = await page.getByRole('listitem', { name: 'For family' }).getByRole('textbox').inputValue()
  // Navigate inside the app, so the in-memory demo keeps the new link.
  await page.evaluate((href) => {
    window.history.pushState(null, '', new URL(href).pathname)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, url)
  await expect(page.getByRole('heading', { name: 'For family' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Report this share' })).toHaveCount(0)
})
