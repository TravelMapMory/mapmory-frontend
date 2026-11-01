import { useCallback, useEffect, useRef, useState } from 'react'
import type { FetchPage } from './api/paging'
import type { Page } from './api/types'
import type { MoreState } from './components/LoadMore'

/**
 * Loads the next page of a list on request (frontend #19).
 *
 * - One request at a time: repeated clicks while a page loads do nothing.
 * - `cancel()` drops an in-flight page, so a full reload (after a correction,
 *   say) can never be overwritten by an older page arriving late.
 * - The request is aborted on unmount and whenever `context` changes, e.g.
 *   when the screen switches to another trip.
 */
export function useLoadMore<T>(fetchPage: FetchPage<T>, context: unknown) {
  const [state, setState] = useState<MoreState>('idle')
  const inFlight = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
    setState('idle')
  }, [])

  useEffect(() => cancel, [context, cancel])

  const loadMore = useCallback(
    async (cursor: string, apply: (page: Page<T>) => void) => {
      if (inFlight.current) return
      const controller = new AbortController()
      inFlight.current = controller
      setState('loading')
      try {
        const page = await fetchPage(cursor, controller.signal)
        if (controller.signal.aborted) return
        apply(page)
        setState('idle')
      } catch {
        if (!controller.signal.aborted) setState('error')
      } finally {
        if (inFlight.current === controller) inFlight.current = null
      }
    },
    [fetchPage],
  )

  return { state, loadMore, cancel }
}
