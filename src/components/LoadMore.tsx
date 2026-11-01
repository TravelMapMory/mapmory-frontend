import { LoaderCircle } from 'lucide-react'
import './LoadMore.css'

export type MoreState = 'idle' | 'loading' | 'error'

export interface LoadMoreProps {
  /** e.g. "Showing 50 of 120 photos"; omitted when the total is unknown. */
  summary?: string
  /** Button text, e.g. "Load more photos". */
  label: string
  /** What failed, e.g. "More photos could not be loaded." */
  errorText: string
  state: MoreState
  onLoadMore: () => void
}

/**
 * The end of a paged list (frontend #19): a button for the next page, its
 * loading state, and a retry when the page fails. New items are announced
 * through the summary, which is a polite live region.
 */
export default function LoadMore({ summary, label, errorText, state, onLoadMore }: LoadMoreProps) {
  return (
    <div className="load-more">
      {summary ? (
        <p className="load-more-summary" aria-live="polite">
          {summary}
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="load-more-error" role="alert">
          {errorText}
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onLoadMore}
        // aria-disabled keeps focus on the button while the page loads.
        aria-disabled={state === 'loading'}
      >
        {state === 'loading' ? <LoaderCircle size={16} className="load-more-spin" aria-hidden /> : null}
        {state === 'loading' ? 'Loading…' : state === 'error' ? 'Try again' : label}
      </button>
    </div>
  )
}
