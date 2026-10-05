import { expect, test as base } from '@playwright/test'

/** Surface rendering and map lifecycle errors instead of accepting a visually intact screen. */
export const test = base.extend<{ browserErrors: void }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = []
    const onError = (error: Error) => errors.push(error.message)
    page.on('pageerror', onError)
    await use()
    page.off('pageerror', onError)
    expect(errors, 'Uncaught browser errors').toEqual([])
  }, { auto: true }],
})
