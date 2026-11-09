/** Used only by the explicitly enabled Vite acceptance-test server. */
export type MockOperation =
  | 'summary' | 'listTrips' | 'createTrip' | 'getTrip' | 'updateTrip'
  | 'tripPhotos' | 'mapPhotos' | 'searchPlaces' | 'patchLocation'
  | 'listShares' | 'createShare' | 'revokeShare' | 'sharedCollection'
  | 'publicMap' | 'publicShare'
export interface AcceptanceOptions {
  scenario?: 'default' | 'empty' | 'empty-trip' | 'unlocated' | 'places' | 'long-content' | 'photo-states' | 'undated' | 'ordering' | 'public-many'
  failures?: Partial<Record<MockOperation, number>>
  delayMs?: number
}
