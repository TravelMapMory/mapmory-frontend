import { LayoutGrid, MapIcon } from 'lucide-react'
import AccountMenu from './AccountMenu'
import './Header.css'
import BrandMark from './BrandMark'

// The two main owner views (doc 3.1). 
export type Screen = 'dashboard' | 'map'

export interface HeaderProps {
  /** The open tab, or null on a page that belongs to neither (the privacy policy). */
  current: Screen | null
  onNavigate:(screen: Screen)=>void
  /** Returns to the landing page; without it the account menu is not shown. */
  onSignOut?: () => void
  /** Opens account deletion (doc 3.6). */
  onDeleteAccount?: () => void
  /** Opens the privacy policy from the account menu. */
  onPrivacy?: () => void
  onUpdateName?: (value: string) => Promise<void>
  /** The signed-in owner, for the account menu. */
  account?: { name: string; email?: string }
}
const TABS: { id: Screen; label: string; icon: typeof MapIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'map', label: 'Map', icon: MapIcon },
]

// The navigation bar shared by Dashboard and Map (doc 4): the brand on the leading edge and the two views as tabs

export default function Header({ current, onNavigate, onSignOut, onDeleteAccount, onPrivacy, onUpdateName, account }: HeaderProps) {
  return (
    <header className="hdr">
      <div className="hdr-brand">
        <BrandMark />
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
      {onSignOut && onDeleteAccount && onPrivacy ? (
        <AccountMenu
          name={account?.name || 'Your account'}
          detail={account?.email}
          onSignOut={onSignOut}
          onDeleteAccount={onDeleteAccount}
          onPrivacy={onPrivacy}
          onUpdateName={onUpdateName}
        />
      ) : null}
    </header>
  )
}
