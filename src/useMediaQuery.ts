import { useEffect, useState } from 'react'

/**
 * Tracks a CSS media query from React so a component can pick between two
 * genuinely different layouts. The design ships the memory drawer twice — a
 * 420px panel docked beside the desktop map and a 422px full-width mobile
 * screen — and they differ in content, not only in styling, so a CSS-only
 * breakpoint cannot express the switch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
