import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Copy, ImageOff, Link2, Plus } from 'lucide-react'
import { createShare, listShares, revokeShare } from '../api/client'
import type { Photo, Share, TripDetail } from '../api/types'
import { formatUploaded, plural } from '../format'
import './ShareSettings.css'

export interface ShareSettingsProps {
  trip: TripDetail
  photos: Photo[]
}

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; shares: Share[] }

/** Photos with an image to show; processing and failed ones cannot be shared yet. */
function shareable(photos: Photo[]): Photo[] {
  return photos.filter((p) => (p.state === 'ready' || p.state === 'needs-location') && p.display_url)
}

/** One active link: its address to copy, and Revoke behind a confirmation. */
function ShareRow({
  share,
  focusOnMount,
  onRevoked,
  onMessage,
}: {
  share: Share
  focusOnMount: boolean
  onRevoked: (share: Share) => void
  onMessage: (text: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [failed, setFailed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const copyButton = useRef<HTMLButtonElement>(null)
  const fieldId = useId()

  useEffect(() => {
    if (focusOnMount) copyButton.current?.focus()
  }, [focusOnMount])

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url)
      onMessage('Link copied.')
    } catch {
      // Clipboard access can be blocked; selecting the text still lets the owner copy it.
      input.current?.select()
      onMessage('The link is selected. Press Ctrl+C (or ⌘C) to copy it.')
    }
  }

  async function revoke() {
    setRevoking(true)
    setFailed(false)
    try {
      await revokeShare(share.id)
      onRevoked(share)
    } catch {
      setFailed(true)
      setRevoking(false)
    }
  }

  return (
    <li className="share-link" aria-label={share.title}>
      <div className="share-link-head">
        <p className="share-link-title">{share.title}</p>
        <p className="share-caption">
          {plural(share.photo_ids.length, 'photo')} · created {formatUploaded(share.created_at)}
        </p>
      </div>
      <div className="share-link-row">
        <label htmlFor={fieldId} className="visually-hidden">
          Link to {share.title}
        </label>
        <input id={fieldId} ref={input} className="share-input" value={share.url} readOnly onFocus={(e) => e.target.select()} />
        <button ref={copyButton} type="button" className="btn btn-primary" onClick={() => void copy()}>
          <Copy size={14} aria-hidden />
          Copy link
        </button>
        {!confirming ? (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
            Revoke
          </button>
        ) : null}
      </div>
      {confirming ? (
        <div className="share-confirm" role="group" aria-label="Revoke this link?">
          <p>Revoke this link? Anyone who opens it will see that it no longer works. Your photos stay in the trip.</p>
          <div className="share-confirm-actions">
            <button type="button" className="btn btn-danger" onClick={() => void revoke()} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke link'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={revoking}>
              Keep link
            </button>
          </div>
          {failed ? (
            <p className="share-error" role="alert">
              The link could not be revoked. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** Title, optional description and the photos to include in a new link. */
function NewShareForm({
  trip,
  photos,
  onCreated,
  onCancel,
}: {
  trip: TripDetail
  photos: Photo[]
  onCreated: (share: Share) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(trip.title)
  const [description, setDescription] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(photos.map((p) => p.id)))
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const ids = useId()

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || chosen.size === 0) return
    setSaving(true)
    setFailed(false)
    try {
      const share = await createShare(trip.id, {
        mode: 'link',
        title: title.trim(),
        description: description.trim() || undefined,
        // Keep the trip's order, whatever order the boxes were ticked in.
        photo_ids: photos.filter((p) => chosen.has(p.id)).map((p) => p.id),
      })
      onCreated(share)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <form
      className="share-form"
      onSubmit={(e) => void submit(e)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <h3 className="share-h3">New link</h3>
      <div className="share-field">
        <label htmlFor={`${ids}-title`}>Title</label>
        <input
          id={`${ids}-title`}
          className="share-input"
          value={title}
          maxLength={120}
          required
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="share-field">
        <label htmlFor={`${ids}-desc`}>
          Description <span className="share-optional">(optional)</span>
        </label>
        <textarea
          id={`${ids}-desc`}
          className="share-input share-textarea"
          value={description}
          maxLength={600}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <fieldset className="share-photos">
        <legend>Photos to share</legend>
        <div className="share-photos-bar">
          <span className="share-caption" aria-live="polite">
            {chosen.size} of {plural(photos.length, 'photo')} selected
          </span>
          <button type="button" className="share-text-btn" onClick={() => setChosen(new Set(photos.map((p) => p.id)))}>
            Select all
          </button>
          <button type="button" className="share-text-btn" onClick={() => setChosen(new Set())}>
            Select none
          </button>
        </div>
        <ul className="share-grid">
          {photos.map((photo) => {
            const label = photo.place_name ?? 'Photo without a location'
            return (
              <li key={photo.id}>
                <label className="share-pick">
                  <input type="checkbox" checked={chosen.has(photo.id)} onChange={() => toggle(photo.id)} />
                  {photo.thumb_url ? (
                    <img src={photo.thumb_url} alt="" loading="lazy" />
                  ) : (
                    <span className="share-pick-empty">
                      <ImageOff size={18} aria-hidden />
                    </span>
                  )}
                  <span className="share-pick-name">{label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <p className="share-audience">
        <Link2 size={16} aria-hidden />
        <span>
          Anyone with the link can see the selected photos, their dates and the city each was taken in, without an
          account. Exact locations and the rest of this trip stay private.
        </span>
      </p>

      {chosen.size === 0 ? <p className="share-caption">Select at least one photo to create a link.</p> : null}
      {failed ? (
        <p className="share-error" role="alert">
          The link could not be created. Try again.
        </p>
      ) : null}
      <div className="share-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || chosen.size === 0 || !title.trim()}>
          {saving ? 'Creating…' : 'Create link'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/**
 * Share settings for one trip (doc 3.2): the trip's active links, each with
 * Copy and Revoke, and a form for a new link to selected photos. A link share
 * is not public: only people who are given the link can open it.
 */
export default function ShareSettings({ trip, photos }: ShareSettingsProps) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const candidates = shareable(photos)

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoad({ status: 'ready', shares: await listShares(trip.id, signal) })
      } catch {
        if (!signal?.aborted) setLoad({ status: 'error' })
      }
    },
    [trip.id],
  )

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  return (
    <section className="share" aria-labelledby="share-title">
      <div className="share-head">
        <h2 id="share-title" className="share-h2" ref={heading} tabIndex={-1}>
          Share by link
        </h2>
        <p className="share-caption">Only people you send a link to can open it. You can revoke a link at any time.</p>
      </div>

      <p className="visually-hidden" role="status">
        {message}
      </p>
      {message ? <p className="share-message">{message}</p> : null}

      {load.status === 'loading' ? <p className="share-caption">Loading links…</p> : null}
      {load.status === 'error' ? (
        <div role="alert" className="share-status">
          <p>Your links could not be loaded.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLoad({ status: 'loading' })
              void refresh()
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {load.status === 'ready' && load.shares.length > 0 ? (
        <ul className="share-links" aria-label="Active links">
          {load.shares.map((share) => (
            <ShareRow
              key={share.id}
              share={share}
              focusOnMount={share.id === created}
              onMessage={setMessage}
              onRevoked={(revoked) => {
                setLoad((current) =>
                  current.status === 'ready' ? { status: 'ready', shares: current.shares.filter((s) => s.id !== revoked.id) } : current,
                )
                setMessage(`Link "${revoked.title}" revoked. It no longer opens.`)
                // The row and its buttons are gone, so keep keyboard focus in the panel.
                heading.current?.focus()
              }}
            />
          ))}
        </ul>
      ) : null}
      {load.status === 'ready' && load.shares.length === 0 && !creating ? (
        <p className="share-caption">This trip has no active links.</p>
      ) : null}

      {creating ? (
        <NewShareForm
          trip={trip}
          photos={candidates}
          onCancel={() => setCreating(false)}
          onCreated={(share) => {
            setCreating(false)
            setCreated(share.id)
            setMessage(`Link created for ${plural(share.photo_ids.length, 'photo')}. Copy it and send it to the people you choose.`)
            setLoad((current) => ({
              status: 'ready',
              shares: [share, ...(current.status === 'ready' ? current.shares : [])],
            }))
          }}
        />
      ) : candidates.length > 0 ? (
        <div>
          <button type="button" className="btn btn-action" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden />
            New link
          </button>
        </div>
      ) : (
        <p className="share-caption">Upload photos to this trip before sharing it.</p>
      )}
    </section>
  )
}
