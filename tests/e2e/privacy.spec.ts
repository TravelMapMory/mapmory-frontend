import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { boot, checkLayout, openAccountMenu, tabTo } from './helpers'

/*
 * Issue #58: a public privacy policy at /privacy, reachable without an
 * account, from the landing page, the sign-up form and the account menu.
 */
/** Locates the page's level-1 heading, the marker that the policy rendered. */
const policyHeading = (page: Page) => page.getByRole('heading', { name: 'Privacy policy', level: 1 })

test('opens signed out with the effective date and the contact link', async ({ page }) => {
  await page.goto('/privacy')
  await expect(policyHeading(page)).toBeVisible()
  await expect(page).toHaveTitle('Privacy policy · MapMory')
  await expect(page.getByText('Effective 27 November 2026', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'In short', level: 2 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'GitHub issue tracker' })).toHaveAttribute(
    'href',
    'https://github.com/TravelMapMory/mapmory-frontend/issues',
  )
  await expect(page.getByText('Do not post personal data, photos')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await checkLayout(page)
})

test('the landing page and the sign-up form link to it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacy policy' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(policyHeading(page)).toBeVisible()

  await page.goto('/signup')
  await page.getByRole('link', { name: 'privacy policy' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(policyHeading(page)).toBeVisible()
})

test('the landing link is reachable and opens with the keyboard', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Privacy policy' })
  await tabTo(page, link)
  await page.keyboard.press('Enter')
  await expect(policyHeading(page)).toBeVisible()
})

test('a signed-in owner reaches it from the account menu and keeps the header', async ({ page }) => {
  await boot(page)
  await openAccountMenu(page)
  await page.getByRole('button', { name: 'Privacy policy', exact: true }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(policyHeading(page)).toBeVisible()
  const tabs = page.getByRole('navigation', { name: 'Main' })
  await expect(tabs.getByRole('button', { name: 'Dashboard', exact: true })).not.toHaveAttribute('aria-current', 'page')
  await page.reload()
  await expect(policyHeading(page)).toBeVisible()
  await checkLayout(page)
})

test('has no automated WCAG A/AA problems', async ({ page }) => {
  await page.goto('/privacy')
  await expect(policyHeading(page)).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
})
