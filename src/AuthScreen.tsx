import { useId, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { authErrorMessage, firebaseEnabled, logIn, requestPasswordReset, signUp } from './auth'
import './LandingScreen.css'
import './AuthScreen.css'
import BrandMark from './components/BrandMark'
import PrivacyLink from './components/PrivacyLink'

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
  const [showPassword, setShowPassword] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [resetSent, setResetSent] = useState(false)

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

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await requestPasswordReset(resetEmail)
      setResetSent(true)
    } catch (failure) {
      const code = typeof failure === 'object' && failure && 'code' in failure ? String(failure.code) : ''
      // Do not disclose whether the address is registered, even with older Firebase settings.
      if (code === 'auth/user-not-found') setResetSent(true)
      else setError(authErrorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  function switchMode() {
    setError('')
    setResetOpen(false)
    setResetSent(false)
    onModeChange(signup ? 'login' : 'signup')
  }

  return (
    <div className="land">
      <header className="land-hdr">
        <div className="land-brand">
          <BrandMark />
          <strong className="land-name">MapMory</strong>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Back
        </button>
      </header>

      <main id="main" tabIndex={-1} className="auth-body">
        <section className="auth-card" aria-labelledby={`${id}-title`}>
          <h1 id={`${id}-title`} className="auth-title">
            {resetOpen && !signup ? 'Reset your password' : title}
          </h1>
          <p className="auth-sub">
            {signup ? 'Start pinning your trip photos. Everything stays private until you share it.' : 'Welcome back.'}
          </p>

          {!signup && resetOpen && firebaseEnabled ? (
            <form className="auth-form" onSubmit={sendReset}>
              <p className="auth-hint">Enter your email address to request a password-reset link.</p>
              <div className="auth-field">
                <label htmlFor={`${id}-reset-email`}>Email</label>
                <input id={`${id}-reset-email`} type="email" autoComplete="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} />
              </div>
              {error ? <p className="auth-error" role="alert">{error}</p> : null}
              {resetSent ? <p role="status" className="auth-hint">If an account exists for this address, a password-reset email has been sent. Check your inbox and spam folder.</p> : null}
              <button type="submit" className="btn btn-action auth-submit" disabled={busy}>{busy ? 'Please wait…' : 'Send reset link'}</button>
              <button type="button" className="auth-link" onClick={() => { setResetOpen(false); setError(''); setResetSent(false) }}>Back to log in</button>
            </form>
          ) : <form className="auth-form" onSubmit={submit}>
            {signup ? (
              <div className="auth-field">
                <label htmlFor={`${id}-name`}>Name (optional)</label>
                <input id={`${id}-name`} name="name" type="text" autoComplete="name" />
              </div>
            ) : null}
            <div className="auth-field">
              <label htmlFor={`${id}-email`}>Email{signup ? <><span className="auth-required" aria-hidden="true"> *</span><span className="visually-hidden"> (required)</span></> : null}</label>
              <input id={`${id}-email`} name="email" type="email" autoComplete="email" required={firebaseEnabled} value={emailInput} onChange={(event) => setEmailInput(event.target.value)} />
            </div>
            <div className="auth-field">
              <label htmlFor={`${id}-password`}>Password{signup ? <><span className="auth-required" aria-hidden="true"> *</span><span className="visually-hidden"> (required)</span></> : null}</label>
              <div className="auth-password">
                <input
                  id={`${id}-password`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  required={firebaseEnabled}
                  minLength={signup && firebaseEnabled ? 6 : undefined}
                  aria-describedby={signup ? `${id}-password-hint` : undefined}
                />
                <button
                  type="button"
                  className="auth-reveal"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
              {signup ? (
                <p id={`${id}-password-hint`} className="auth-hint">
                  At least 6 characters. We will email you a link to confirm your address.
                </p>
              ) : null}
            </div>
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-action auth-submit" disabled={busy}>
              {busy ? 'Please wait…' : submitLabel}
            </button>
            {signup ? (
              <p className="auth-hint auth-privacy">
                What happens to your data is explained in the <PrivacyLink>privacy policy</PrivacyLink>.
              </p>
            ) : null}
          </form>}
          {!signup && !resetOpen && firebaseEnabled ? (
            <p className="auth-switch"><button type="button" className="auth-link" onClick={() => { setResetEmail(emailInput); setError(''); setResetOpen(true) }}>Forgot password?</button></p>
          ) : null}

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
