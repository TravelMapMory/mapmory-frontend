import '../LandingScreen.css'
import BrandMark from './BrandMark'

export interface PublicHeaderProps {
  /** The brand returns to the landing page. */
  onHome: () => void
  onSignIn: () => void
}

/**
 * The bar above pages anyone can open without an account (doc 3.1): the
 * brand and a way to sign in, but none of the owner's navigation.
 */
export default function PublicHeader({ onHome, onSignIn }: PublicHeaderProps) {
  return (
    <header className="land-hdr">
      <button type="button" className="land-brand land-brand-btn" onClick={onHome} aria-label="MapMory home">
        <BrandMark />
        <strong className="land-name">MapMory</strong>
      </button>
      <button type="button" className="btn btn-secondary" onClick={onSignIn}>
        Sign in
      </button>
    </header>
  )
}
