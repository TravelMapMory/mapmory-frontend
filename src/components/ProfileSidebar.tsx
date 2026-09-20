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
 * Stand-ins for the icons the Figma frame ships as SVG exports. The Figma MCP
 * asset URLs could not be fetched while this file was written (the file's MCP
 * quota was exhausted after the reference render), so these are hand-authored
 * equivalents at the design's box sizes, stroke weight and colours — replace
 * them with the real exports once the quota resets.
 */
const PREFERENCE_ICONS = {
  tier: (
    <svg
      className="psb-pref-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="m15.5 12.9 1.5 8.5-3.6-2.7a1 1 0 0 0-1.2 0L8.5 21.4l1.5-8.5" />
    </svg>
  ),
  privacy: (
    <svg
      className="psb-pref-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  sync: (
    <svg
      className="psb-pref-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 15.7-6L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.7 6L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  ),
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
              <svg width="112" height="112" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="10.5" r="3.7" />
                <path d="M12 16.2a7.6 7.6 0 0 0-7.6 7.6v1.2h15.2v-1.2a7.6 7.6 0 0 0-7.6-7.6Z" />
              </svg>
            )}
          </div>
        </div>

        <h2 className="psb-name">{name}</h2>
        <p className="psb-handle">{handle}</p>
        <p className="psb-location">
          <svg
            className="psb-pin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {location}
        </p>

        <p className="eyebrow psb-eyebrow psb-about-label">ABOUT ME</p>
        <p className="psb-about">{about}</p>

        <button type="button" className="psb-edit" onClick={onEditProfile}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
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
          {preferences.map((preference) => (
            <li key={preference.id}>
              <button
                type="button"
                className="psb-pref"
                onClick={() => onSelectPreference(preference.id)}
              >
                {PREFERENCE_ICONS[preference.icon]}
                <span className="psb-pref-text">
                  <span className="eyebrow psb-eyebrow psb-pref-label">{preference.label}</span>
                  <span className="psb-pref-value">{preference.value}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
