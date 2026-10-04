/*
 * Date formatting shared by cards and lists. Capture dates are local calendar
 * dates ("2026-06-01"), so they are formatted in UTC to stop the viewer's own
 * time zone from shifting them by a day.
 */
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const full = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

/** "1–13 Jun 2026", "28 May – 3 Jun 2026", or "30 Dec 2025 – 2 Jan 2026". examples */
export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const a = parseDate(start)
  const b = parseDate(end)
  if (start.slice(0, 10) === end.slice(0, 10)) return full.format(a)
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${full.format(a)} – ${full.format(b)}`
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${dayMonth.format(a)} – ${full.format(b)}`
  return `${day.format(a)}–${full.format(b)}`
}

/** Upload timestamps are real instants, so they use the viewer's time zone. */
export function formatUploaded(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** "1 photo", "7 photos". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

const captured = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/**
 * "12 Jun 2026, 18:40" for a local capture time. It is wall-clock time at
 * the place the photo was taken, so it is shown as recorded, never converted.
 */
export function formatCaptured(local: string | null): string | null {
  if (!local) return null
  return captured.format(new Date(`${local.slice(0, 19)}Z`))
}
