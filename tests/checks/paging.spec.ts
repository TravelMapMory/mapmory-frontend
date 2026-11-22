import { expect, test } from '@playwright/test'
import { loadAllPages, loadPages, mergePage, type FetchPage } from '../../src/api/paging'
import { viewerPosition } from '../../src/components/viewerPosition'

const item = (id: string) => ({ id })
const ids = (items: { id: string }[]) => items.map((i) => i.id)

/** A server with pages of `size` over `items`, recording each cursor it was asked for. */
function server(items: { id: string }[], size: number) {
  const asked: (string | null)[] = []
  const fetchPage: FetchPage<{ id: string }> = async (cursor) => {
    asked.push(cursor)
    const start = cursor ? Number(cursor) : 0
    const end = start + size
    return { items: items.slice(start, end), next_cursor: end < items.length ? String(end) : null }
  }
  return { fetchPage, asked }
}

test('merging a page skips records already shown, keeping the first copy', () => {
  const shown = [item('a'), item('b')]
  // 'b' moved onto the next page because something was inserted before it.
  expect(ids(mergePage(shown, [item('b'), item('c'), item('c')]))).toEqual(['a', 'b', 'c'])
  expect(ids(mergePage([], []))).toEqual([])
})

test('a reload fetches as many pages as were shown, and no more', async () => {
  const { fetchPage, asked } = server(['1', '2', '3', '4', '5', '6', '7'].map(item), 2)
  const page = await loadPages(fetchPage, 3)
  expect(ids(page.items)).toEqual(['1', '2', '3', '4'])
  expect(page.next_cursor).toBe('4')
  expect(asked).toEqual([null, '2'])
})

test('a first load (nothing shown yet) fetches one page', async () => {
  const { fetchPage, asked } = server(['1', '2', '3'].map(item), 2)
  const page = await loadPages(fetchPage, 0)
  expect(ids(page.items)).toEqual(['1', '2'])
  expect(asked).toEqual([null])
})

test('loading every page follows the cursor to the end', async () => {
  const { fetchPage, asked } = server(['1', '2', '3', '4', '5'].map(item), 2)
  const page = await loadAllPages(fetchPage)
  expect(ids(page.items)).toEqual(['1', '2', '3', '4', '5'])
  expect(page.next_cursor).toBeNull()
  expect(asked).toEqual([null, '2', '4'])
})

test('a reload stops early when the list has shrunk', async () => {
  const { fetchPage } = server(['1', '2', '3'].map(item), 2)
  const page = await loadPages(fetchPage, 6)
  expect(ids(page.items)).toEqual(['1', '2', '3'])
  expect(page.next_cursor).toBeNull()
})

test('the viewer finds its photo by id wherever the list moved it', () => {
  expect(viewerPosition([item('a'), item('b'), item('c')], 'b')).toEqual({ index: 1, missing: false, hasPrev: true, hasNext: true })
  // A new page arrived and the list was re-sorted: still the same photo.
  expect(viewerPosition([item('x'), item('a'), item('b'), item('c')], 'b')).toMatchObject({ index: 2, missing: false })
  expect(viewerPosition([item('a')], 'a')).toEqual({ index: 0, missing: false, hasPrev: false, hasNext: false })
})

test('a photo that left the list is reported missing, never replaced by its neighbour', () => {
  expect(viewerPosition([item('a'), item('c')], 'b')).toEqual({ index: -1, missing: true, hasPrev: false, hasNext: false })
  expect(viewerPosition([], 'b')).toMatchObject({ missing: true })
})
