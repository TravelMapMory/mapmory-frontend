/**
 * Where the viewer's photo sits in the list it pages through (frontend #19).
 * The viewer follows a photo id, not an array index, so new pages, reorders
 * and refreshes keep it on the same photo. If the photo has left the list
 * (deleted, or no longer viewable), `missing` is true and the viewer says so
 * instead of silently showing whichever photo took its place.
 */
export function viewerPosition(photos: readonly { id: string }[], id: string) {
  const index = photos.findIndex((p) => p.id === id)
  return {
    index,
    missing: index < 0,
    hasPrev: index > 0,
    hasNext: index >= 0 && index < photos.length - 1,
  }
}
