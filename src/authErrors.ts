/** Firebase Auth error codes as messages the user can act on (issue #8). */
const messages: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Could not reach the sign-in service. Check your connection and try again.',
  'auth/requires-recent-login': 'For your security, sign in again and then retry.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled for this site yet. Please contact the MapMory team.',
  'auth/invalid-api-key': 'Sign-in is misconfigured on this site. Please contact the MapMory team.',
}

/** A message the user can act on; Firebase's own text and codes stay out of the UI. */
export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  return messages[code] ?? 'Something went wrong. Please try again.'
}
