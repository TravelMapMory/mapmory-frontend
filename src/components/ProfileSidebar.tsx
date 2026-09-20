import { Award, Lock, MapPin, RefreshCw, SquarePen, User } from 'lucide-react'

import './ProfileSidebar.css'

/**
 * One row of the design's "Account & preferences" group: a glyph, an uppercase
 * micro-label and the current value. `icon` selects one of the three glyphs the
 * frame uses and `id` is what the row reports back to `onSelectPreference`, so
 * the caller knows which setting the traveller opened.
 */
export interface PreferenceRow {
  id: string
  icon: 'tier' | 'privacy' | 'sync'
  label: string
  value: string
}

/**
 * Content and callbacks for the profile page's left column. Per-traveller text
 * arrives as props, while the design's fixed chrome ("ABOUT ME", "Edit Traveler
 * Profile", "LIVE MAP ACTIVE", "ACCOUNT & PREFERENCES") stays inside the
 * component so callers cannot drift from the design.
 *
 * `avatarSrc` and `mapImageSrc` are optional: without them the neutral
 * placeholders the Figma frame itself shows are rendered.
 */
export interface ProfileSidebarProps {
  name: string
  handle: string
  location: string
  about: string
  avatarSrc?: string
  mapTitle: string
  mapImageSrc?: string
  preferences: PreferenceRow[]
  onEditProfile: () => void
  onSelectPreference: (id: string) => void
}

/**
 * The Lucide glyph each "Account & preferences" row draws, keyed by
 * `PreferenceRow.icon`. The design's icon set is Lucide, so these are the real
 * glyphs rather than the hand-authored stand-ins that stood here before.
 */
const PREFERENCE_ICONS = {
  tier: Award,
  privacy: Lock,
  sync: RefreshCw,
}

/**
 * The design's own content, exported so the profile screen (and any future
 * story or test) can render the column exactly as the Figma frame shows it.
 *
 * The account-tier value deliberately reads "MapMory Pro (Lifetime)" where
 * Figma still says "UniMap Pro (Lifetime)": the product was renamed and every
 * other surface already says MapMory, so the Figma string is the stale one.
 */
export const PROFILE_SIDEBAR_EXAMPLE = {
  name: 'Teemu Pukki',
  handle: '@teemupukki',
  location: 'Helsinki, Finland',
  about:
    'Documenting memories across Europe. Love old architectural landmarks, late-night cafe journals, and capturing local vibes through my camera.',
  mapTitle: 'Explore Europe Memory Map',
  preferences: [
    { id: 'account-tier', icon: 'tier', label: 'ACCOUNT TIER', value: 'MapMory Pro (Lifetime)' },
    { id: 'map-privacy', icon: 'privacy', label: 'MAP PRIVACY', value: 'Shared with Companions' },
    { id: 'auto-sync', icon: 'sync', label: 'AUTO-SYNC', value: 'Enabled (Syncing Camera Roll)' },
  ],
} satisfies Omit<ProfileSidebarProps, 'onEditProfile' | 'onSelectPreference'>

/**
 * The profile page's left column: the traveller's identity card, the live-map
 * teaser and the account & preference rows. The Figma frame positions the three
 * cards absolutely; they are a plain flex column here because nothing in the
 * design needs to leave normal flow.
 */
export default function ProfileSidebar({
  name,
  handle,
  location,
  about,
  avatarSrc,
  mapTitle,
  mapImageSrc,
  preferences,
  onEditProfile,
  onSelectPreference,
}: ProfileSidebarProps) {
  return (
    <div className="psb">
      <section className="psb-hero">
        <div className="psb-avatar">
          <div className="psb-avatar-inner">
            {avatarSrc ? (
              <img className="psb-avatar-photo" src={avatarSrc} alt={name} />
            ) : (
              <User size={56} strokeWidth={0.8571} aria-hidden />
            )}
          </div>
        </div>

        <h2 className="psb-name">{name}</h2>
        <p className="psb-handle">{handle}</p>
        <p className="psb-location">
          <MapPin className="psb-pin" size={14} strokeWidth={3.4286} aria-hidden />
          {location}
        </p>

        <p className="eyebrow psb-eyebrow psb-about-label">ABOUT ME</p>
        <p className="psb-about">{about}</p>

        <button type="button" className="psb-edit" onClick={onEditProfile}>
          <SquarePen size={14} strokeWidth={3.4286} aria-hidden />
          Edit Traveler Profile
        </button>
      </section>

      <section className="psb-map">
        {mapImageSrc ? <img className="psb-map-photo" src={mapImageSrc} alt="" /> : null}
        <span className="psb-map-pill">
          <span className="psb-map-dot" />
          <span className="eyebrow psb-map-pill-text">LIVE MAP ACTIVE</span>
        </span>
        <h3 className="psb-map-title">{mapTitle}</h3>
      </section>

      <section className="psb-prefs">
        <h3 className="eyebrow psb-eyebrow psb-prefs-label">ACCOUNT &amp; PREFERENCES</h3>
        <ul className="psb-pref-list">
          {preferences.map((preference) => {
            const Icon = PREFERENCE_ICONS[preference.icon]

            return (
              <li key={preference.id}>
                <button
                  type="button"
                  className="psb-pref"
                  onClick={() => onSelectPreference(preference.id)}
                >
                  <Icon className="psb-pref-icon" size={16} strokeWidth={3} aria-hidden />
                  <span className="psb-pref-text">
                    <span className="eyebrow psb-eyebrow psb-pref-label">{preference.label}</span>
                    <span className="psb-pref-value">{preference.value}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
