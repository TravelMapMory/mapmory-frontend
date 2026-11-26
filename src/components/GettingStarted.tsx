import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { MeSummary, TripSummary } from '../api/types'
import './GettingStarted.css'

export function placesReviewedKey(accountId: string): string {
  return `mapmory.guide.places-reviewed.${accountId}`
}

function hasReviewedPlace(accountId: string): boolean {
  try {
    return localStorage.getItem(placesReviewedKey(accountId)) === '1'
  } catch {
    return false
  }
}

function dismissKey(accountId: string): string {
  return `mapmory.guide.hidden.${accountId}`
}

function readHidden(accountId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(accountId)) === '1'
  } catch {
    return false
  }
}

function writeHidden(accountId: string) {
  try {
    localStorage.setItem(dismissKey(accountId), '1')
  } catch {
    // Storage can be blocked; the guide then hides until the next reload.
  }
}

export interface GettingStartedProps {
  accountId: string
  trips: TripSummary[]
  summary: MeSummary | null
  onCreateTrip: () => void
  onUpload: () => void
  onOpenTrip?: (tripId: string) => void
}

/**
 * A first-run walkthrough of the main flow (design doc 2.2 use case 1): create
 * a trip, upload photos, check their places. Each step ticks itself off from
 * the owner's data; the guide disappears once all are done, or when hidden.
 */
export default function GettingStarted({ accountId, trips, summary, onCreateTrip, onUpload, onOpenTrip }: GettingStartedProps) {
  const [hidden, setHidden] = useState(() => readHidden(accountId))

  const photoCount = summary?.photo_count ?? trips.reduce((sum, trip) => sum + trip.photo_count, 0)
  // The trip aggregates identify missing GPS, not unconfirmed place suggestions.
  // Prefer a recently uploaded photo requiring review, then a trip missing GPS,
  // and finally a loaded trip when the summary reports older suggestions.
  const needsPlace = trips.find((trip) => trip.photo_count > trip.located_count)
  const toReview = summary?.to_review_count ?? (needsPlace ? 1 : 0)
  // The walkthrough requires one successful review, not the entire backlog.
  // Completion is recorded explicitly because preexisting confirmed labels do
  // not prove that this user has completed the onboarding step.
  const reviewedOnePlace = hasReviewedPlace(accountId)
  const suggestedTrip = summary?.recently_uploaded.find(
    (photo) => photo.state === 'needs-location' || photo.label_status === 'suggested',
  )?.trip_id
  const reviewTripId = suggestedTrip ?? needsPlace?.id ?? (toReview > 0 ? trips[0]?.id : undefined)
  const steps = [
    {
      done: trips.length > 0,
      title: 'Create a trip',
      text: 'A trip holds the photos of one journey, such as “Japan 2025”.',
      action: { label: 'Start a trip', run: onCreateTrip, enabled: true },
    },
    {
      done: photoCount > 0,
      title: 'Upload photos',
      text: 'MapMory reads where and when each photo was taken. Nothing is shared yet.',
      action: { label: 'Choose photos', run: onUpload, enabled: trips.length > 0 },
    },
    {
      done: photoCount > 0 && (reviewedOnePlace || toReview === 0),
      title: 'Check the places',
      text: toReview > 0
        ? 'Review or confirm the place of one photo to finish getting started. You can review the remaining photos later.'
        : 'Your uploaded photos have locations and no suggestions awaiting confirmation.',
      action: reviewTripId && onOpenTrip
        ? { label: 'Review places', run: () => onOpenTrip(reviewTripId), enabled: true }
        : null,
    },
  ]
  const completed = steps.filter((step) => step.done).length
  if (hidden || completed === steps.length) return null

  return (
    <section className="guide" aria-labelledby="guide-title">
      <div className="guide-head">
        <div>
          <h2 id="guide-title" className="guide-title">
            Getting started
          </h2>
          <p className="guide-progress">
            {completed} of {steps.length} done · then open a trip and choose Share when you are ready
          </p>
        </div>
        <button
          type="button"
          className="guide-hide"
          aria-label="Hide the getting started guide"
          onClick={() => {
            writeHidden(accountId)
            setHidden(true)
          }}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <ol className="guide-steps">
        {steps.map((step, index) => (
          <li key={step.title} className="guide-step" data-done={step.done}>
            <span className="guide-mark" aria-hidden>
              {step.done ? <Check size={14} /> : index + 1}
            </span>
            <div className="guide-text">
              <p className="guide-step-title">
                {step.title}
                <span className="visually-hidden">{step.done ? ' (done)' : ' (to do)'}</span>
              </p>
              <p className="guide-step-text">{step.text}</p>
            </div>
            {!step.done && step.action ? (
              <button
                type="button"
                className="btn btn-secondary guide-action"
                onClick={step.action.run}
                disabled={!step.action.enabled}
              >
                {step.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
