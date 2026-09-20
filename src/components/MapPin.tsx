import './MapPin.css'

/**
 * Props for a single map marker.
 *
 * `countLabel` is the cluster switch: only a cluster carries a photo count, so
 * its presence decides which of the two looks is rendered. Using the label
 * itself rather than a separate `isCluster` flag means the two can never
 * disagree, and a cluster can never render without its count.
 */
export interface MapPinProps {
  /** City name shown in the chip beneath the photo, e.g. `Helsinki`. */
  city: string
  /**
   * Thumbnail URL for the circle. This is per-memory data rather than a design
   * asset, so it stays dynamic and is never bundled.
   */
  photo: string
  /**
   * Cluster copy exactly as the design words it, e.g. `50+ Photos` (the
   * stylesheet upper-cases it). Omit for a single-city pin.
   */
  countLabel?: string
}

/**
 * A marker for the memory map: a circular photo in a coloured ring with a name
 * chip below it, or — when `countLabel` is given — the cluster variant, whose
 * ring turns gold and which gains an amber count badge above a dark name chip.
 *
 * Deliberately positioning-agnostic. It lays out its own internals in normal
 * flow and never sets `position`/`top`/`left`, so the caller is free to place
 * it with a Leaflet `divIcon`, an absolutely positioned wrapper, or anything
 * else. The geographic anchor is the centre of the ring: horizontally the
 * middle of the rendered box, vertically `--mpin-ring / 2` from its top edge.
 */
export default function MapPin({ city, photo, countLabel }: MapPinProps) {
  const isCluster = countLabel !== undefined

  return (
    <div className={isCluster ? 'mpin mpin--cluster' : 'mpin'}>
      <div className="mpin-ring">
        <img className="mpin-photo" src={photo} alt={city} />
      </div>

      {isCluster ? (
        <>
          <span className="mpin-count">{countLabel}</span>
          <span className="mpin-label">{city}</span>
        </>
      ) : (
        <span className="mpin-chip">
          <span className="mpin-dot" />
          {city}
        </span>
      )}
    </div>
  )
}
