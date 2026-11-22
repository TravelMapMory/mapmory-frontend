/** Used only by the explicitly enabled Vite acceptance-test server. */
export type MockOperation =
  | 'summary' | 'listTrips' | 'createTrip' | 'getTrip' | 'updateTrip'
  | 'tripPhotos' | 'mapPhotos' | 'searchPlaces' | 'patchLocation'
  | 'listShares' | 'createShare' | 'revokeShare' | 'sharedCollection'
export interface AcceptanceOptions {
  scenario?: 'default' | 'empty' | 'empty-trip' | 'unlocated' | 'places' | 'long-content' | 'photo-states' | 'undated' | 'ordering'
  failures?: Partial<Record<MockOperation, number>>
  delayMs?: number
  /** Overrides the mock's page size for every list, so paging can be tested with the seed data. */
  pageSize?: number
}
