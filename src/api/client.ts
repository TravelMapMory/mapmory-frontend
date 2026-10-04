/*
 * The only module screens import for data. Each function names the endpoint it
 * stands for (doc 5.2); when the backend serves it, replace the mock call with
 * a fetch carrying the Firebase ID token, and nothing above this file changes.
 */
import { mockCreateTrip, mockListTrips, mockSummary } from './mock'
import type { CreateTripInput, MeSummary, Page, TripSummary } from './types'

/** GET /api/me/summary */
export function getSummary(): Promise<MeSummary> {
  return mockSummary()
}

/** GET /api/trips */
export function listTrips(): Promise<Page<TripSummary>> {
  return mockListTrips()
}

/** POST /api/trips */
export function createTrip(input: CreateTripInput): Promise<TripSummary> {
  return mockCreateTrip(input)
}
