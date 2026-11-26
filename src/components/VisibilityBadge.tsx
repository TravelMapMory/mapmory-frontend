import { Flag, Globe, Lock } from 'lucide-react'
import './VisibilityBadge.css'

/**
 * Private/Public marker (doc 4.3): always an icon plus a text label, never
 * colour alone. A reported public share adds an "Under review" flag, so the
 * owner knows why it left the public map instead of taking it for a bug.
 */
export default function VisibilityBadge({
  visibility,
  underReview = false,
}: {
  visibility: 'private' | 'public'
  underReview?: boolean
}) {
  const isPublic = visibility === 'public'
  const Icon = isPublic ? Globe : Lock
  return (
    <>
      <span className="vis-badge" data-visibility={visibility}>
        <Icon size={12} strokeWidth={2.5} aria-hidden />
        {isPublic ? 'Public' : 'Private'}
      </span>
      {underReview ? (
        <span className="vis-badge" data-visibility="review" title="Reported: hidden from the public map until the MapMory team reviews it">
          <Flag size={12} strokeWidth={2.5} aria-hidden />
          Under review
        </span>
      ) : null}
    </>
  )
}
