import { Globe, Lock, MapIcon, Share2, Upload } from 'lucide-react'
import heroPhoto from './assets/pins/paris-wide.jpg'
import berlinPhoto from './assets/pins/berlin-dom.jpg'
import helsinkiPhoto from './assets/pins/helsinki-uspenski.jpg'
import romePhoto from './assets/pins/rome-trevi.jpg'
import './LandingScreen.css'
import BrandMark from './components/BrandMark'

export interface LandingScreenProps {
  /** Opens the log-in form. */
  onSignIn: () => void
  /** Opens the sign-up form. */
  onSignUp: () => void
  /** Opens Map · Public, which needs no account (doc 3.2). */
  onExplore: () => void
  deletionNotice?: string
}

/** Photos from the demo trips, shown as the uploads and the map pins of the feature tiles. */
const TILE_PHOTOS = [
  { src: romePhoto, alt: 'Trevi Fountain, Rome' },
  { src: helsinkiPhoto, alt: 'Uspenski Cathedral, Helsinki' },
  { src: berlinPhoto, alt: 'Berlin Cathedral' },
]

/** The three must-have features agreed with the TA (meeting 20.9), each with its own tile look. */
const FEATURES = [
  {
    icon: Upload,
    title: 'Upload your trip photos',
    text: 'MapMory reads where and when each photo was taken. Photos without a location wait for you in a short review list.',
    variant: 'upload',
  },
  {
    icon: MapIcon,
    title: 'See every trip on a map',
    text: 'Browse your photos as pins, filter by trip or date, and jump to any place in the world.',
    variant: 'map',
  },
  {
    icon: Share2,
    title: 'Share when you choose',
    text: 'Everything is private by default. Share a trip by link; shared views show the city, never the exact spot.',
    variant: 'share',
  },
] as const

/**
 * The page a signed-out visitor sees first (demo gala feedback): what MapMory
 * is, the three things it does, and one way in.
 */
export default function LandingScreen({ onSignIn, onSignUp, onExplore, deletionNotice }: LandingScreenProps) {
  return (
    <div className="land">
      <header className="land-hdr">
        <div className="land-brand">
          <BrandMark />
          <strong className="land-name">MapMory</strong>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onSignIn}>
          Sign in
        </button>
      </header>

      <main id="main" tabIndex={-1} className="land-body">
        {deletionNotice ? <p role="status" className="land-delete-notice">{deletionNotice}</p> : null}
        <section className="land-hero" aria-labelledby="land-title">
          <div className="land-hero-text">
            <h1 id="land-title" className="land-title">
              Your travel photos, back where they were taken
            </h1>
            <p className="land-lead">
              Upload photos from a trip and MapMory places them on a map, groups them by country and city, and keeps
              them private until you decide to share.
            </p>
            <div className="land-actions">
              <button type="button" className="btn btn-action land-cta" onClick={onSignUp}>
                Get started
              </button>
              <button type="button" className="btn btn-secondary land-cta" onClick={onExplore}>
                <Globe size={16} aria-hidden />
                Explore the public map
              </button>
              <span className="land-note">
                <Lock size={14} aria-hidden />
                Private by default
              </span>
            </div>
          </div>
          <figure className="land-hero-figure">
            <img src={heroPhoto} alt="Paris rooftops seen from above" className="land-hero-img" />
            <figcaption className="land-credit">Photo: Wladyslaw Sojka, CC BY 3.0</figcaption>
          </figure>
        </section>

        <section className="land-features" aria-labelledby="land-features-title">
          <h2 id="land-features-title" className="visually-hidden">
            What you can do
          </h2>
          <ul className="land-feature-list">
            {FEATURES.map(({ icon: Icon, title, text, variant }) => (
              <li key={title} className="land-feature" data-variant={variant}>
                <span className="land-feature-icon">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="land-feature-title">{title}</h3>
                <p className="land-feature-text">{text}</p>
                {variant === 'upload' ? (
                  <div className="land-stack" aria-hidden>
                    {TILE_PHOTOS.map((photo) => (
                      <img key={photo.alt} src={photo.src} alt="" className="land-stack-photo" loading="lazy" />
                    ))}
                  </div>
                ) : null}
                {variant === 'map' ? (
                  <div className="land-pins" aria-hidden>
                    <svg className="land-route" viewBox="0 0 200 220">
                      <path d="M57 63 C 112 66, 128 96, 143 131 S 86 168, 60 174" />
                    </svg>
                    {TILE_PHOTOS.map((photo) => (
                      <img key={photo.alt} src={photo.src} alt="" className="land-pin" loading="lazy" />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
