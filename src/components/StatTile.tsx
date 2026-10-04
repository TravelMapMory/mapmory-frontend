import type { LucideIcon } from 'lucide-react'
import './StatTile.css'

export interface StatTileProps {
  label:string
  value:number
  icon:LucideIcon
  /** Short explanation under the number, e.g. which photos are counted. */
  hint?:string
  /** Draws attention when the owner has something to act on. */
  attention?:boolean
}

/**
 * One Dashboard total. The number uses tabular figures so a row of tiles
 * lines up as the counts change.
 */
export default function StatTile({ label, value, icon: Icon, hint, attention = false }: StatTileProps) {
  return (
    <div className="stat-tile" data-attention={attention}>
      <span className="stat-tile-icon">
        <Icon size={18} aria-hidden />
      </span>
      <dl className="stat-tile-text">
        <dt className="stat-tile-label">{label}</dt>
        <dd className="stat-tile-value">{value.toLocaleString('en-GB')}</dd>
        {hint ? <dd className="stat-tile-hint">{hint}</dd> : null}
      </dl>
    </div>
  )
}
