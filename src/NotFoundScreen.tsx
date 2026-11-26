import { MapPinOff } from 'lucide-react'
import './LandingScreen.css'
import './NotFoundScreen.css'
import BrandMark from './components/BrandMark'

export interface NotFoundScreenProps {
  signedIn: boolean
  /** The parent application layout already owns the site header and main landmark. */
  embedded?: boolean
  onHome: () => void
}

/** Shown for an address the app does not know, e.g. a mistyped or old link. */
export default function NotFoundScreen({ signedIn, onHome, embedded = false }: NotFoundScreenProps) {
  const Body = embedded ? 'div' : 'main'
  return (
    <div className={embedded ? 'nf-embedded' : 'land'}>
      {!embedded ? (
        <header className="land-hdr">
        <div className="land-brand">
          <BrandMark />
          <strong className="land-name">MapMory</strong>
        </div>
        </header>
      ) : null}
      <Body className="nf-body" id={embedded ? undefined : 'main'} tabIndex={embedded ? undefined : -1}>
        <span className="nf-icon">
          <MapPinOff size={28} aria-hidden />
        </span>
        <h1 className="nf-title">Page not found</h1>
        <p className="nf-text">This address does not lead anywhere in MapMory. The link may be mistyped or out of date.</p>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          {signedIn ? 'Go to Dashboard' : 'Go to home page'}
        </button>
      </Body>
    </div>
  )
}
