import { useCallback, useEffect, useRef, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { authErrorMessage, refreshVerification, resendVerification } from '../auth'
import './VerifyEmailBanner.css'

export interface VerifyEmailBannerProps {
  email: string
  /** Called once Firebase confirms the address, so the banner can go away. */
  onVerified: () => void
  /**
   * On the map pages the banner floats over the map as a compact card, so it
   * never changes the map's size (which would move the view).
   */
  floating?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'sent' }
  | { kind: 'not-yet' }
  | { kind: 'verified' }
  | { kind: 'error'; message: string }

/** How often the banner asks Firebase again while it is on screen. */
const CHECK_EVERY_MS = 15_000
/** How long the success message stays before the banner goes. */
const VERIFIED_FOR_MS = 4_000

/**
 * A gentle reminder to verify the email address after sign-up. It never blocks
 * the app: the owner can keep working, resend the link, or tell MapMory they
 * have clicked it (Firebase is then asked again).
 */
export default function VerifyEmailBanner({ email, onVerified, floating = false }: VerifyEmailBannerProps) {
  const placement = floating ? ' verify--floating' : ''
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [hidden, setHidden] = useState(false)
  const verified = state.kind === 'verified'
  const checking = useRef(false)

  const markVerified = useCallback(() => {
    setState({ kind: 'verified' })
  }, [])

  // Clicking the emailed link happens in another tab or app. Notice it without
  // a button press: when the owner comes back to this tab, and every 15 s.
  useEffect(() => {
    if (hidden || verified) return
    async function quietCheck() {
      if (checking.current || document.visibilityState !== 'visible') return
      checking.current = true
      try {
        if (await refreshVerification()) markVerified()
      } catch {
        // Offline or rate limited: the next check, or the button, tries again.
      } finally {
        checking.current = false
      }
    }
    const timer = window.setInterval(() => void quietCheck(), CHECK_EVERY_MS)
    window.addEventListener('focus', quietCheck)
    document.addEventListener('visibilitychange', quietCheck)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', quietCheck)
      document.removeEventListener('visibilitychange', quietCheck)
    }
  }, [hidden, verified, markVerified])

  // Say so briefly, then let the app drop the banner.
  useEffect(() => {
    if (!verified) return
    const timer = window.setTimeout(onVerified, VERIFIED_FOR_MS)
    return () => window.clearTimeout(timer)
  }, [verified, onVerified])

  if (hidden) return null

  if (verified) {
    return (
      <section className={`verify verify--done${placement}`} aria-labelledby="verify-title">
        <MailCheck size={20} aria-hidden className="verify-icon" />
        <div className="verify-text">
          <h2 id="verify-title" className="verify-title">
            Email address verified
          </h2>
          <p role="status">Thank you, {email} is confirmed.</p>
        </div>
      </section>
    )
  }

  async function resend() {
    setState({ kind: 'busy' })
    try {
      await resendVerification()
      setState({ kind: 'sent' })
    } catch (error) {
      setState({ kind: 'error', message: authErrorMessage(error) })
    }
  }

  async function check() {
    setState({ kind: 'busy' })
    try {
      if (await refreshVerification()) markVerified()
      else setState({ kind: 'not-yet' })
    } catch (error) {
      setState({ kind: 'error', message: authErrorMessage(error) })
    }
  }

  const busy = state.kind === 'busy'
  return (
    <section className={`verify${placement}`} aria-labelledby="verify-title">
      <MailCheck size={20} aria-hidden className="verify-icon" />
      <div className="verify-text">
        <h2 id="verify-title" className="verify-title">
          Verify your email address
        </h2>
        {floating ? (
          <p>
            Check <strong>{email}</strong> for a verification link.
          </p>
        ) : (
          <p>
            Check <strong>{email}</strong> for a verification link. Open it to confirm the address; you can keep
            using MapMory meanwhile. If the email does not arrive or the link expires, select Resend email.
          </p>
        )}
        <p className="verify-status" role="status">
          {state.kind === 'sent' ? 'A new link is on its way. Check your spam folder too.' : null}
          {state.kind === 'not-yet' ? 'Not verified yet. Open the link in the email, then try again.' : null}
        </p>
        {state.kind === 'error' ? (
          <p className="verify-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="verify-actions">
        <button type="button" className="btn btn-primary" onClick={() => void check()} disabled={busy}>
          I have verified it
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void resend()} disabled={busy}>
          Resend email
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setHidden(true)}>
          Remind me later
        </button>
      </div>
    </section>
  )
}
