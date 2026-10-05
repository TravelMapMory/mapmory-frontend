import { expect, test as base } from '@playwright/test'

/** Fail on browser errors, and isolate acceptance checks from external services. */
export const test = base.extend<{ browserErrors: void; externalRequestsBlocked: void }>({
  externalRequestsBlocked: [async ({ page }, use) => {
    await page.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname
      if (host === '127.0.0.1' || host === 'localhost') await route.continue()
      else await route.abort()
    })
    await use()
  }, { auto: true }],
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = []
    const onError = (error: Error) => errors.push(error.message)
    page.on('pageerror', onError)
    await use()
    page.off('pageerror', onError)
    expect(errors, 'Uncaught browser errors').toEqual([])
  }, { auto: true }],
})

export { expect }
