import { useEffect, useId, useRef, useState } from 'react'
import { deletePhotoError } from '../photoDeletion'
import './DeletePhotoConfirm.css'

export interface DeletePhotoConfirmProps {
  /** Where the photo was taken, or that it has no location, so the owner knows which photo goes. */
  place: string
  /** Deletes the photo; a rejection keeps the confirmation open with the reason. */
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/**
 * Deleting one photo (frontend #59): says what goes, starts on the safe
 * choice, blocks a second press while the request runs and keeps the photo
 * when the request fails. Cancel sends nothing.
 */
export default function DeletePhotoConfirm({ place, onConfirm, onCancel }: DeletePhotoConfirmProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const keep = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    // The safe choice gets focus first.
    keep.current?.focus()
  }, [])

  async function confirm() {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
    } catch (reason) {
      setError(deletePhotoError(reason))
      setDeleting(false)
    }
  }

  return (
    <div
      className="photo-delete"
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Escape cancels this question only, not the viewer around it.
        event.stopPropagation()
        event.preventDefault()
        if (!deleting) onCancel()
      }}
    >
      <p id={titleId} className="photo-delete-title">
        Delete this photo?
      </p>
      <p>
        <strong>{place}</strong> is removed from this trip and from every share that includes it. This cannot be
        undone.
      </p>
      {error ? (
        <p className="photo-delete-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="photo-delete-actions">
        <button type="button" className="btn btn-danger" onClick={() => void confirm()} aria-disabled={deleting}>
          {deleting ? 'Deleting…' : 'Yes, delete photo'}
        </button>
        <button ref={keep} type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          Keep photo
        </button>
      </div>
    </div>
  )
}
