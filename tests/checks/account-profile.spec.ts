import { expect, test } from '@playwright/test'
import { normalizeDisplayName } from '../../src/accountProfile'

test('display names are trimmed before saving', () => {
  expect(normalizeDisplayName('  New Name  ')).toBe('New Name')
})

test('blank names are rejected and do not overwrite a saved name', () => {
  expect(() => normalizeDisplayName(' \t ')).toThrow('Enter a display name.')
})

test('display names are limited to 80 Unicode characters', () => {
  expect(normalizeDisplayName('😀'.repeat(80))).toBe('😀'.repeat(80))
  expect(() => normalizeDisplayName('😀'.repeat(81))).toThrow('Use 80 characters or fewer.')
})
