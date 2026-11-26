import { expect, type Locator, type Page } from '@playwright/test'

/** Reach controls through the keyboard rather than assigning focus directly. */
export async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 100; step++) {
    if (await target.evaluate((element) => document.activeElement === element)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

export async function openRome(page: Page) {
  const card = page.locator('.trip-card').filter({ hasText: 'Rome with family' })
  await card.getByRole('button', { name: 'Open trip', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true })).toBeVisible()
}

export async function checkLayout(page: Page) {
  await expect.poll(() =>
    page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth
    )
  ).toBeLessThanOrEqual(1)

  const controls = page.locator(
    'button:visible, input:visible, select:visible'
  )

  for (const control of await controls.all()) {
    const box = await control.boundingBox()
    if (!box) continue

    const viewportWidth = page.viewportSize()!.width
    const hasOverflow =
      box.x < -1 || box.x + box.width > viewportWidth + 1

    if (hasOverflow) {
      const diagnostics = await diagnoseOverflow(page)

      console.error('[checkLayout] Overflow detected:', {
        viewportWidth,
        control: await control.evaluate((element) => ({
          tag: element.tagName,
          className: element.getAttribute('class'),
          label: element.getAttribute('aria-label'),
          text: element.textContent?.trim().slice(0, 80),
        })),
        boundingBox: box,
        overflowingElements: diagnostics,
      })
    }

    expect(box.width).toBeGreaterThan(0)
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 1)
  }
}

export async function boot(page: Page, options: import('../../src/api/acceptanceOptions').AcceptanceOptions = {}) {
  await page.addInitScript((value) => {
    Object.assign(globalThis, { __MAPMORY_ACCEPTANCE__: value })
  }, options)
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

export async function dashboard(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
}

export async function openTrip(page: Page, title: string) {
  await page.getByRole('article', { name: title, exact: true }).getByRole('button', { name: 'Open trip', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
}

export async function openMap(page: Page, count = 11) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Map', exact: true }).click()
  await expect(page.locator('.mp-count')).toHaveText(`${count} ${count === 1 ? 'photo' : 'photos'} on the map`)
}

export async function failNext(page: Page, operation: import('../../src/api/acceptanceOptions').MockOperation) {
  await page.evaluate((operation) => {
    const options = (globalThis as typeof globalThis & { __MAPMORY_ACCEPTANCE__: import('../../src/api/acceptanceOptions').AcceptanceOptions }).__MAPMORY_ACCEPTANCE__
    options.failures ??= {}
    options.failures[operation] = 1
  }, operation)
}

export async function diagnoseOverflow(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth

    return [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect()

        return {
          tag: element.tagName,
          className:
            typeof element.className === 'string'
              ? element.className
              : '',
          label: element.getAttribute('aria-label'),
          x: rect.x,
          right: rect.right,
          width: rect.width,
        }
      })
      .filter((item) => item.width > 0 && (
        item.x < -1 || item.right > viewportWidth + 1
      ))
      .sort((a, b) => b.right - a.right)
      .slice(0, 20)
  })
}
/** Opens the header's account menu (it holds Sign out and Delete account). */
export async function openAccountMenu(page: Page) {
  const button = page.getByRole('button', { name: /^Account: / })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
}

export async function signOut(page: Page) {
  await openAccountMenu(page)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
}
