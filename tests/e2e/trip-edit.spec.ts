import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { boot, checkLayout, failNext, openTrip, tabTo } from './helpers'

async function openEditor(page: Page) {
  await page.getByRole('button', { name: 'Edit details', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit trip details' })).toBeVisible()
  await expect(page.getByLabel('Trip name')).toBeFocused()
}

test('owner renames a trip and edits its notes, and the Dashboard shows the new title', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openEditor(page)
  await expect(page.getByLabel('Trip name')).toHaveValue('Rome with family')
  await expect(page.getByLabel(/Notes/)).toHaveValue('One photo was scanned from a print, so it has no GPS.')
  await checkLayout(page)

  await page.getByLabel('Trip name').fill('  Rome, summer 2026  ')
  await page.getByLabel(/Notes/).fill('Grandma came too.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Rome, summer 2026', exact: true, level: 1 })).toBeVisible()
  await expect(page.locator('.trip-notes')).toHaveText('Grandma came too.')
  await expect(page.locator('.trip-saved')).toHaveText('Trip details saved.')
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeFocused()
  // The photos stay loaded while the header changes.
  await expect(page.locator('.trip-tile')).toHaveCount(3)

  await page.locator('.trip-back').click()
  await expect(page.getByRole('article', { name: 'Rome, summer 2026', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Rome with family', exact: true })).toHaveCount(0)
  await openTrip(page, 'Rome, summer 2026')
  await expect(page.locator('.trip-notes')).toHaveText('Grandma came too.')
})

test('clearing the notes removes them, and a trip without notes can get some', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openEditor(page)
  await page.getByLabel(/Notes/).fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.trip-saved')).toHaveText('Trip details saved.')
  await expect(page.locator('.trip-notes')).toHaveCount(0)

  await page.locator('.trip-back').click()
  await openTrip(page, 'Weekend in Helsinki')
  await expect(page.locator('.trip-notes')).toHaveCount(0)
  await openEditor(page)
  await expect(page.getByLabel(/Notes/)).toHaveValue('')
  await page.getByLabel(/Notes/).fill('Ferry to Suomenlinna on Sunday.')
  await expect(page.locator('.trip-edit-count')).toHaveText('31 / 2000')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.trip-notes')).toHaveText('Ferry to Suomenlinna on Sunday.')
})

test('Cancel and Escape leave the trip unchanged and return focus', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Europe by rail')
  await openEditor(page)
  await page.getByLabel('Trip name').fill('Something else')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Europe by rail', exact: true, level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeFocused()

  await openEditor(page)
  // The draft from before Cancel is gone: the form starts from the saved trip.
  await expect(page.getByLabel('Trip name')).toHaveValue('Europe by rail')
  await page.getByLabel(/Notes/).fill('Not this')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Edit trip details' })).toHaveCount(0)
  await expect(page.locator('.trip-notes')).toHaveText('Interrail pass, five cities in two weeks.')
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeFocused()
})

test('an empty trip name is refused without a request, and unchanged details just close', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openEditor(page)
  // A failure armed here would surface if Save sent a request.
  await failNext(page, 'updateTrip')
  await page.getByLabel('Trip name').fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Enter a trip name.')).toBeVisible()
  await expect(page.getByLabel('Trip name')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Trip name')).toBeFocused()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await page.getByLabel('Trip name').fill('Rome with family')
  await expect(page.getByText('Enter a trip name.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit trip details' })).toHaveCount(0)
  await expect(page.locator('.trip-saved')).toHaveCount(0)
})

test('a failed save keeps the draft and can be retried', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Rome with family')
  await openEditor(page)
  await page.getByLabel('Trip name').fill('Rome again')
  await page.getByLabel(/Notes/).fill('Draft notes')
  await failNext(page, 'updateTrip')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be saved')
  await expect(page.getByLabel('Trip name')).toHaveValue('Rome again')
  await expect(page.getByLabel(/Notes/)).toHaveValue('Draft notes')
  await expect(page.getByRole('heading', { name: 'Rome with family', exact: true, level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rome again', exact: true, level: 1 })).toBeVisible()
  await expect(page.locator('.trip-notes')).toHaveText('Draft notes')
})

test('the details can be edited with the keyboard alone', async ({ page }) => {
  await boot(page)
  await openTrip(page, 'Weekend in Helsinki')
  await tabTo(page, page.getByRole('button', { name: 'Edit details', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Trip name')).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Helsinki in September')
  // Enter in the name field submits the form.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Helsinki in September', exact: true, level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit details', exact: true })).toBeFocused()
})
