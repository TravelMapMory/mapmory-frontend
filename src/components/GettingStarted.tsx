import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { MeSummary, TripSummary } from '../api/types'
import './GettingStarted.css'

const DISMISS_KEY = 'mapmory.guide.hidden'

function readHidden(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function writeHidden() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Storage can be blocked; the guide then hides until the next reload.
  }
}

export interface GettingStartedProps {
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
export default function GettingStarted({ trips, summary, onCreateTrip, onUpload, onOpenTrip }: GettingStartedProps) {
  const [hidden, setHidden] = useState(readHidden)

  const photoCount = summary?.photo_count ?? trips.reduce((sum, trip) => sum + trip.photo_count, 0)
  const needsPlace = trips.find((trip) => trip.photo_count > trip.located_count)
  const toReview = summary?.to_review_count ?? (needsPlace ? 1 : 0)
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
      done: photoCount > 0 && toReview === 0,
      title: 'Check the places',
      text: 'Photos without a location, or with a suggested place, wait for you on their trip page.',
      action:
        needsPlace && onOpenTrip
          ? { label: 'Review places', run: () => onOpenTrip(needsPlace.id), enabled: true }
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
            writeHidden()
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
