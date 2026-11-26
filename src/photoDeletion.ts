import { ApiError } from './api/http'

/** What to tell the owner when a photo could not be deleted (frontend #59). */
export function deletePhotoError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'photo_busy') {
    return 'This photo is still uploading or processing. Try again in a few minutes.'
  }
  return 'The photo could not be deleted, so it is still in your trip. Try again.'
}

/** A 404 means the photo is already gone (another tab or device): the outcome the owner asked for. */
export function photoAlreadyGone(error: unknown): boolean {
  return (error instanceof ApiError && error.status === 404) || (error instanceof Error && error.name === 'NotFoundError')
}
