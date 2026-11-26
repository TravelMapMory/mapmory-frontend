import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { updateTrip } from '../api/client'
import { ApiError } from '../api/http'
import { NOTES_MAX, codePoints, tripTitleProblem } from '../api/limits'
import { NotFoundError } from '../api/mock'
import type { TripDetail, UpdateTripInput } from '../api/types'
import './TripDetailsForm.css'

export interface TripDetailsFormProps {
  trip: TripDetail
  onSaved: (trip: TripDetail) => void
  onCancel: () => void
}

/** Why a save failed, in words the owner can act on. The draft is always kept. */
function saveError(error: unknown): string {
  if (error instanceof NotFoundError || (error instanceof ApiError && (error.status === 404 || error.status === 403))) {
    return 'This trip no longer exists or is not yours, so the changes could not be saved.'
  }
  if (error instanceof ApiError && error.status === 400) return `The changes were not accepted: ${error.message}`
  return 'The changes could not be saved. Check your connection and try again.'
}

/**
 * Edits a trip's title and private notes in place of the trip header.
 * Cancel and Escape leave the trip unchanged; a failed save keeps the draft.
 */
export default function TripDetailsForm({ trip, onSaved, onCancel }: TripDetailsFormProps) {
  const [title, setTitle] = useState(trip.title)
  const [notes, setNotes] = useState(trip.notes ?? '')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const notesInput = useRef<HTMLTextAreaElement>(null)
  const ids = useId()
  const notesLength = codePoints(notes.trim())
  const notesTooLong = notesLength > NOTES_MAX

  useEffect(() => {
    titleInput.current?.focus()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    const problem = tripTitleProblem(title)
    if (problem) {
      setTitleError(problem)
      titleInput.current?.focus()
      return
    }
    if (notesTooLong) {
      notesInput.current?.focus()
      return
    }
    // Send only what changed; nothing changed means nothing to save.
    const patch: UpdateTripInput = {}
    if (trimmed !== trip.title) patch.title = trimmed
    if (notes.trim() !== (trip.notes ?? '')) patch.notes = notes.trim()
    if (patch.title === undefined && patch.notes === undefined) {
      onCancel()
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateTrip(trip.id, patch))
    } catch (failure) {
      setError(saveError(failure))
      setSaving(false)
    }
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape cancels from any focused descendant; the container itself is not a control.
    <form
      className="trip-edit"
      aria-labelledby={`${ids}-heading`}
      noValidate
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) onCancel()
      }}
    >
      <h2 id={`${ids}-heading`} className="trip-edit-heading">
        Edit trip details
      </h2>

      <div className="trip-edit-field">
        <label htmlFor={`${ids}-title`}>Trip name</label>
        <input
          ref={titleInput}
          id={`${ids}-title`}
          className="trip-edit-input"
          value={title}
          required
          aria-invalid={titleError !== null}
          aria-describedby={titleError ? `${ids}-title-error` : undefined}
          disabled={saving}
          onChange={(event) => {
            setTitle(event.target.value)
            if (titleError) setTitleError(tripTitleProblem(event.target.value))
          }}
        />
        {titleError ? (
          <p id={`${ids}-title-error`} className="trip-edit-invalid">
            {titleError}
          </p>
        ) : null}
      </div>

      <div className="trip-edit-field">
        <label htmlFor={`${ids}-notes`}>
          Notes <span className="trip-edit-optional">(optional, only you see them)</span>
        </label>
        <textarea
          ref={notesInput}
          id={`${ids}-notes`}
          className="trip-edit-input trip-edit-notes"
          value={notes}
          rows={3}
          aria-invalid={notesTooLong}
          aria-describedby={`${ids}-notes-count`}
          disabled={saving}
          onChange={(event) => setNotes(event.target.value)}
        />
        <p id={`${ids}-notes-count`} className="trip-edit-count" data-over={notesTooLong || undefined}>
          {notesLength} / {NOTES_MAX}
          {notesTooLong ? ' (too long, shorten the notes to save)' : null}
        </p>
      </div>

      {error ? (
        <p className="trip-edit-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="trip-edit-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
