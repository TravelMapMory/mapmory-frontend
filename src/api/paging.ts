import type { Page } from './types'

/*
 * Cursor paging (frontend #19). Every list endpoint returns a page and an
 * opaque `next_cursor`; null means the list is complete. Ordering belongs to
 * the server and photoOrder.ts (#25); these helpers only join pages.
 */

export type FetchPage<T> = (cursor: string | null, signal?: AbortSignal) => Promise<Page<T>>

/**
 * Appends a page, skipping ids already present. A record can move between
 * pages when the collection changes between requests; the first copy wins,
 * so a row never appears twice.
 */
export function mergePage<T extends { id: string }>(items: readonly T[], page: readonly T[]): T[] {
  const seen = new Set(items.map((item) => item.id))
  return [...items, ...page.filter((item) => !seen.has(item.id) && seen.add(item.id))]
}

/**
 * Loads pages until at least `minItems` are in hand or the list ends. A
 * reload asks for as many items as were already shown, so refreshing after a
 * correction does not throw away the pages the owner had opened.
 */
export async function loadPages<T extends { id: string }>(
  fetchPage: FetchPage<T>,
  minItems: number,
  signal?: AbortSignal,
): Promise<Page<T>> {
  let page = await fetchPage(null, signal)
  let items = mergePage([], page.items)
  while (page.next_cursor && items.length < minItems) {
    page = await fetchPage(page.next_cursor, signal)
    items = mergePage(items, page.items)
  }
  return { items, next_cursor: page.next_cursor }
}

/** Every page; for pickers such as the Map's trip filter that must list everything. */
export function loadAllPages<T extends { id: string }>(fetchPage: FetchPage<T>, signal?: AbortSignal): Promise<Page<T>> {
  return loadPages(fetchPage, Number.POSITIVE_INFINITY, signal)
}
