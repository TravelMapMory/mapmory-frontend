import { useState } from 'react'
import { MapPin } from 'lucide-react'
import './ProfileMain.css'

/**
 * One image slot of the design. `src` is optional because the Figma asset
 * pipeline was unavailable when this column was built: without a src the slot
 * renders the design's empty tile rather than a committed stand-in file.
 */
export interface ProfileMainPhoto {
  src?: string
  alt?: string
}

/**
 * One card of the metrics grid. `highlight` marks the streak card, which the
 * design distinguishes with a teal border and a teal number.
 */
export interface ProfileMainStat {
  value: string
  label: string
  highlight?: boolean
}

/**
 * One numbered entry of "Journey Path & Memory Log". The design holds each row
 * as a single string whose city prefix is bold, so it is split in two here.
 */
export interface ProfileMainStep {
  city: string
  note: string
}

/**
 * One chip of the "Top Visited Cities" row: a 32px thumbnail and a city name.
 */
export interface ProfileMainCity {
  name: string
  thumb?: string
}

/**
 * The featured journey card: its amber status pill, headline, route line, hero
 * carousel, numbered memory log and companion row.
 */
export interface ProfileMainJourney {
  tag: string
  lastModified: string
  title: string
  route: string
  photos: ProfileMainPhoto[]
  steps: ProfileMainStep[]
  companions: string[]
  companionsNote: string
}

/**
 * Everything the profile page's right column renders. All of it is content, so
 * it arrives as props; the section labels are design chrome and stay in markup.
 */
export interface ProfileMainProps {
  stats: ProfileMainStat[]
  journey: ProfileMainJourney
  topCities: ProfileMainCity[]
  pinboard: ProfileMainPhoto[]
  /** Opens the companion picker. Without it the "+" control renders disabled. */
  onAddCompanion?: () => void
  /** Opens the full pinned-photo view. Without it the link renders disabled. */
  onViewAllPhotos?: () => void
}

/**
 * The design's own content for this column, exported so a caller can render the
 * column exactly as the Figma frame shows it.
 */
export const profileMainExample: ProfileMainProps = {
  stats: [
    { value: '12', label: 'Countries Visited' },
    { value: '47', label: 'Cities Visited' },
    { value: '1,420', label: 'Photos Pinned' },
    { value: '14 Days', label: 'Application Streak', highlight: true },
  ],
  journey: {
    tag: 'Active Memory Journey',
    lastModified: 'Last modified: Feb 28, 2024',
    title: 'My Journey Story: Honeymoon Trip (Feb 2024)',
    route: 'Multicity: Paris, Helsinki, London, Berlin, Rome',
    photos: [
      { alt: 'Paris' },
      { alt: 'Helsinki' },
      { alt: 'London' },
      { alt: 'Berlin' },
      { alt: 'Rome' },
    ],
    steps: [
      {
        city: 'Paris, France',
        note: 'Stayed at the cozy boutique hotel by Seine. Visited Eiffel and spent hours taking film photographs.',
      },
      {
        city: 'Rome, Italy',
        note: 'Wandered through Colosseum ruins during beautiful sunset golden hour. Made memories over wood-fired pizza.',
      },
      {
        city: 'Helsinki, Finland',
        note: 'Welcomed home. Captured snowy landscapes, local harbors, and cathedral details.',
      },
    ],
    companions: ['LK', 'EM'],
    companionsNote: 'Shared with Lukas, Emma, and 2 others',
  },
  topCities: [
    { name: 'Helsinki' },
    { name: 'Paris' },
    { name: 'Berlin' },
    { name: 'London' },
    { name: 'Rome' },
  ],
  pinboard: [{}, {}, {}, {}],
}

/**
 * Renders an image slot: the real photo once a src is supplied, otherwise the
 * design's flat tile. Keeps the three photo sizes (hero, chip thumb, pinboard)
 * on one code path.
 */
function PhotoTile({ photo, className }: { photo: ProfileMainPhoto; className: string }) {
  if (!photo.src) {
    return <div className={className} role="presentation" />
  }

  return <img className={className} src={photo.src} alt={photo.alt ?? ''} />
}

/**
 * The row of four metric cards above the featured journey.
 */
