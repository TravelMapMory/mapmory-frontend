/*
 * Firebase Authentication (issue #8). Email and password go straight to
 * Firebase; the backend only ever sees the ID token (src/api/http.ts).
 * Without VITE_FIREBASE_API_KEY the app keeps the demo sign-in, so the mock
 * and the acceptance tests run without a Firebase project.
 */
import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
} from 'firebase/auth'
import { setTokenProvider } from './api/http'

export { authErrorMessage } from './authErrors'

const env = import.meta.env

export const firebaseEnabled = Boolean(env.VITE_FIREBASE_API_KEY)

let auth: Auth | null = null

function firebaseAuth(): Auth {
  if (!auth) {
    const app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
    auth = getAuth(app)
    // Local development without the shared project: the Firebase Auth emulator.
    if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
      connectAuthEmulator(auth, env.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true })
    }
    const current = auth
    // A fresh token per request; the SDK caches it and renews it before expiry (issue #22).
    setTokenProvider(async (forceRefresh) => (current.currentUser ? current.currentUser.getIdToken(forceRefresh) : null))
  }
  return auth
}

/**
 * Calls `onChange` with whether someone is signed in: once Firebase has
 * restored the session, then on every change. Returns the unsubscribe.
 */
export function watchSignedIn(onChange: (signedIn: boolean) => void): () => void {
  return onAuthStateChanged(firebaseAuth(), (user) => onChange(Boolean(user)))
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(firebaseAuth(), email, password)
  if (name.trim()) await updateProfile(user, { displayName: name.trim() })
}

export async function logIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(firebaseAuth(), email, password)
}

export function logOut(): Promise<void> {
  return signOut(firebaseAuth())
}

/**
 * Confirm the owner's password before any irreversible MapMory data deletion.
 * Firebase requires a recent login for deleting an Auth identity; doing this
 * first avoids predictably leaving an identity behind. We currently support
 * email/password accounts; other providers must not bypass this step.
 */
export async function reauthenticateForDeletion(password: string): Promise<void> {
  const current = firebaseAuth().currentUser
  if (!current?.email || !current.providerData.some((provider) => provider.providerId === 'password')) {
    throw new Error('Reauthentication requires an email/password account. Sign in with email and password before deleting.')
  }
  if (!password) throw new Error('Enter your password to continue.')
  await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password))
}

export type IdentityDeletionResult =
  | { status: 'deleted' }
  | { status: 'identity-retained'; error: unknown }

/**
 * Run only AFTER the backend has deleted the user's MapMory data. Firebase is
 * a separate system: even after reauthentication its delete can still fail.
 * Preserve that failure as an explicit partial-completion result, and sign out
 * so the user is not silently taken to a newly recreated empty account.
 */
export async function deleteSignIn(): Promise<IdentityDeletionResult> {
  const current = firebaseAuth().currentUser
  if (!current) return { status: 'identity-retained', error: new Error('No signed-in Firebase user to delete.') }
  try {
    await deleteUser(current)
    return { status: 'deleted' }
  } catch (error) {
    await signOut(firebaseAuth())
    return { status: 'identity-retained', error }
  }
}
