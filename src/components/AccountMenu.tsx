import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserX } from 'lucide-react'
import './AccountMenu.css'

export interface AccountMenuProps {
  /** Shown on the button and in the menu: the owner's name, or their email. */
  name: string
  /** A second line in the menu, such as the email address; omitted when empty. */
  detail?: string
  onSignOut: () => void
  onDeleteAccount: () => void
}

/** Up to two initials for the avatar: "Kristian Lalev" gives "KL", "ana@x.fi" gives "A". */
function initials(name: string): string {
  const words = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase()
}

/**
 * The owner's account actions in one place, so deleting the account is never
 * one stray click away. A disclosure button: Escape or a click outside closes
 * it, and Escape returns focus to the button.
 */
export default function AccountMenu({ name, detail, onSignOut, onDeleteAccount }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    firstItem.current?.focus()
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="acct" ref={root}>
      <button
        ref={button}
        type="button"
        className="acct-button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="acct-avatar" aria-hidden>
          {initials(name)}
        </span>
        <span className="acct-name" aria-hidden>
          {name}
        </span>
        <ChevronDown size={14} aria-hidden className="acct-chevron" />
      </button>
      {open ? (
        <div className="acct-panel" id={menuId}>
          <div className="acct-who">
            <p className="acct-who-name">{name}</p>
            {detail && detail !== name ? <p className="acct-who-detail">{detail}</p> : null}
          </div>
          <ul className="acct-items">
            <li>
              <button
                ref={firstItem}
                type="button"
                className="acct-item"
                onClick={() => {
                  setOpen(false)
                  onSignOut()
                }}
              >
                <LogOut size={16} aria-hidden />
                Sign out
              </button>
            </li>
            <li>
              <button
                type="button"
                className="acct-item acct-item--danger"
                onClick={() => {
                  setOpen(false)
                  onDeleteAccount()
                }}
              >
                <UserX size={16} aria-hidden />
                Delete account…
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
