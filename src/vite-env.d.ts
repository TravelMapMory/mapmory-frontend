/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Geoapify browser key for the Positron basemap; optional, see README. */
  readonly VITE_GEOAPIFY_KEY?: string
  /** Go backend, e.g. http://localhost:8080. Set: live endpoints call it; unset: all mock. */
  readonly VITE_API_URL?: string
  /** Firebase web app config (project mapmory-development). Unset: the demo sign-in. */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
