import type { MouseEvent, ReactNode } from 'react'
import { navigate } from '../router'

/**
 * A real link to the privacy policy, so it can be opened in a new tab or
 * copied; a plain click moves inside the app without reloading.
 */
export default function PrivacyLink({ children = 'Privacy policy' }: { children?: ReactNode }) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate({ name: 'privacy' })
  }
  return (
    <a href="/privacy" onClick={open}>
      {children}
    </a>
  )
}
