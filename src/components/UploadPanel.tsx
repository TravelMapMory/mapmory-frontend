import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { CircleAlert, CircleCheck, Clock, LoaderCircle, MapPinOff, RotateCcw, Upload, type LucideIcon } from 'lucide-react'
import { uploadPhotos } from '../api/client'
import type { Photo, PhotoState, UploadItem } from '../api/types'
import { formatCaptured, plural } from '../format'
import './UploadPanel.css'

export interface UploadPanelProps {
  tripId: string
  /** The trip's photos as last loaded, so a corrected photo shows its new state here too. */
  photos: Photo[]
  /** Files chosen before this panel opened, e.g. on the Dashboard. */
  initialFiles?: File[]
  /** Called once every file of a batch has finished, so the trip can reload. */
  onBatchDone: () => void
  /** Opens the correction dialog for a photo that needs a location. */
  onSetLocation: (photo: Photo) => void
}

const STATE_LABEL: Record<PhotoState, { label: string; icon: LucideIcon }> = {
  pending: { label: 'Waiting', icon: Clock },
  uploading: { label: 'Uploading', icon: LoaderCircle },
  processing: { label: 'Reading metadata', icon: LoaderCircle },
  ready: { label: 'Ready', icon: CircleCheck },
  'needs-location': { label: 'Needs location', icon: MapPinOff },
  failed: { label: 'Failed', icon: CircleAlert },
}

const DONE: PhotoState[] = ['ready', 'needs-location', 'failed']

/** Demo file key only; production retry identity is scoped to an upload batch. */
function clientFileId(file: File): string {
  const text = `${file.name}|${file.size}|${file.lastModified}`
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0
  return `f${(hash >>> 0).toString(36)}${file.size.toString(36)}`
}

function describe(item: UploadItem): string | null {
  const photo = item.photo
  if (item.state === 'failed') return item.error
  if (!photo) return null
  const parts: string[] = []
  const taken = formatCaptured(photo.capture_time_local)
  parts.push(taken ? `Taken ${taken}` : 'No capture time in file')
  if (photo.lat !== null && photo.lng !== null) {
    parts.push(`GPS ${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}`)
    parts.push(photo.place_name ? `near ${photo.place_name}` : 'no known place nearby')
  } else {
    parts.push('no GPS in file')
  }
  return parts.join(' · ')
}

/**
 * Upload with per-photo state (doc 4.1): JPEG and PNG up to 25 MB, each file
 * showing pending, uploading, processing, then ready, needs-location or
 * failed, plus overall progress. A failed file can be retried on its own and
 * never discards the others. The capture time and GPS come from each file's
 * EXIF metadata.
 */
export default function UploadPanel({ tripId, photos, initialFiles, onBatchDone, onSetLocation }: UploadPanelProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const files = useRef(new Map<string, File>())
  const inputId = useId()

  const start = useCallback(
    (chosen: File[]) => {
      if (chosen.length === 0) return
      const batch = chosen.map((file) => ({ client_file_id: clientFileId(file), file }))
      batch.forEach((b) => files.current.set(b.client_file_id, b.file))
      setItems((current) => {
        const next = [...current]
        for (const b of batch) {
          const fresh: UploadItem = { client_file_id: b.client_file_id, file_name: b.file.name, state: 'pending', error: null, photo: null }
          const at = next.findIndex((i) => i.client_file_id === b.client_file_id)
          if (at >= 0) next[at] = fresh
          else next.push(fresh)
        }
        return next
      })
      const update = (item: UploadItem) =>
        setItems((current) => current.map((i) => (i.client_file_id === item.client_file_id ? item : i)))
      void uploadPhotos(tripId, batch, update).finally(onBatchDone)
    },
    [tripId, onBatchDone],
  )

  // Files handed over from the Dashboard start uploading straight away, once.
  const startedInitial = useRef(false)
  useEffect(() => {
    if (initialFiles && !startedInitial.current) {
      startedInitial.current = true
      start(initialFiles)
    }
  }, [initialFiles, start])

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    start([...event.dataTransfer.files])
  }

  // Once stored, a photo's own record is the truth: a later correction moves it out of needs-location.
  const shown = items.map((item) => {
    const latest = item.photo && photos.find((p) => p.id === item.photo?.id)
    return latest ? { ...item, state: latest.state, photo: latest } : item
  })
  const done = shown.filter((i) => DONE.includes(i.state)).length
  const located = shown.filter((i) => i.state === 'ready').length
  const unlocated = shown.filter((i) => i.state === 'needs-location').length
  const failedCount = shown.filter((i) => i.state === 'failed').length

  return (
    <section className="upl" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="upl-title">
        Upload photos
      </h2>

      <div
        className="upl-drop"
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={24} aria-hidden />
        <p>
          Drop JPEG or PNG photos here, or{' '}
          <label htmlFor={inputId} className="upl-choose">
            choose files
          </label>
          . Up to 25 MB each.
        </p>
        <input
          id={inputId}
          className="visually-hidden"
          type="file"
          multiple
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          onChange={(event) => {
            start([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
        <p className="upl-note">
          MapMory reads each photo's capture time and GPS from its metadata. Phones often remove the location when
          you pick photos in the browser, so for past trips upload from a computer. Photos without a location stay in
          the gallery and wait for you to place them.
        </p>
      </div>

      {items.length > 0 ? (
        <>
          <div className="upl-progress">
            <progress max={items.length} value={done} aria-label="Upload progress" />
            <p role="status">
              {done < items.length
                ? `${done} of ${plural(items.length, 'photo')} done`
                : `Done: ${located} on the map, ${unlocated} need a location, ${failedCount} failed`}
            </p>
          </div>
          <ul className="upl-list">
            {shown.map((item) => {
              const { label, icon: Icon } = STATE_LABEL[item.state]
              const busy = !DONE.includes(item.state)
              return (
                <li key={item.client_file_id} className="upl-item">
                  {item.photo?.thumb_url ? (
                    <img src={item.photo.thumb_url} alt="" className="upl-thumb" />
                  ) : (
                    <span className="upl-thumb upl-thumb--empty" aria-hidden />
                  )}
                  <div className="upl-text">
                    <p className="upl-name">{item.file_name}</p>
                    {describe(item) ? <p className="upl-detail">{describe(item)}</p> : null}
                  </div>
                  <span className="upl-state" data-state={item.state}>
                    <Icon size={14} aria-hidden className={busy ? 'upl-spin' : undefined} />
                    {label}
                  </span>
                  {item.state === 'failed' && files.current.has(item.client_file_id) ? (
                    <button
                      type="button"
                      className="btn btn-secondary upl-act"
                      onClick={() => start([files.current.get(item.client_file_id) as File])}
                    >
                      <RotateCcw size={14} aria-hidden />
                      Retry
                    </button>
                  ) : null}
                  {item.state === 'needs-location' && item.photo ? (
                    <button
                      type="button"
                      className="btn btn-primary upl-act"
                      onClick={() => onSetLocation(item.photo as Photo)}
                    >
                      Set location
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}
