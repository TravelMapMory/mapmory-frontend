import { test, expect } from './fixtures'
import { boot, openMap, openTrip } from './helpers'

test('each page has its own address and Back/Forward move between them', async ({ page }) => {
  await boot(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page).toHaveTitle('Dashboard · MapMory')
  await openTrip(page, 'Rome with family')
  await expect(page).toHaveURL(/\/trips\/[^/]+$/)
  await openMap(page)
  await expect(page).toHaveURL(/\/map$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
})

test('Show on map keeps the trip in the address and survives a reload', async ({ page }) => {
  await boot(page)
  const card = page.getByRole('article', { name: 'Rome with family', exact: true })
  await card.getByRole('button', { name: 'Show on map', exact: true }).click()
  await expect(page).toHaveURL(/\/map\?trip=/)
  const count = page.locator('.mp-count')
  const before = await count.textContent()
  await page.reload()
  await expect(count).toHaveText(before ?? '')
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('a signed-out visitor opening an owner page logs in and lands on that page', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  const tripUrl = page.url()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto(tripUrl)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Log in to MapMory', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
  await expect(page).toHaveURL(tripUrl)
})

test('a signed-in owner opening the landing or log-in page goes to the Dashboard', async ({ page }) => {
  await boot(page)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('switching between sign up and log in changes the address', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page).toHaveTitle('Log in · MapMory')
})

test('an unknown address shows Page not found with a way home', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Go to home page', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
})
