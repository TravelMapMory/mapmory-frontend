import { useId, useState, type FormEvent } from 'react'
import { ArrowLeft, MapPin } from 'lucide-react'
import { authErrorMessage, firebaseEnabled, logIn, signUp } from './auth'
import './LandingScreen.css'
import './AuthScreen.css'

export type AuthMode = 'signup' | 'login'

export interface AuthScreenProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  /** Called once signed in. Without Firebase configured any input opens the demo account. */
  onSignedIn: () => void
  onBack: () => void
}

/**
 * Sign up and log in share one card; the link under the form switches mode.
 * Firebase Auth checks the details; its errors are shown in plain words.
 */
export default function AuthScreen({ mode, onModeChange, onSignedIn, onBack }: AuthScreenProps) {
  const id = useId()
  const signup = mode === 'signup'
  const title = signup ? 'Create your account' : 'Log in to MapMory'
  const submitLabel = signup ? 'Create account' : 'Log in'

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!firebaseEnabled) return onSignedIn()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '')
    setBusy(true)
    setError('')
    try {
      if (signup) await signUp(field('name'), field('email'), field('password'))
      else await logIn(field('email'), field('password'))
      onSignedIn()
    } catch (failure) {
      setError(authErrorMessage(failure))
      setBusy(false)
    }
  }

  function switchMode() {
    setError('')
    onModeChange(signup ? 'login' : 'signup')
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
              <input id={`${id}-email`} name="email" type="email" autoComplete="email" required={firebaseEnabled} />
            </div>
            <div className="auth-field">
              <label htmlFor={`${id}-password`}>Password</label>
              <input
                id={`${id}-password`}
                name="password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                required={firebaseEnabled}
              />
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-action auth-submit" disabled={busy}>
              {busy ? 'Please wait…' : submitLabel}
            </button>
          </form>

          <p className="auth-switch">
            {signup ? 'Already have an account?' : 'New to MapMory?'}{' '}
            <button type="button" className="auth-link" onClick={switchMode}>
              {signup ? 'Log in' : 'Create an account'}
            </button>
          </p>
          {firebaseEnabled ? null : (
            <p className="auth-demo">Demo: sign-in is not connected yet, so any details open the sample account.</p>
          )}
        </section>
      </main>
    </div>
  )
}
