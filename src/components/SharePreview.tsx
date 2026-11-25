import { useEffect, useRef } from 'react'
import { Globe, ImageOff, Link2, MapPin } from 'lucide-react'
import type { Photo, ShareMode } from '../api/types'
import { plural } from '../format'

export interface SharePreviewProps {
  title: string
  description: string
  mode: ShareMode
  photos: Photo[]
  saving: boolean
  failed: boolean
  onBack: () => void
  onConfirm: () => void
  onCancel: () => void
}

/** Review only: never uses owner GPS coordinates or performs a share API request. */
export default function SharePreview({ title, description, mode, photos, saving, failed, onBack, onConfirm, onCancel }: SharePreviewProps) {
  const unconfirmedCount = photos.filter((photo) => photo.label_status === 'suggested').length
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])

  useEffect(() => {
    if (saving) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onBack()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [saving, onBack])

  return (
    <div className="share-form share-preview">
      <h3 ref={heading} tabIndex={-1} className="share-h3">Review your share</h3>
      <p className="share-caption">Confirm what you selected and who will be able to see it before creating the share.</p>
      <div className="share-preview-details">
        <p className="share-preview-title">{title}</p>
        {description ? <p className="share-preview-description">{description}</p> : null}
        <p className="share-caption">{plural(photos.length, 'selected photo')}</p>
      </div>
      <ul className="share-preview-grid" aria-label="Selected photos to share">
        {photos.map((photo) => (
          <li key={photo.id} className="share-preview-photo">
            {photo.thumb_url ?? photo.display_url ? (
              <img src={photo.thumb_url ?? photo.display_url ?? undefined} alt="" loading="lazy" />
            ) : (
              <span className="share-pick-empty"><ImageOff size={18} aria-hidden /></span>
            )}
            <span>{[photo.city, photo.country].filter(Boolean).join(', ') || 'Location not specified'}</span>
            {photo.capture_time_local ? <span className="share-caption">{photo.capture_time_local.slice(0, 10)}</span> : null}
          </li>
        ))}
      </ul>
      <div className="share-audience">
        {mode === 'public' ? <Globe size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
        <span>{mode === 'public'
          ? 'Public: anyone can discover this collection on the public map, even without its link.'
          : 'Anyone with the link can open this collection without signing in.'}</span>
      </div>
      <p className="share-audience">
        <MapPin size={16} aria-hidden />
        <span>Recipients see city and country labels with approximate map positions. Detailed place names, exact GPS coordinates, and original photo metadata stay private. The backend determines the final positions when the share is created. Unselected photos stay private.</span>
      </p>
      {unconfirmedCount > 0 ? (
        <p className="share-preview-notice" role="status">
          {plural(unconfirmedCount, 'selected photo')} {unconfirmedCount === 1 ? 'has' : 'have'} an automatically suggested place label that has not been confirmed. You can review it in the trip before sharing; confirmation is not required.
        </p>
      ) : null}
      {mode === 'public' ? (
        <p className="share-audience">Only publish photos of identifiable people if you have permission to share them publicly.</p>
      ) : null}
      {failed ? <p className="share-error" role="alert">The share could not be created. Try again.</p> : null}
      <div className="share-form-actions">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onConfirm}>
          {saving ? 'Creating…' : mode === 'public' ? 'Publish publicly' : 'Create link'}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onBack}>Back to edit</button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
