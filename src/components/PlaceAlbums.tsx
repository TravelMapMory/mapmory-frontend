import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FolderOpen, ImageOff, Lock, X } from 'lucide-react'
import type { MapPhoto } from '../api/types'
import { formatCaptured, plural } from '../format'
import './PlaceAlbums.css'

/** One trip's photos at the selected place: the owner's own, or one shared with them. */
interface Album {
  trip_id: string
  title: string
  owner_name: string | null
  shared_with: string[]
  photos: MapPhoto[]
}

/**
 * Groups photos into albums by trip, in capture order. Albums holding the
 * photos of the pin that was selected come first, then the owner's own
 * before shared ones, so the card opens on what was clicked.
 */
function toAlbums(photos: MapPhoto[], pinned: Set<string>): Album[] {
  const byTrip = new Map<string, Album>()
  for (const p of photos) {
    const album = byTrip.get(p.trip_id) ?? {
      trip_id: p.trip_id,
      title: p.trip_title,
      owner_name: p.owner_name,
      shared_with: p.shared_with,
      photos: [],
    }
    album.photos.push(p)
    byTrip.set(p.trip_id, album)
  }
  const rank = (a: Album) => (a.photos.some((p) => pinned.has(p.id)) ? 0 : 2) + (a.owner_name ? 1 : 0)
  return [...byTrip.values()].sort((a, b) => rank(a) - rank(b))
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Avatar colours, each at least 4.5:1 against white initials (WCAG AA). */
const AVATAR_COLOURS = ['#152238', '#2f6fd0', '#0f766e', '#7c3aed', '#be185d']

function Avatar({ name }: { name: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  return (
    <span className="pa-avatar" style={{ background: AVATAR_COLOURS[hash % AVATAR_COLOURS.length] }} title={name} aria-hidden>
      {initials(name)}
    </span>
  )
}

function firstNames(names: string[]): string {
  const first = names.map((n) => n.split(/\s+/)[0])
  return first.length <= 2 ? first.join(' and ') : `${first.slice(0, 2).join(', ')} and ${plural(first.length - 2, 'other')}`
}

function SharedRow({ album }: { album: Album }) {
  if (album.owner_name) {
    return (
      <div className="pa-shared">
        <span className="pa-shared-label">Shared with you by</span>
        <span className="pa-shared-people">
          <Avatar name={album.owner_name} />
          {album.owner_name}
        </span>
      </div>
    )
  }
  if (album.shared_with.length === 0) {
    return (
      <div className="pa-shared">
        <span className="pa-shared-label">Shared with</span>
        <span className="pa-shared-people">
          <Lock size={14} aria-hidden />
          Only you
        </span>
      </div>
    )
  }
  return (
    <div className="pa-shared">
      <span className="pa-shared-label">Shared with</span>
      <span className="pa-shared-people" aria-label={album.shared_with.join(', ')}>
        <span className="pa-avatars">
          {album.shared_with.map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </span>
        <span aria-hidden>{firstNames(album.shared_with)}</span>
      </span>
    </div>
  )
}

export interface PlaceAlbumsProps {
  /** Every loaded photo at the selected place, the owner's and shared ones. */
  photos: MapPhoto[]
  /** Ids of the photos under the pin that was selected. */
  pinnedIds: string[]
  onClose: () => void
  onOpenTrip?: (tripId: string) => void
}

/**
 * The photos at a selected place as one card per album. Left and right (the
 * arrow buttons, or the arrow keys on the picture) step through the album's
 * photos; the switcher at the card's bottom right moves to the next album
 * at the same place, including albums other people shared with the owner.
 */
export default function PlaceAlbums({ photos, pinnedIds, onClose, onOpenTrip }: PlaceAlbumsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const albums = useMemo(() => toAlbums(photos, new Set(pinnedIds)), [photos, pinnedIds])
  const [albumIndex, setAlbumIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)
  const places = [...new Set(photos.map((p) => p.city ?? p.place_name).filter(Boolean))]

  // Opening the panel moves focus into it, so keyboard and screen-reader
  // users land on what they just opened (and phones scroll it into view).
  useEffect(() => {
    setAlbumIndex(0)
    setPhotoIndex(0)
    headingRef.current?.focus()
  }, [photos])

  const album = albums[Math.min(albumIndex, albums.length - 1)]
  if (!album) return null
  const photo = album.photos[Math.min(photoIndex, album.photos.length - 1)]
  const manyPhotos = album.photos.length > 1

  function stepPhoto(delta: number) {
    setPhotoIndex((i) => (i + delta + album.photos.length) % album.photos.length)
  }

  function stepAlbum(delta: number) {
    setAlbumIndex((i) => (i + delta + albums.length) % albums.length)
    setPhotoIndex(0)
  }

  function onMediaKey(event: KeyboardEvent) {
    if (!manyPhotos) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      stepPhoto(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  const albumName = (a: Album) => (a.owner_name ? `${a.title} by ${a.owner_name}` : a.title)
  const next = albums[(albumIndex + 1) % albums.length]
  const prev = albums[(albumIndex - 1 + albums.length) % albums.length]

  return (
    <section className="mp-selected" aria-labelledby="mp-selected-title">
      <div className="mp-selected-head">
        <h2 id="mp-selected-title" className="mp-h2" ref={headingRef} tabIndex={-1}>
          {places.join(', ') || 'Selected photos'}
          <span className="mp-caption">
            {' '}
            · {plural(photos.length, 'photo')}
            {albums.length > 1 ? ` in ${albums.length} albums` : ''}
          </span>
        </h2>
        <button type="button" className="mp-icon-btn" onClick={onClose} aria-label="Close photo details">
          <X size={18} aria-hidden />
        </button>
      </div>

      <article className="pa-card" aria-label={albumName(album)}>
        <div
          className="pa-media"
          role="group"
          aria-roledescription="carousel"
          aria-label={`Photos in ${album.title}`}
          tabIndex={manyPhotos ? 0 : undefined}
          onKeyDown={onMediaKey}
        >
          {photo.display_url ? (
            <img src={photo.display_url} alt={photo.place_name ? `Photo at ${photo.place_name}` : 'Photo'} />
          ) : (
            <div className="pa-media-empty">
              <ImageOff size={24} aria-hidden />
            </div>
          )}
          {manyPhotos ? (
            <>
              <button type="button" className="pa-nav pa-nav--prev" onClick={() => stepPhoto(-1)} aria-label="Previous photo">
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button type="button" className="pa-nav pa-nav--next" onClick={() => stepPhoto(1)} aria-label="Next photo">
                <ChevronRight size={20} aria-hidden />
              </button>
              <span className="pa-counter" aria-live="polite">
                <span className="visually-hidden">Photo </span>
                {photoIndex + 1} / {album.photos.length}
              </span>
              <div className="pa-dots" aria-hidden>
                {album.photos.map((p, i) => (
                  <span key={p.id} className={i === photoIndex ? 'pa-dot pa-dot--on' : 'pa-dot'} />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="pa-body">
          <p className="pa-place">{photo.place_name ?? 'Unnamed place'}</p>
          {photo.capture_time_local ? (
            <p className="pa-meta">
              <CalendarDays size={14} aria-hidden />
              {formatCaptured(photo.capture_time_local)}
            </p>
          ) : null}
          <p className="pa-meta">
            <FolderOpen size={14} aria-hidden />
            {album.title}
          </p>

          <SharedRow album={album} />

          <div className="pa-footer">
            {onOpenTrip && !album.owner_name ? (
              <button type="button" className="btn btn-secondary" onClick={() => onOpenTrip(album.trip_id)}>
                Open trip
              </button>
            ) : (
              <span />
            )}
            {albums.length > 1 ? (
              <div className="pa-albums" role="group" aria-label="Albums at this place">
                <button
                  type="button"
                  className="pa-album-btn"
                  onClick={() => stepAlbum(-1)}
                  aria-label={`Previous album: ${albumName(prev)}`}
                  title={albumName(prev)}
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="pa-albums-count" aria-live="polite">
                  Album {albumIndex + 1} of {albums.length}
                </span>
                <button
                  type="button"
                  className="pa-album-btn"
                  onClick={() => stepAlbum(1)}
                  aria-label={`Next album: ${albumName(next)}`}
                  title={albumName(next)}
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  )
}
