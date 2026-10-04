/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Geoapify browser key for the Positron basemap; optional, see README. */
  readonly VITE_GEOAPIFY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
