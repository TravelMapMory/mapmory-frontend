import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ChevronDown, FileText, LogOut, Pencil, UserX } from 'lucide-react'
import './AccountMenu.css'

export interface AccountMenuProps {
  /** Shown on the button and in the menu: the owner's name, or their email. */
  name: string
  /** A second line in the menu, such as the email address; omitted when empty. */
  detail?: string
  onSignOut: () => void
  onDeleteAccount: () => void
  onPrivacy: () => void
  onUpdateName?: (value: string) => Promise<void>
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
export default function AccountMenu({ name, detail, onSignOut, onDeleteAccount, onPrivacy, onUpdateName }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
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

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onUpdateName || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await onUpdateName(draftName)
      setEditing(false)
      setOpen(false)
    } catch (failure) {
      setSaveError(failure instanceof Error && (failure.message === 'Enter a display name.' || failure.message === 'Use 80 characters or fewer.')
        ? failure.message : 'Could not save your name. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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
          {editing ? (
            <form className="acct-edit" onSubmit={saveName}>
              <label htmlFor={`${menuId}-name`}>Display name</label>
              <input id={`${menuId}-name`} value={draftName} maxLength={160} onChange={(event) => setDraftName(event.target.value)} autoComplete="off" required />
              {saveError ? <p role="alert" className="auth-error">{saveError}</p> : null}
              <div className="acct-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); setSaveError('') }} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-action" disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button>
              </div>
            </form>
          ) : <ul className="acct-items">
            {onUpdateName ? <li><button type="button" className="acct-item" onClick={() => { setDraftName(name); setSaveError(''); setEditing(true) }}><Pencil size={16} aria-hidden /> Edit display name</button></li> : null}
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
                className="acct-item"
                onClick={() => {
                  setOpen(false)
                  onPrivacy()
                }}
              >
                <FileText size={16} aria-hidden />
                Privacy policy
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
          </ul>}
        </div>
      ) : null}
    </div>
  )
}
