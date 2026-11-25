import { useEffect, useId, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import './DeleteAccountPanel.css'

export interface DeleteAccountPanelProps {
  /** Deletes the data and the sign-in; rejects to keep the panel open with an error. */
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/**
 * Account deletion (doc 2.2 use case 6, 3.6). The owner must tick that they
 * understand it cannot be undone before the button works; Escape and Cancel
 * leave everything as it was.
 */
export default function DeleteAccountPanel({ onConfirm, onCancel }: DeleteAccountPanelProps) {
  const [understood, setUnderstood] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failed, setFailed] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  useEffect(() => {
    heading.current?.focus()
  }, [])

  async function confirm() {
    setDeleting(true)
    setFailed(false)
    try {
      await onConfirm()
    } catch {
      setFailed(true)
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
      {failed ? (
        <p className="delacct-error" role="alert">
          Your account could not be deleted. Nothing was removed; try again.
        </p>
      ) : null}
      <div className="delacct-actions">
        <button type="button" className="btn btn-danger" onClick={() => void confirm()} disabled={!understood || deleting}>
          {deleting ? 'Deleting…' : 'Yes, delete my account'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </button>
      </div>
    </section>
  )
}
