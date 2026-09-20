import { useState } from 'react'
import './MobileDrawer.css'
import heartIcon from '../assets/mobile-drawer/heart.svg'
import shareIcon from '../assets/mobile-drawer/share-2.svg'
import chevronIcon from '../assets/mobile-drawer/chevron-right.svg'
import chevronFaintIcon from '../assets/mobile-drawer/chevron-right-faint.svg'
import mapPinIcon from '../assets/mobile-drawer/map-pin.svg'
import calendarIcon from '../assets/mobile-drawer/calendar.svg'
import uploadIcon from '../assets/mobile-drawer/upload.svg'
import userIcon from '../assets/mobile-drawer/user.svg'
import globeIcon from '../assets/mobile-drawer/globe.svg'
import imageIcon from '../assets/mobile-drawer/image.svg'
import slidersIcon from '../assets/mobile-drawer/sliders.svg'
import plusIcon from '../assets/mobile-drawer/plus.svg'

/**
 * One carousel slide. `src` is left empty when the memory's photo has not been
 * loaded yet, in which case the slide renders as a flat placeholder surface so
 * the 240px carousel keeps its height instead of collapsing.
 */
export interface DrawerPhoto {
  src: string
  alt: string
}

/**
 * One of the three counters in the profile card. `icon` is an image URL rather
 * than an enum so the caller owns which glyph goes with which counter, keeping
 * the component free of a lookup table that only ever has three entries.
 */
export interface DrawerStat {
  icon: string
  value: string
  label: string
}

/**
 * A person the memory is shared with. `src` may be empty for the same reason as
 * `DrawerPhoto.src`; the avatar then renders as an empty tinted circle.
 */
export interface DrawerPerson {
  src: string
  alt: string
}

/**
 * Everything the drawer renders plus the callbacks for the parts the design
 * marks as interactive. Every text string is supplied by the caller because the
 * drawer is a presentation shell — it holds no copy of its own.
 */
export interface MobileDrawerProps {
  badge: string
  title: string
  location: string
  photos: DrawerPhoto[]
  dateLabel: string
  dateValue: string
  uploadLabel: string
  profileLabel: string
  avatar: string
  stats: DrawerStat[]
  preferencesLabel: string
  sharedLabel: string
  people: DrawerPerson[]
  onLike: () => void
  onShare: () => void
  onOpen: () => void
  onSelectPhoto: (index: number) => void
  onUpload: () => void
  onOpenPreferences: () => void
  onAddPerson: () => void
}

/**
 * The content of the "editable-unimap-screen" frame, ready to drop into a
 * story or a screen. Its values are the ones the Figma file ships, so the
 * drawer can be rendered exactly as designed without inventing copy; the
 * photo and avatar URLs are blank because the design's raster images are not
 * available to this build.
 */
export const MOBILE_DRAWER_EXAMPLE = {
  badge: '✦ FEATURED MEMORY',
  title: 'My Memory Stream: Latest Vantaa snapshot',
  location: 'Paris, France',
  photos: [
    { src: '', alt: 'Memory photo 1' },
    { src: '', alt: 'Memory photo 2' },
    { src: '', alt: 'Memory photo 3' },
    { src: '', alt: 'Memory photo 4' },
  ],
  dateLabel: 'TRIP DATE',
  dateValue: '12 Feb 2024',
  uploadLabel: 'UPLOAD NEW PICTURE',
  profileLabel: 'MY PROFILE & STATS',
  avatar: '',
  stats: [
    { icon: globeIcon, value: '20', label: 'Countries' },
    { icon: imageIcon, value: '1500', label: 'Pictures' },
    { icon: slidersIcon, value: '0', label: 'Accounts' },
  ],
  preferencesLabel: 'ACCOUNT PREFERENCES',
  sharedLabel: 'SHARED WITH',
  people: [
    { src: '', alt: 'Shared with person 1' },
    { src: '', alt: 'Shared with person 2' },
  ],
} satisfies Omit<
  MobileDrawerProps,
  'onLike' | 'onShare' | 'onOpen' | 'onSelectPhoto' | 'onUpload' | 'onOpenPreferences' | 'onAddPerson'
>