function StatRow({ stats }: { stats: ProfileMainStat[] }) {
  return (
    <div className="pm-stats">
      {stats.map((stat) => (
        <div className="pm-stat" key={stat.label} data-highlight={stat.highlight === true}>
          <p className="pm-stat-value">{stat.value}</p>
          <span className="eyebrow pm-stat-label">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * The journey card's hero photo with its indicator dots. The dots are real
 * elements rather than the flat SVG the design ships, because which dot is
 * active is interactive state a baked image would freeze.
 */
function JourneyCarousel({ photos }: { photos: ProfileMainPhoto[] }) {
  const [active, setActive] = useState(0)
  const current = photos[active] ?? {}

  return (
    <div className="pm-jrn-carousel">
      <PhotoTile photo={current} className="pm-jrn-hero" />
      <div className="pm-jrn-dots">
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.alt ?? index}
            className="pm-jrn-dot"
            aria-current={index === active}
            aria-label={`Show photo ${index + 1} of ${photos.length}`}
            onClick={() => setActive(index)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The featured journey card: status pill, headline, route, carousel, the
 * numbered memory log and the companion row.
 */
function JourneyCard({
  journey,
  onAddCompanion,
}: {
  journey: ProfileMainJourney
  onAddCompanion?: () => void
}) {
  return (
    <section className="pm-jrn">
      <div className="pm-jrn-head">
        <span className="eyebrow pm-jrn-tag">{journey.tag}</span>
        <span className="pm-jrn-modified">{journey.lastModified}</span>
      </div>

      <h2 className="pm-jrn-title">{journey.title}</h2>

      <p className="pm-jrn-route">
        <MapPin className="pm-jrn-pin" size={14} strokeWidth={3.4286} aria-hidden />
        {journey.route}
      </p>

      <JourneyCarousel photos={journey.photos} />

      <div className="pm-jrn-log">
        <span className="eyebrow pm-jrn-log-label">Journey Path &amp; Memory Log</span>
        <ol className="pm-jrn-steps">
          {journey.steps.map((step, index) => (
            <li className="pm-jrn-step" key={step.city}>
              <span className="pm-jrn-step-num">{index + 1}</span>
              <p className="pm-jrn-step-text">
                <strong>{step.city}</strong> — {step.note}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="pm-jrn-crew">
        <span className="eyebrow pm-jrn-crew-label">Journey Companions</span>
        <div className="pm-jrn-crew-row">
          {journey.companions.map((initials) => (
            <span className="pm-jrn-avatar" key={initials}>
              {initials}
            </span>
          ))}
          <button
            type="button"
            className="pm-jrn-avatar pm-jrn-add"
            aria-label="Add a companion"
            onClick={onAddCompanion}
            disabled={onAddCompanion === undefined}
          >
            +
          </button>
          <span className="pm-jrn-crew-note">{journey.companionsNote}</span>
        </div>
      </div>
    </section>
  )
}

/**
 * The "Top Visited Cities" chip row. Unlike its neighbours this block sits
 * directly on the page background, with no card behind it.
 */
function TopCities({ cities }: { cities: ProfileMainCity[] }) {
  return (
    <section>
      <span className="eyebrow pm-cities-label">Top Visited Cities</span>
      <div className="pm-cities-row">
        {cities.map((city) => (
          <span className="pm-city" key={city.name}>
            <PhotoTile photo={{ src: city.thumb, alt: city.name }} className="pm-city-thumb" />
            <span className="pm-city-name">{city.name}</span>
          </span>
        ))}
      </div>
    </section>
  )
}

/**
 * The "Visual Pinboard" card: heading, the "View All Pinned Photos" action and
 * a row of four photos.
 */
function Pinboard({
  photos,
  onViewAllPhotos,
}: {
  photos: ProfileMainPhoto[]
  onViewAllPhotos?: () => void
}) {
  return (
    <section className="pm-pin">
      <div className="pm-pin-head">
        <h2 className="pm-pin-title">Visual Pinboard</h2>
        <button
          type="button"
          className="pm-pin-link"
          onClick={onViewAllPhotos}
          disabled={onViewAllPhotos === undefined}
        >
          View All Pinned Photos
        </button>
      </div>
      <div className="pm-pin-grid">
        {photos.map((photo, index) => (
          <PhotoTile photo={photo} className="pm-pin-photo" key={photo.alt ?? index} />
        ))}
      </div>
    </section>
  )
}

/**
 * The profile page's right column (Figma node 8:61): the metrics grid, the
 * featured journey card, the top-cities chips and the visual pinboard, stacked
 * with the design's 32px rhythm.
 */
export default function ProfileMain({
  stats,
  journey,
  topCities,
  pinboard,
  onAddCompanion,
  onViewAllPhotos,
}: ProfileMainProps) {
  return (
    <div className="pm-col">
      <StatRow stats={stats} />
      <JourneyCard journey={journey} onAddCompanion={onAddCompanion} />
      <TopCities cities={topCities} />
      <Pinboard photos={pinboard} onViewAllPhotos={onViewAllPhotos} />
    </div>
  )
}
