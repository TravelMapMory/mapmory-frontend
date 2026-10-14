/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Geoapify browser key for the Positron basemap; optional, see README. */
  readonly VITE_GEOAPIFY_KEY?: string
  /** Go backend, e.g. http://localhost:8080. Set: live endpoints call it; unset: all mock. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
