/** Used only by the explicitly enabled Vite acceptance-test server. */
export type MockOperation = 'summary' | 'listTrips' | 'createTrip' | 'getTrip' | 'tripPhotos' | 'mapPhotos' | 'searchPlaces' | 'patchLocation'
export interface AcceptanceOptions {
  scenario?: 'default' | 'empty' | 'empty-trip' | 'unlocated' | 'places' | 'long-content' | 'photo-states' | 'undated'
  failures?: Partial<Record<MockOperation, number>>
  delayMs?: number
}
