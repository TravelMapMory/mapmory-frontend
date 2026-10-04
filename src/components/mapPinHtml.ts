import './MapPin.css'

export interface MapPinOptions {
  /** Place shown in the chip beneath the photo, e.g. `Helsinki`. */
  place: string
  /** Thumbnail URL for the circle. */
  photo: string
  /** Number of photos; above 1 the pin is drawn as a cluster with a count badge. */
  count: number
  /** Accessible name of the marker, e.g. "3 photos near Rome". */
  label: string
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Markup for one map marker: a circular photo with a place chip, or, for a
 * cluster, a gold ring with a count badge and a dark name chip.
 *
 * It is an HTML string handed to a Leaflet `divIcon`, so the marker element
 * and its content are created together and can never disagree. The visible
 * pin is hidden from assistive technology; the hidden span gives the
 * focusable marker its name.
 */
export function mapPinHtml({ place, photo, count, label }: MapPinOptions): string {
  const isCluster = count > 1
  const name = escape(place)
  return `<span class="visually-hidden">${escape(label)}</span>
<div class="${isCluster ? 'mpin mpin--cluster' : 'mpin'}" aria-hidden="true">
  <div class="mpin-ring"><img class="mpin-photo" src="${escape(photo)}" alt="" /></div>
  ${
    isCluster
      ? `<span class="mpin-count">${count} photos</span><span class="mpin-label">${name}</span>`
      : `<span class="mpin-chip"><span class="mpin-dot"></span>${name}</span>`
  }
</div>`
}
