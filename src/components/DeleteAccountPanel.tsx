import { useEffect, useId, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import './DeleteAccountPanel.css'

export interface DeleteAccountPanelProps {
  /** Deletes the data and the sign-in; rejects to keep the panel open with an error. */
  onConfirm: (password: string) => Promise<void>
  onCancel: () => void
  /** Require fresh Firebase email/password credentials in live mode. */
  requirePassword?: boolean
}

/**
 * Account deletion (doc 2.2 use case 6, 3.6). The owner must tick that they
 * understand it cannot be undone before the button works; Escape and Cancel
 * leave everything as it was.
 */
export default function DeleteAccountPanel({ onConfirm, onCancel, requirePassword = false }: DeleteAccountPanelProps) {
  const [understood, setUnderstood] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  useEffect(() => {
    heading.current?.focus()
  }, [])

  async function confirm() {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(password)
    } catch (failure) {
      // The request may have committed before a network error was observed.
      // A Firebase reauthentication error, however, precedes data deletion.
      const code = typeof failure === 'object' && failure && 'code' in failure ? String(failure.code) : ''
      setError(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'Incorrect password. Your MapMory data has not been deleted.'
        : code === 'auth/too-many-requests'
          ? 'Too many sign-in attempts. Try again later. Your MapMory data has not been deleted.'
          : 'We could not complete or confirm account deletion. Check your account status before trying again.')
      setDeleting(false)
    }
  }

  return (
    <section
      className="delacct"
      aria-labelledby={`${ids}-title`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !deleting) onCancel()
      }}
    >
      <h2 id={`${ids}-title`} className="delacct-title" ref={heading} tabIndex={-1}>
        <TriangleAlert size={18} aria-hidden />
        Delete your account?
      </h2>
      <p>
        This permanently deletes all your trips, photos and shares from MapMory. Share links and public shares stop
        working at once. This cannot be undone.
      </p>
      <label className="delacct-check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} disabled={deleting} />
        <span>I understand that my trips and photos will be deleted permanently.</span>
      </label>
      {requirePassword ? (
        <label className="delacct-password">
          Confirm your password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={deleting}
            required
          />
        </label>
      ) : null}
      {error ? <p className="delacct-error" role="alert">{error}</p> : null}
      <div className="delacct-actions">
        <button type="button" className="btn btn-danger" onClick={() => void confirm()} disabled={!understood || deleting || (requirePassword && !password)}>
          {deleting ? 'Deleting…' : 'Yes, delete my account'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </button>
      </div>
    </section>
  )
}
