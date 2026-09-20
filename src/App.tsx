import { Icon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

/**
 * Leaflet resolves its default marker images relative to the stylesheet URL,
 * which Vite inlines — so the icons must be wired to bundled asset URLs or the
 * marker renders as a broken image.
 */
const markerIcon = new Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

/**
 * Helsinki city centre, used as the initial map view until real memory pins
 * (whose coordinates come from photo EXIF data) are loaded from the backend.
 */
const HELSINKI: [number, number] = [60.1699, 24.9384]

/**
 * Root screen of UniMap: a full-viewport OpenStreetMap-tiled Leaflet map.
 *
 * This is the skeleton of the map-based main UI. It renders one hard-coded
 * placeholder pin so the map, tiles, markers and popups are all provably
 * working before any backend, search or grouping features are built on top.
 *
 * The height must come from the `map` class rather than Leaflet's own
 * `leaflet-container` class: Leaflet adds that class while initialising and
 * measures the element first, so it would read a zero height and lay out the
 * tiles for a zero-size viewport.
 */
export default function App() {
  return (
    <MapContainer className="map" center={HELSINKI} zoom={12}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={HELSINKI} icon={markerIcon}>
        <Popup>Placeholder memory pin</Popup>
      </Marker>
    </MapContainer>
  )
}
