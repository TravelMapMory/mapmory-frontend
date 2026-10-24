/*
 * Firebase Authentication (issue #8). Email and password go straight to
 * Firebase; the backend only ever sees the ID token (src/api/http.ts).
 * Without VITE_FIREBASE_API_KEY the app keeps the demo sign-in, so the mock
 * and the acceptance tests run without a Firebase project.
 */
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
} from 'firebase/auth'
import { setTokenProvider, setUnauthorizedHandler } from './api/http'

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
    const current = auth
    // A fresh token per request; the SDK caches it and renews it before expiry (issue #22).
    setTokenProvider(async (forceRefresh) => (current.currentUser ? current.currentUser.getIdToken(forceRefresh) : null))
    // The backend still refuses a refreshed token: the session is gone, so sign in again.
    setUnauthorizedHandler(() => void signOut(current))
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
