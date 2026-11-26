import { expect, test } from '@playwright/test'
import { ApiError } from '../../src/api/http'
import { deletePhotoError, photoAlreadyGone } from '../../src/photoDeletion'

// Frontend #59: what the owner reads when deleting a photo fails.
test('a busy photo is explained; any other failure says the photo was kept', () => {
  expect(deletePhotoError(new ApiError(409, 'photo_busy', 'busy'))).toBe(
    'This photo is still uploading or processing. Try again in a few minutes.',
  )
  for (const error of [new ApiError(503, 'storage_unavailable', 'x'), new ApiError(500, 'internal_error', 'x'), new TypeError('Failed to fetch')]) {
    expect(deletePhotoError(error)).toBe('The photo could not be deleted, so it is still in your trip. Try again.')
  }
})

test('a photo that is already gone counts as deleted, nothing else does', () => {
  const notFound = new Error('Photo not found')
  notFound.name = 'NotFoundError'
  expect(photoAlreadyGone(new ApiError(404, 'not_found', 'photo not found'))).toBe(true)
  expect(photoAlreadyGone(notFound)).toBe(true)
  expect(photoAlreadyGone(new ApiError(409, 'photo_busy', 'busy'))).toBe(false)
  expect(photoAlreadyGone(new ApiError(503, 'storage_unavailable', 'x'))).toBe(false)
})
