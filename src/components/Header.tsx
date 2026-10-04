import { LayoutGrid, MapIcon, MapPin } from 'lucide-react'
import './Header.css'

// The two main owner views (doc 3.1). 
export type Screen = 'dashboard' | 'map'

export interface HeaderProps {
  current:Screen
  onNavigate:(screen: Screen)=>void
}
const TABS: { id: Screen; label: string; icon: typeof MapIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'map', label: 'Map', icon: MapIcon },
]

// The navigation bar shared by Dashboard and Map (doc 4): the brand on the leading edge and the two views as tabs

export default function Header({ current, onNavigate }: HeaderProps) {
  return (
    <header className="hdr">
      <div className="hdr-brand">
        <span className="hdr-logo">
          <MapPin size={18} strokeWidth={2.6667} aria-hidden />
        </span>
        <strong className="hdr-name">MapMory</strong>
      </div>
      <nav aria-label="Main">
        <ul className="hdr-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className="hdr-tab"
                aria-current={current === id ? 'page' : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
