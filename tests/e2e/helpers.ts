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
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  const controls = page.locator('button:visible, input:visible, select:visible')
  for (const control of await controls.all()) {
    const box = await control.boundingBox()
    if (!box) continue
    expect(box.width).toBeGreaterThan(0)
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  }
}
