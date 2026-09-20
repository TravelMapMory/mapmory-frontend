import mapPinIcon from '../assets/header/map-pin.svg'
import mapIcon from '../assets/header/map.svg'
import './Header.css'

/**
 * Which control the header shows on its trailing edge. The profile screen ends
 * in the dark "Interactive Map" pill that takes the user to the map; the map
 * screen ends in a hamburger instead, because the map is already open there and
 * the navigation collapses behind the button.
 */
export type HeaderAction = 'interactive-map' | 'menu'

/**
 * Props for {@link Header}.
 */
export interface HeaderProps {
  /** Which trailing control to render — see {@link HeaderAction}. */
  action: HeaderAction
  /** Invoked when the trailing control is activated, whichever variant it is. */
  onAction: () => void
}

/**
 * The site header: the MapMory brand block on the leading edge and a single
 * trailing control whose shape depends on the screen. Both Figma variants
 * (6:16 profile, 8:5 map) share one brand block, so it is inlined here rather
 * than split into a component that would only ever have this one caller.
 */
export default function Header({ action, onAction }: HeaderProps) {
  return (
    <header className="hdr">
      <div className="hdr-brand">
        <span className="hdr-logo">
          <img src={mapPinIcon} alt="" width={18} height={18} />
        </span>

        <span className="hdr-brand-text">
          <strong className="hdr-name">MapMory</strong>
          <span className="eyebrow hdr-eyebrow">Memory Platform</span>
        </span>
      </div>

      {action === 'interactive-map' ? (
        <button type="button" className="hdr-pill" onClick={onAction}>
          <img src={mapIcon} alt="" width={16} height={16} />
          Interactive Map
        </button>
      ) : (
        <button type="button" className="hdr-menu" onClick={onAction} aria-label="Open menu">
          <span className="hdr-menu-bar" />
          <span className="hdr-menu-bar" />
          <span className="hdr-menu-bar" />
        </button>
      )}
    </header>
  )
}
