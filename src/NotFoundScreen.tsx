import { MapPin, MapPinOff } from 'lucide-react'
import './LandingScreen.css'
import './NotFoundScreen.css'

export interface NotFoundScreenProps {
  signedIn: boolean
  onHome: () => void
}

/** Shown for an address the app does not know, e.g. a mistyped or old link. */
export default function NotFoundScreen({ signedIn, onHome }: NotFoundScreenProps) {
  return (
    <div className="land">
      <header className="land-hdr">
        <div className="land-brand">
          <span className="land-logo">
            <MapPin size={18} strokeWidth={2.6667} aria-hidden />
          </span>
          <strong className="land-name">MapMory</strong>
        </div>
      </header>
      <main className="nf-body">
        <span className="nf-icon">
          <MapPinOff size={28} aria-hidden />
        </span>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-text">This address does not lead anywhere in MapMory. The link may be mistyped or out of date.</p>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          {signedIn ? 'Go to Dashboard' : 'Go to home page'}
        </button>
      </main>
    </div>
  )
}
