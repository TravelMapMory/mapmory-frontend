import { test, expect } from './fixtures'
import { checkLayout } from './helpers'

test('signed-out visitors see the landing page with the three main features', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your travel photos, back where they were taken')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.locator('.land-feature-title')).toHaveText([
    'Upload your trip photos',
    'See every trip on a map',
    'Share when you choose',
  ])
  await expect(page.getByText('Private by default', { exact: true })).toBeVisible()
  await checkLayout(page)
})

test('Get started opens sign up, which can switch to log in and back', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Log in to MapMory', exact: true })).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Create an account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
})

test('creating an account with filled details opens the Dashboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await page.getByLabel('Name').fill('Kristian')
  await page.getByLabel('Email').fill('demo@example.com')
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
})

test('Sign in opens log in, any details open the Dashboard, and sign out returns to the landing page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Log in to MapMory', exact: true })).toBeVisible()
  await page.getByLabel('Password').press('Enter')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await checkLayout(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
})
