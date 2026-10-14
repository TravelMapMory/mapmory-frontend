import { Lock, MapIcon, MapPin, Share2, Upload } from 'lucide-react'
import heroPhoto from './assets/pins/paris-wide.jpg'
import './LandingScreen.css'

export interface LandingScreenProps {
  /** Opens the log-in form. */
  onSignIn: () => void
  /** Opens the sign-up form. */
  onSignUp: () => void
}

/** The three must-have features agreed with the TA (meeting 20.9). */
const FEATURES = [
  {
    icon: Upload,
    title: 'Upload your trip photos',
    text: 'MapMory reads where and when each photo was taken. Photos without a location wait for you in a short review list.',
  },
  {
    icon: MapIcon,
    title: 'See every trip on a map',
    text: 'Browse your photos as pins, filter by trip or date, and jump to any place in the world.',
  },
  {
    icon: Share2,
    title: 'Share when you choose',
    text: 'Everything is private by default. Share a trip by link; shared views show the city, never the exact spot.',
  },
]

/**
 * The page a signed-out visitor sees first (demo gala feedback): what MapMory
 * is, the three things it does, and one way in.
 */
export default function LandingScreen({ onSignIn, onSignUp }: LandingScreenProps) {
  return (
    <div className="land">
      <header className="land-hdr">
        <div className="land-brand">
          <span className="land-logo">
            <MapPin size={18} strokeWidth={2.6667} aria-hidden />
          </span>
          <strong className="land-name">MapMory</strong>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onSignIn}>
          Sign in
        </button>
      </header>

      <main className="land-body">
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
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="land-feature">
                <span className="land-feature-icon">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="land-feature-title">{title}</h3>
                <p className="land-feature-text">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
