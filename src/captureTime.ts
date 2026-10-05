/** Validate a camera's local timestamp without converting it to the viewer's timezone. */
export function parseCaptureTime(local: string | null): Date | null {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local) || local.startsWith('0000')) return null
  const date = new Date(`${local}Z`)
  // The round trip rejects impossible days as well as out-of-range time fields.
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === local ? date : null
}
