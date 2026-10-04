import { Globe, Lock } from 'lucide-react'
import './VisibilityBadge.css'

/**
 * Private/Public marker (doc 4.3): always an icon plus a text label, never
 * colour alone. Shared by trip cards now and share settings later.
 */
export default function VisibilityBadge({ visibility }: { visibility: 'private' | 'public' }) {
  const isPublic = visibility === 'public'
  const Icon = isPublic ? Globe : Lock
  return (
    <span className="vis-badge" data-visibility={visibility}>
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {isPublic ? 'Public' : 'Private'}
    </span>
  )
}
