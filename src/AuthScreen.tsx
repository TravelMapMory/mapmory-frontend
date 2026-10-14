import { useId, type FormEvent } from 'react'
import { ArrowLeft, MapPin } from 'lucide-react'
import './LandingScreen.css'
import './AuthScreen.css'

export type AuthMode = 'signup' | 'login'

export interface AuthScreenProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  /** Called on submit. Until Firebase Auth lands any input opens the demo account. */
  onSignedIn: () => void
  onBack: () => void
}

/**
 * Sign up and log in share one card; the link under the form switches mode.
 * The fields are not checked yet: Firebase Auth will own validation.
 */
export default function AuthScreen({ mode, onModeChange, onSignedIn, onBack }: AuthScreenProps) {
  const id = useId()
  const signup = mode === 'signup'
  const title = signup ? 'Create your account' : 'Log in to MapMory'
  const submitLabel = signup ? 'Create account' : 'Log in'

  function submit(event: FormEvent) {
    event.preventDefault()
    onSignedIn()
  }

  return (
    <div className="land">
      <header className="land-hdr">
        <div className="land-brand">
          <span className="land-logo">
            <MapPin size={18} strokeWidth={2.6667} aria-hidden />
          </span>
          <strong className="land-name">MapMory</strong>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Back
        </button>
      </header>

      <main className="auth-body">
        <section className="auth-card" aria-labelledby={`${id}-title`}>
          <h1 id={`${id}-title`} className="auth-title">
            {title}
          </h1>
          <p className="auth-sub">
            {signup ? 'Start pinning your trip photos. Everything stays private until you share it.' : 'Welcome back.'}
          </p>

          <form className="auth-form" onSubmit={submit}>
            {signup ? (
              <div className="auth-field">
                <label htmlFor={`${id}-name`}>Name</label>
                <input id={`${id}-name`} name="name" type="text" autoComplete="name" />
              </div>
            ) : null}
            <div className="auth-field">
              <label htmlFor={`${id}-email`}>Email</label>
              <input id={`${id}-email`} name="email" type="email" autoComplete="email" />
            </div>
            <div className="auth-field">
              <label htmlFor={`${id}-password`}>Password</label>
              <input
                id={`${id}-password`}
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
              />
            </div>
            <button type="submit" className="btn btn-action auth-submit">
              {submitLabel}
            </button>
          </form>

          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to MapMory?'}{' '}
            <button type="button" className="auth-link" onClick={() => onModeChange(signup ? 'login' : 'signup')}>
              {signup ? 'Log in' : 'Create an account'}
            </button>
          </p>
          <p className="auth-demo">Demo: sign-in is not connected yet, so any details open the sample account.</p>
        </section>
      </main>
    </div>
  )
}
