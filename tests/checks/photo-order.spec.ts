import { expect, test } from '@playwright/test'
import { zoneNote } from '../../src/format'
import { captureDay, compareByCapture, sortByCapture, sortByUpload } from '../../src/photoOrder'

const p = (id: string, capture_time_local: string | null, uploaded_at: string | null = '2026-09-28T10:00:00Z') => ({
  id,
  capture_time_local,
  uploaded_at,
})

test('capture order is oldest first by local wall time, undated photos last', () => {
  const photos = [p('c', null), p('b', '2026-06-02T08:00:00'), p('a', '2026-06-01T23:59:59')]
  expect(sortByCapture(photos).map((x) => x.id)).toEqual(['a', 'b', 'c'])
})

test('a malformed capture time counts as undated, never as a date', () => {
  const photos = [p('bad', '2026-02-30T10:00:00'), p('zero', '0000-00-00T00:00:00'), p('ok', '2026-09-20T09:00:00')]
  expect(sortByCapture(photos).map((x) => x.id)).toEqual(['ok', 'bad', 'zero'])
  expect(captureDay(photos[0])).toBeNull()
  expect(captureDay(photos[2])).toBe('2026-09-20')
})

test('equal capture times are broken by upload time, then photo id', () => {
  const photos = [
    p('z', '2026-09-20T12:00:00', '2026-09-28T10:00:00Z'),
    p('late-upload', '2026-09-20T09:00:00', '2026-09-28T10:00:02Z'),
    p('y', '2026-09-20T12:00:00', '2026-09-28T10:00:00Z'),
    p('early-upload', '2026-09-20T09:00:00', '2026-09-28T10:00:01Z'),
    p('still-uploading', '2026-09-20T09:00:00', null),
  ]
  expect(sortByCapture(photos).map((x) => x.id)).toEqual(['early-upload', 'late-upload', 'still-uploading', 'y', 'z'])
})

test('undated photos keep a stable order among themselves', () => {
  const photos = [p('b', null, '2026-09-28T10:00:02Z'), p('d', null, null), p('a', null, '2026-09-28T10:00:01Z'), p('c', null, null)]
  expect(sortByCapture(photos).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
})

test('the order does not depend on the input order', () => {
  const photos = [
    p('a', '2026-09-20T09:00:00', '2026-09-28T10:00:01Z'),
    p('b', '2026-09-20T09:00:00', '2026-09-28T10:00:01Z'),
    p('c', null),
    p('d', '2026-02-30T10:00:00'),
    p('e', '2026-09-19T09:00:00'),
  ]
  const expected = sortByCapture(photos).map((x) => x.id)
  expect(sortByCapture([...photos].reverse()).map((x) => x.id)).toEqual(expected)
  expect(sortByCapture([photos[2], photos[0], photos[4], photos[1], photos[3]]).map((x) => x.id)).toEqual(expected)
})

test('map markers without an upload time still sort deterministically', () => {
  const markers = [{ id: 'm2', capture_time_local: '2026-06-01T09:00:00' }, { id: 'm1', capture_time_local: '2026-06-01T09:00:00' }]
  expect([...markers].sort(compareByCapture).map((x) => x.id)).toEqual(['m1', 'm2'])
})

test('recently uploaded is newest first, ties by id, unfinished uploads last', () => {
  const photos = [
    p('old', '2026-06-01T09:00:00', '2026-06-20T10:00:00Z'),
    p('pending', null, null),
    p('new-b', null, '2026-09-28T10:00:00Z'),
    p('new-a', '2020-01-01T00:00:00', '2026-09-28T10:00:00Z'),
  ]
  expect(sortByUpload(photos).map((x) => x.id)).toEqual(['new-a', 'new-b', 'old', 'pending'])
})

test('a missing UTC offset is said, never invented', () => {
  expect(zoneNote('2026-09-20T09:00:00', null)).toBe(' · time zone unknown')
  expect(zoneNote('2026-09-20T09:00:00', '+02:00')).toBe('')
  // No capture time at all: there is no time whose zone could be unknown.
  expect(zoneNote(null, null)).toBe('')
  expect(zoneNote('2026-02-30T10:00:00', null)).toBe('')
})
