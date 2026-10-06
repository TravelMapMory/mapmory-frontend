/** Temporary place identity until the API provides normalized place IDs. */
export function placeKey(place: { country: string | null; city: string | null }): string | null {
  return place.city === null ? null : JSON.stringify([place.country, place.city])
}
