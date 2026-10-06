import { divIcon, type LeafletMouseEvent, type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { useMemo, useState } from 'react'
import { Copy, MapPin } from 'lucide-react'
import PlaceSearch from './PlaceSearch'
import { TILES } from '../mapTiles'
import './LocationPicker.css'

export interface LatLng {
  lat: number
  lng: number
}

export interface LocationPickerProps {
  /** Where the pin starts: the photo's current location, if it has one. */
  initial: LatLng | null
  /** The previous photo in the trip that has a location, for "Same place as previous photo". */
  previous: (LatLng & { label: string }) | null
  saving: boolean
  onSave: (position: LatLng) => void
}

const PIN = divIcon({
  className: 'lpick-pin',
  html: '<span class="lpick-pin-dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const WORLD: LatLng = { lat: 30, lng: 10 }

function ClickToPlace({ onPlace }: { onPlace: (position: LatLng) => void }) {
  useMapEvents({ click: (event: LeafletMouseEvent) => onPlace({ lat: event.latlng.lat, lng: event.latlng.lng }) })
  return null
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

/**
 * The correction dialog's place picker (doc 2.2 case 2, 4.1): search for a
 * place anywhere in the world, click the map to drop a pin, drag the pin to
 * fine-tune it, or reuse the previous photo's location. Search and "same
 * place" make it fully usable without a mouse.
 */
export default function LocationPicker({ initial, previous, saving, onSave }: LocationPickerProps) {
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [pin, setPin] = useState<LatLng | null>(initial)
  const [source, setSource] = useState<string | null>(initial ? 'Current location' : null)

  function place(position: LatLng, label: string, zoom?: number) {
    const next = { lat: round(position.lat), lng: round(position.lng) }
    setPin(next)
    setSource(label)
    if (map) {
      if (zoom !== undefined) map.flyTo([next.lat, next.lng], zoom, { duration: 0.6 })
      else map.panTo([next.lat, next.lng])
    }
  }

  const dragHandlers = useMemo(
    () => ({
      dragend: (event: { target: LeafletMarker }) => {
        const at = event.target.getLatLng()
        setPin({ lat: round(at.lat), lng: round(at.lng) })
        setSource('Pin moved on the map')
      },
    }),
    [],
  )

  const start = initial ?? previous ?? WORLD

  return (
    <div className="lpick">
      <PlaceSearch
        label="Search for the place"
        placeholder="City or country"
        showLabel
        autoFocus
        onSelect={(found) => place(found, found.label, found.kind === 'country' ? 5 : 12)}
      />
      {previous ? (
        <button
          type="button"
          className="btn btn-secondary lpick-previous"
          onClick={() => place(previous, `Same place as previous photo (${previous.label})`, 13)}
        >
          <Copy size={14} aria-hidden />
          Same place as previous photo
        </button>
      ) : null}

      <div className="lpick-map-wrap">
        <p className="lpick-hint" id="lpick-hint">
          <MapPin size={14} aria-hidden />
          Or click the map to drop a pin, then drag it to fine-tune.
        </p>
        <MapContainer
          ref={setMap}
          className={TILES.desaturate ? 'lpick-map lpick-map--grey' : 'lpick-map'}
          center={[start.lat, start.lng]}
          zoom={initial || previous ? 12 : 2}
          worldCopyJump
          zoomAnimation={false}
        >
          <TileLayer url={TILES.url} attribution={TILES.attribution} />
          <ClickToPlace onPlace={(position) => place(position, 'Pin dropped on the map')} />
          {pin ? <Marker position={[pin.lat, pin.lng]} icon={PIN} draggable eventHandlers={dragHandlers} /> : null}
        </MapContainer>
      </div>

      <p className="lpick-chosen" role="status">
        {pin ? (
          <>
            <strong>{source}</strong> · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </>
        ) : (
          'No location chosen yet.'
        )}
      </p>
      <div>
        <button type="button" className="btn btn-primary" disabled={!pin || saving} onClick={() => pin && onSave(pin)}>
          {saving ? 'Saving…' : 'Save location'}
        </button>
      </div>
    </div>
  )
}