/**
 * The mobile memory drawer: featured-memory header, title and place, photo
 * carousel, trip date, upload action, profile/stats card and the people the
 * memory is shared with.
 *
 * The active carousel slide is held locally rather than lifted into props: the
 * dots are the only thing that changes it, so the caller has nothing to
 * synchronise. `onSelectPhoto` still reports the change outwards for callers
 * that want to preload or track it.
 */
export default function MobileDrawer({
  badge,
  title,
  location,
  photos,
  dateLabel,
  dateValue,
  uploadLabel,
  profileLabel,
  avatar,
  stats,
  preferencesLabel,
  sharedLabel,
  people,
  onLike,
  onShare,
  onOpen,
  onSelectPhoto,
  onUpload,
  onOpenPreferences,
  onAddPerson,
}: MobileDrawerProps) {
  const [active, setActive] = useState(0)

  /**
   * Moves the carousel to `index` and reports it outwards.
   */
  const selectPhoto = (index: number) => {
    setActive(index)
    onSelectPhoto(index)
  }

  const photo = photos[active]

  return (
    <section className="mdrawer">
      <div className="mdrawer-head">
        <span className="eyebrow mdrawer-badge">{badge}</span>

        <div className="mdrawer-actions">
          <button type="button" className="mdrawer-action" onClick={onLike} aria-label="Like this memory">
            <img src={heartIcon} alt="" />
          </button>
          <button type="button" className="mdrawer-action" onClick={onShare} aria-label="Share this memory">
            <img src={shareIcon} alt="" />
          </button>
          <button type="button" className="mdrawer-action" onClick={onOpen} aria-label="Open this memory">
            <img src={chevronIcon} alt="" />
          </button>
        </div>
      </div>

      <div className="mdrawer-heading">
        <h2 className="mdrawer-title">{title}</h2>
        <p className="mdrawer-place">
          <img src={mapPinIcon} alt="" />
          {location}
        </p>
      </div>

      <div className="mdrawer-carousel">
        {photo?.src ? <img className="mdrawer-photo" src={photo.src} alt={photo.alt} /> : <div className="mdrawer-photo" />}

        <div className="mdrawer-dots">
          {photos.map((slide, index) => (
            <button
              key={slide.alt + index}
              type="button"
              className="mdrawer-dot"
              aria-current={index === active}
              aria-label={`Show photo ${index + 1}`}
              onClick={() => selectPhoto(index)}
            />
          ))}
        </div>
      </div>

      <div className="mdrawer-date">
        <span className="mdrawer-date-tile">
          <img src={calendarIcon} alt="" />
        </span>
        <span className="mdrawer-date-text">
          <span className="mdrawer-date-label">{dateLabel}</span>
          <span className="mdrawer-date-value">{dateValue}</span>
        </span>
      </div>

      <button type="button" className="mdrawer-upload" onClick={onUpload}>
        <img src={uploadIcon} alt="" />
        {uploadLabel}
      </button>

      <section className="mdrawer-profile">
        <h3 className="eyebrow mdrawer-profile-label">{profileLabel}</h3>

        <div className="mdrawer-profile-row">
          {avatar ? (
            <img className="mdrawer-avatar" src={avatar} alt="Your profile picture" />
          ) : (
            <span className="mdrawer-avatar">
              <img src={userIcon} alt="" />
            </span>
          )}

          <div className="mdrawer-stats">
            {stats.map((stat) => (
              <div className="mdrawer-stat" key={stat.label}>
                <img src={stat.icon} alt="" />
                <span className="mdrawer-stat-text">
                  <b className="mdrawer-stat-value">{stat.value}</b>
                  <span className="mdrawer-stat-label">{stat.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mdrawer-rule" />

        <button type="button" className="mdrawer-preferences" onClick={onOpenPreferences}>
          {preferencesLabel}
          <img src={chevronFaintIcon} alt="" />
        </button>
      </section>

      <div className="mdrawer-shared">
        <h3 className="eyebrow mdrawer-shared-label">{sharedLabel}</h3>

        <div className="mdrawer-people">
          {people.map((person) =>
            person.src ? (
              <img className="mdrawer-person" key={person.alt} src={person.src} alt={person.alt} />
            ) : (
              <span className="mdrawer-person" key={person.alt} role="img" aria-label={person.alt} />
            ),
          )}

          <button type="button" className="mdrawer-add" onClick={onAddPerson} aria-label="Share with someone else">
            <img src={plusIcon} alt="" />
          </button>
        </div>
      </div>
    </section>
  )
}
