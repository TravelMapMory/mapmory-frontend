import { LayoutGrid, LogOut, MapIcon, MapPin, UserX } from 'lucide-react'
import './Header.css'

// The two main owner views (doc 3.1). 
export type Screen = 'dashboard' | 'map'

export interface HeaderProps {
  current:Screen
  onNavigate:(screen: Screen)=>void
  /** Returns to the landing page; without it the button is not shown. */
  onSignOut?: () => void
  /** Opens account deletion (doc 3.6); without it the button is not shown. */
  onDeleteAccount?: () => void
}
const TABS: { id: Screen; label: string; icon: typeof MapIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'map', label: 'Map', icon: MapIcon },
]

// The navigation bar shared by Dashboard and Map (doc 4): the brand on the leading edge and the two views as tabs

export default function Header({ current, onNavigate, onSignOut, onDeleteAccount }: HeaderProps) {
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
      {onDeleteAccount ? (
        <button
          type="button"
          className="hdr-signout hdr-delete"
          onClick={onDeleteAccount}
          aria-label="Delete account"
          title="Delete account"
        >
          <UserX size={16} aria-hidden />
          <span className="hdr-signout-label">Delete account</span>
        </button>
      ) : null}
      {onSignOut ? (
        <button type="button" className="hdr-signout" onClick={onSignOut} aria-label="Sign out" title="Sign out">
          <LogOut size={16} aria-hidden />
          <span className="hdr-signout-label">Sign out</span>
        </button>
      ) : null}
    </header>
  )
}
