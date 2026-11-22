/*
 * What this browser remembers about files it registered with the backend, per
 * trip and client_file_id. A retry, or choosing the same file again after a
 * reload, reuses the registered photo instead of registering the file again,
 * so the backend never gets a duplicate (issues #21, #30, #31).
 */
import type { ApiUploadTarget } from './contract'

export interface Registration {
  batch_id: string
  photo_id: string
  file_name: string
  upload: ApiUploadTarget
  registered_at: string
  /** The backend reported a final state (ready, needs-location or failed). */
  finished: boolean
}

type Registrations = Record<string, Registration>

const KEY_PREFIX = 'mapmory.uploads.'
/** Unfinished uploads are offered for recovery this long. */
const OPEN_FOR_MS = 7 * 24 * 60 * 60 * 1000
/** Finished ones are kept a little, so choosing the same file again does not upload it twice. */
const FINISHED_FOR_MS = 24 * 60 * 60 * 1000

function key(tripId: string): string {
  return KEY_PREFIX + tripId
}

export function loadRegistrations(tripId: string): Registrations {
  let saved: Registrations
  try {
    saved = JSON.parse(localStorage.getItem(key(tripId)) ?? '{}') as Registrations
  } catch {
    return {}
  }
  const now = Date.now()
  const kept: Registrations = {}
  for (const [id, entry] of Object.entries(saved)) {
    const age = now - Date.parse(entry.registered_at)
    if (age < (entry.finished ? FINISHED_FOR_MS : OPEN_FOR_MS)) kept[id] = entry
  }
  return kept
}

export function saveRegistrations(tripId: string, registrations: Registrations): void {
  try {
    if (Object.keys(registrations).length === 0) localStorage.removeItem(key(tripId))
    else localStorage.setItem(key(tripId), JSON.stringify(registrations))
  } catch {
    // Storage full or disabled: uploads still work, only recovery is lost.
  }
}

export function updateRegistration(tripId: string, clientFileId: string, change: Partial<Registration> | null): void {
  const registrations = loadRegistrations(tripId)
  if (change === null) delete registrations[clientFileId]
  else if (registrations[clientFileId]) registrations[clientFileId] = { ...registrations[clientFileId], ...change }
  saveRegistrations(tripId, registrations)
}

export function addRegistration(tripId: string, clientFileId: string, registration: Registration): void {
  const registrations = loadRegistrations(tripId)
  registrations[clientFileId] = registration
  saveRegistrations(tripId, registrations)
}

export function hasOpenRegistrations(tripId: string): boolean {
  return Object.values(loadRegistrations(tripId)).some((entry) => !entry.finished)
}
