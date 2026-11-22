/** Field limits shared by the forms and the mock, so both reject the same input. */
export const TITLE_MAX = 120
export const NOTES_MAX = 2000

/**
 * Length in Unicode code points, the unit the backend counts with
 * `utf8.RuneCountInString`. `String.length` counts UTF-16 code units, so an
 * emoji outside the BMP would count twice there.
 */
export function codePoints(value: string): number {
  return Array.from(value).length
}

/** Why a trip title would be refused, measured after trimming like the backend; null when it is valid. */
export function tripTitleProblem(value: string): string | null {
  const length = codePoints(value.trim())
  if (length === 0) return 'Enter a trip name.'
  if (length > TITLE_MAX) return `A trip name can be at most ${TITLE_MAX} characters (now ${length}).`
  return null
}
