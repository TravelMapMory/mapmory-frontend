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
 * Stand-in pins and cards so the layout can be judged with content in it.
 * Every value here is fabricated placeholder copy — the real rows will come
 * from the backend once photo import and EXIF extraction exist.
 */
const PLACEHOLDER_MEMORIES = [
  { id: 'hki', title: 'Helsinki', when: 'Aug 2026 · 24 photos', at: HELSINKI },
  { id: 'tll', title: 'Tallinn', when: 'Jul 2026 · 11 photos', at: [59.437, 24.7536] as [number, number] },
  { id: 'sto', title: 'Stockholm', when: 'Jun 2026 · 38 photos', at: [59.3293, 18.0686] as [number, number] },
]

/**
 * Fabricated counters standing in for the mock-up's stat row. The third tile
 * carries the accent border the design uses to highlight one figure.
 */
const PLACEHOLDER_STATS = [
  { label: 'Cities', value: '12', accent: false },
  { label: 'Countries', value: '5', accent: false },
  { label: 'Longest trip', value: '14 Days', accent: true },
  { label: 'Photos', value: '73', accent: false },
]

/**
 * The map-first main screen: an OpenStreetMap-tiled Leaflet map with a list of
 * memory cards beside it and a row of counters underneath, mirroring the two
 * "Header" frames in the Figma mock-up.
 *
 * The height must come from the `map` class rather than Leaflet's own
 * `leaflet-container` class: Leaflet adds that class while initialising and
 * measures the element first, so it would read a zero height and lay out the
 * tiles for a zero-size viewport.
 */
export default function MapScreen() {
  return (
    <>
      <div className="map-row">
        <div className="card">
          <MapContainer className="map" center={HELSINKI} zoom={5}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {PLACEHOLDER_MEMORIES.map((memory) => (
              <Marker key={memory.id} position={memory.at} icon={markerIcon}>
                <Popup>{memory.title}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="sidebar">
          {PLACEHOLDER_MEMORIES.map((memory) => (
            <article className="card memory" key={memory.id}>
              <div className="photo">photo</div>
              <div className="memory-body">
                <h3>{memory.title}</h3>
                <p>{memory.when}</p>
              </div>
            </article>
          ))}
        </aside>
      </div>

      <div className="stats">
        {PLACEHOLDER_STATS.map((stat) => (
          <div className="card stat" key={stat.label} data-accent={stat.accent}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}
