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
 * a trip, upload photos, check their places, drawn as a boarding pass. The stub
 * shows progress, the route shows the three steps, and only the current step
 * gets its explanation and button. Each step ticks itself off from the owner's
 * data. Once all are done the ticket is stamped "Ready to share" and points to
 * sharing; it stays until the owner closes it with Done, so finishing is seen
 * rather than the guide silently vanishing. Hiding it at any step is remembered.
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
      short: 'Trip',
      text: 'A trip holds the photos of one journey, such as “Japan 2025”.',
      action: { label: 'Start a trip', run: onCreateTrip, enabled: true },
    },
    {
      done: photoCount > 0,
      title: 'Upload photos',
      short: 'Photos',
      text: 'MapMory reads where and when each photo was taken. Nothing is shared yet.',
      action: { label: 'Choose photos', run: onUpload, enabled: trips.length > 0 },
    },
    {
      done: photoCount > 0 && (reviewedOnePlace || toReview === 0),
      title: 'Check the places',
      short: 'Places',
      text: toReview > 0
        ? 'Confirm where one photo was taken to finish. The rest can wait.'
        : 'Your uploaded photos have locations and no suggestions awaiting confirmation.',
      action: reviewTripId && onOpenTrip
        ? { label: 'Review places', run: () => onOpenTrip(reviewTripId), enabled: true }
        : null,
    },
  ]
  if (hidden) return null

  const completed = steps.filter((step) => step.done).length
  const finished = completed === steps.length
  const current = steps.find((step) => !step.done) ?? steps[steps.length - 1]
  const hide = () => {
    writeHidden(accountId)
    setHidden(true)
  }

  return (
    <section className="guide" aria-labelledby="guide-title">
      <div className="guide-stub">
        <h2 id="guide-title" className="guide-stub-label">
          Getting started
        </h2>
        <p className="guide-stub-count">
          <b aria-hidden>
            {completed}/{steps.length}
          </b>
          <span aria-hidden>done</span>
          <span className="visually-hidden">
            {completed} of {steps.length} done
          </span>
        </p>
      </div>

      <div className="guide-main">
        <ol className="guide-route">
          {steps.map((step) => {
            const state = step.done ? 'done' : step === current ? 'now' : 'next'
            return (
              <li key={step.title} className="guide-stop" data-state={state}>
                {step.done ? <Check size={13} strokeWidth={3} aria-hidden /> : null}
                <span aria-hidden>{step.short}</span>
                <span className="visually-hidden">
                  {step.title} ({state === 'done' ? 'done' : state === 'now' ? 'current step' : 'to do'})
                </span>
              </li>
            )
          })}
        </ol>
        <div className="guide-now">
          <h3 className="guide-now-title">{finished ? 'You’re all set' : current.title}</h3>
          <p className="guide-now-text">
            {finished
              ? 'Your photos are on your map. To show a trip to family or friends, open it and choose Share.'
              : current.text}
          </p>
        </div>
        {finished ? (
          <button type="button" className="btn btn-action guide-action" onClick={hide}>
            Done
          </button>
        ) : current.action ? (
          <button
            type="button"
            className="btn btn-action guide-action"
            onClick={current.action.run}
            disabled={!current.action.enabled}
          >
            {current.action.label}
          </button>
        ) : null}
      </div>

      {finished ? (
        <span className="guide-stamp" aria-hidden>
          Ready to share
        </span>
      ) : (
        <button type="button" className="guide-hide" aria-label="Hide the getting started guide" onClick={hide}>
          <X size={16} aria-hidden />
        </button>
      )}
    </section>
  )
}
