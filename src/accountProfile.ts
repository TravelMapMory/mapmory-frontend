/** Firebase display names are cosmetic and must not affect ownership or identity. */
export function normalizeDisplayName(value: string): string {
  const name = value.trim()
  if (!name) throw new Error('Enter a display name.')
  if (Array.from(name).length > 80) throw new Error('Use 80 characters or fewer.')
  return name
}
