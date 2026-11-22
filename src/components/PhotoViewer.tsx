import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Photo } from '../api/types'
import { formatCaptured, zoneNote } from '../format'
import type { MoreState } from './LoadMore'
import { viewerPosition } from './viewerPosition'
import './PhotoViewer.css'

export interface PhotoViewerProps {
  /** Photos the viewer can page through, in the order the trip shows them. */
  photos: Photo[]
  /** The photo opened first. */
  startId: string
  onClose: () => void
  /** The trip has photos beyond the loaded pages; Next at the end loads them. */
  hasMore?: boolean
  moreState?: MoreState
  onLoadMore?: () => void
}

/** The large image for a photo: the display rendition, else its thumbnail. */
export function viewerImage(photo: Photo): string | null {
  return photo.display_url ?? photo.thumb_url
}

/** Try a thumbnail if the display rendition fails; otherwise show a readable fallback. */
function ViewerPhoto({ photo }: { photo: Photo }) {
  const initial = viewerImage(photo)
  const [source, setSource] = useState<string | null>(initial)

  function onImageError() {
    setSource((current) =>
      current === photo.display_url && photo.thumb_url && photo.thumb_url !== current
        ? photo.thumb_url
        : null,
    )
  }

  return source ? (
    <img
      src={source}
      alt={photo.place_name ? `Photo at ${photo.place_name}` : 'Photo without a location'}
      onError={onImageError}
    />
  ) : (
    <p className="viewer-unavailable" role="status">Photo unavailable</p>
  )
}

/**
 * Full-photo viewer (issue #24): a modal over the trip that only shows
 * photos. Correcting a location stays on the trip page, so viewing never
 * changes anything. The native dialog traps focus and closes on Escape;
 * Left/Right arrows and the buttons page through the trip, and focus returns to the
 * thumbnail that opened it.
 */
export default function PhotoViewer({
  photos,
  startId,
  onClose,
  hasMore = false,
  moreState = 'idle',
  onLoadMore,
}: PhotoViewerProps) {
  // Follow the photo, not its position: pages and refreshes can shift the list.
  const [currentId, setCurrentId] = useState(startId)
  // Next was pressed at the end of the loaded photos; move on once the next page arrives.
  const [advancePending, setAdvancePending] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const { index, missing, hasPrev, hasNext } = viewerPosition(photos, currentId)
  const canLoadMore = !missing && !hasNext && hasMore && Boolean(onLoadMore)

  function step(delta: -1 | 1) {
    if (missing) return
    if (delta === -1 && hasPrev) setCurrentId(photos[index - 1].id)
    else if (delta === 1 && hasNext) setCurrentId(photos[index + 1].id)
    else if (delta === 1 && canLoadMore && moreState !== 'loading') {
      setAdvancePending(true)
      onLoadMore?.()
    }
  }
  // The latest step for the window key listener, without re-subscribing on every render.
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })

  // Render-time adjustment (no effect): once the next page has arrived, take the pending step.
  if (advancePending && hasNext) {
    setAdvancePending(false)
    setCurrentId(photos[index + 1].id)
  } else if (advancePending && (moreState === 'error' || !hasMore)) {
    setAdvancePending(false)
  }

  useEffect(() => {
    const dialog = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
      opener?.focus()
    }
  }, [])

  // Arrows page from anywhere while the viewer is open, even if focus has left its buttons.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') stepRef.current(-1)
      if (event.key === 'ArrowRight') stepRef.current(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const photo = missing ? null : photos[index]
  const place = photo ? (photo.place_name ?? 'No location') : 'Photo unavailable'

  return (
    // The backdrop click is a mouse shortcut; Escape (onCancel) and the Close button are its keyboard equivalents.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className="viewer"
      aria-labelledby="viewer-place"
      onCancel={(event) => {
        // Escape: let React close the dialog by unmounting it.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="viewer-frame">
        <button type="button" className="viewer-close" onClick={onClose} aria-label="Close photo" autoFocus>
          <X size={20} aria-hidden />
        </button>

        {photo ? (
          <figure className="viewer-figure">
            <ViewerPhoto key={`${photo.id}:${photo.display_url}:${photo.thumb_url}`} photo={photo} />
            <figcaption className="viewer-caption">
              <span id="viewer-place" className="viewer-place">
                {place}
              </span>
              <span>
                {formatCaptured(photo.capture_time_local) ?? 'No capture time'}
                {zoneNote(photo.capture_time_local, photo.capture_utc_offset)}
              </span>
            </figcaption>
          </figure>
        ) : (
          // The open photo left the trip (deleted elsewhere, or no longer viewable). Say so; never show another.
          <div className="viewer-figure viewer-gone" role="status">
            <span id="viewer-place" className="viewer-place">
              {place}
            </span>
            <p>This photo is no longer in the trip.</p>
          </div>
        )}

        {photo ? (
          <div className="viewer-nav">
            {/* aria-disabled, not disabled, so the button keeps focus at the first or last photo. */}
            <button type="button" className="viewer-step" onClick={() => step(-1)} aria-disabled={!hasPrev}>
              <ChevronLeft size={18} aria-hidden />
              Previous
            </button>
            <span className="viewer-count" aria-live="polite">
              {moreState === 'loading' && advancePending
                ? 'Loading more photos…'
                : `${index + 1} of ${photos.length}${hasMore ? ' loaded' : ''}`}
            </span>
            <button
              type="button"
              className="viewer-step"
              onClick={() => step(1)}
              aria-disabled={!hasNext && (!canLoadMore || moreState === 'loading')}
            >
              Next
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        ) : null}
        {photo && canLoadMore && moreState === 'error' ? (
          <p className="viewer-more-error" role="alert">
            More photos could not be loaded. Press Next to try again.
          </p>
        ) : null}
        <p className="viewer-shortcuts" aria-label="Keyboard shortcuts">
          <kbd>←</kbd> / <kbd>→</kbd> navigate · <kbd>Esc</kbd> close
        </p>
      </div>
    </dialog>
  )
}
