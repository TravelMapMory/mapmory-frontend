import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Photo } from '../api/types'
import { formatCaptured } from '../format'
import './PhotoViewer.css'

export interface PhotoViewerProps {
  /** Photos the viewer can page through, in the order the trip shows them. */
  photos: Photo[]
  /** The photo opened first. */
  startId: string
  onClose: () => void
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
export default function PhotoViewer({ photos, startId, onClose }: PhotoViewerProps) {
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)))
  const ref = useRef<HTMLDialogElement>(null)

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
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length])

  const photo = photos[Math.min(index, photos.length - 1)]
  if (!photo) return null
  const place = photo.place_name ?? 'No location'
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

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

        <figure className="viewer-figure">
          <ViewerPhoto key={`${photo.id}:${photo.display_url}:${photo.thumb_url}`} photo={photo} />
          <figcaption className="viewer-caption">
            <span id="viewer-place" className="viewer-place">
              {place}
            </span>
            <span>{formatCaptured(photo.capture_time_local) ?? 'No capture time'}</span>
          </figcaption>
        </figure>

        <div className="viewer-nav">
          {/* aria-disabled, not disabled, so the button keeps focus at the first or last photo. */}
          <button type="button" className="viewer-step" onClick={() => hasPrev && setIndex(index - 1)} aria-disabled={!hasPrev}>
            <ChevronLeft size={18} aria-hidden />
            Previous
          </button>
          <span className="viewer-count" aria-live="polite">
            {index + 1} of {photos.length}
          </span>
          <button type="button" className="viewer-step" onClick={() => hasNext && setIndex(index + 1)} aria-disabled={!hasNext}>
            Next
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>
        <p className="viewer-shortcuts" aria-label="Keyboard shortcuts">
          <kbd>←</kbd> / <kbd>→</kbd> navigate · <kbd>Esc</kbd> close
        </p>
      </div>
    </dialog>
  )
}
