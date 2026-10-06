import { expect, test } from '@playwright/test'
import { parseCaptureTime } from '../../src/captureTime'
import { formatCaptured, formatDateRange } from '../../src/format'
import { placeKey } from '../../src/placeKey'

test('invalid camera dates remain unknown instead of breaking rendering', () => {
  for (const value of [null, '', '0000-01-01T00:00:00', '2026-99-99T88:88:88', '2026-02-29T12:00:00', '2026-04-31T12:00:00', '2026-06-01T24:00:00']) {
    expect(parseCaptureTime(value)).toBeNull()
    expect(formatCaptured(value)).toBeNull()
  }
  expect(formatDateRange('invalid', '2026-06-01')).toBeNull()
})

test('valid leap days and camera wall-clock time are preserved', () => {
  expect(parseCaptureTime('2024-02-29T23:59:59')?.toISOString()).toBe('2024-02-29T23:59:59.000Z')
  expect(formatCaptured('2026-06-01T09:12:00')).toContain('09:12')
})

test('same-named cities in different countries are separate places', () => {
  expect(placeKey({ country: 'France', city: 'Paris' })).not.toBe(placeKey({ country: 'United States', city: 'Paris' }))
  expect(placeKey({ country: null, city: 'Paris' })).not.toBe(placeKey({ country: 'France', city: 'Paris' }))
  expect(placeKey({ country: 'France', city: null })).toBeNull()
})
