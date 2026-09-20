import { divIcon, type LeafletEvent } from 'leaflet'
import { createPortal } from 'react-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { useCallback, useMemo, useState } from 'react'
import Search, { SEARCH_RESULTS, type SearchResult } from './components/Search'
import MapPin from './components/MapPin'
import DetailDrawer, { featuredMemory } from './components/DetailDrawer'
import MobileDrawer, { MOBILE_DRAWER_EXAMPLE } from './components/MobileDrawer'
import { useMediaQuery } from './useMediaQuery'
import helsinkiPhoto from './assets/pins/helsinki.jpg'
import londonPhoto from './assets/pins/london.jpg'
import berlinPhoto from './assets/pins/berlin.jpg'
import romePhoto from './assets/pins/rome.jpg'
import parisPhoto from './assets/pins/paris.jpg'
import './MapScreen.css'

/**
 * A memory pinned to a place on the map. Coordinates are hard-coded for now:
 * the real ones will come from photo EXIF once the backend extracts it.
 */
interface PinnedMemory {
  id: string
  city: string
  at: [number, number]
  photo: string
  countLabel?: string
}

/**
 * The five markers the design places on Europe, including Paris as the one
 * cluster. Coordinates are the real city centres. The photographs stand in for
 * the design's own, which Figma never exported — see CREDITS.md for each one's
 * author and licence.
 */
const PINNED: PinnedMemory[] = [
  { id: 'paris', city: 'Paris', at: [48.8566, 2.3522], photo: parisPhoto, countLabel: '50+ Photos' },
  { id: 'london', city: 'London', at: [51.5072, -0.1276], photo: londonPhoto },
  { id: 'berlin', city: 'Berlin', at: [52.52, 13.405], photo: berlinPhoto },
  { id: 'rome', city: 'Rome', at: [41.9028, 12.4964], photo: romePhoto },
  { id: 'helsinki', city: 'Helsinki', at: [60.1699, 24.9384], photo: helsinkiPhoto },
]

/**
 * Europe, framed so all five markers are visible the way the design shows them.
 */
const EUROPE_CENTRE: [number, number] = [50.5, 10]

/**
 * Places one MapPin on the map.
 *
 * Leaflet owns the marker element, so the pin is portalled into it rather than
 * rendered to an HTML string. Serialising it instead would drag `react-dom/server`
 * into the browser bundle, which measured at +226 kB raw / +62 kB gzip — far too
 * much for five markers.
 *
 * The host element is taken from Leaflet's `add` event rather than from a ref:
 * when React hands over the marker instance its element does not exist yet, so a
 * ref yields null and the portal never mounts.
 *
 * The anchor is the horizontal centre of the photo circle, 30px down, which is
 * the point the design aligns to the coordinate.
 */
function PinMarker({ memory }: { memory: PinnedMemory }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const width = memory.countLabel ? 68 : 69
  const height = memory.countLabel ? 98 : 84

  const icon = useMemo(
    () => divIcon({ className: 'map-pin-icon', html: '', iconSize: [width, height], iconAnchor: [width / 2, 30] }),
    [width, height],
  )

  const attach = useCallback((event: LeafletEvent) => {
    const element = (event.target as { getElement?: () => HTMLElement | undefined }).getElement?.() ?? null
    setHost((current) => (current === element ? current : element))
  }, [])

  return (
    <>
      <Marker position={memory.at} icon={icon} eventHandlers={{ add: attach }} />
      {host
        ? createPortal(
            <MapPin city={memory.city} photo={memory.photo} countLabel={memory.countLabel} />,
            host,
          )
        : null}
    </>
  )
}

/**
 * The map screen: a grey, label-free basemap under the design's search control
 * and memory markers, with the memory drawer docked on the right.
 *
 * The design draws a flat, pale grey landmass, so the OpenStreetMap tiles are
 * desaturated in CSS instead of being swapped for a ready-made grey basemap:
 * CARTO's `light_nolabels` looks right but serves an "API KEY REQUIRED"
 * watermark tile without a key, and Stadia's toner-lite answers 401. A static
 * picture of a map would match the mock-up even more closely but would throw
 * away panning and zooming, which the product needs.
 */
export default function MapScreen() {
  const [query, setQuery] = useState('Paris, France')
  const [selectedId, setSelectedId] = useState<string | null>(SEARCH_RESULTS[0]?.id ?? null)
  const [activePhoto, setActivePhoto] = useState(0)
  const isNarrow = useMediaQuery('(max-width: 900px)')

  const noop = () => undefined

  return (
    <div className="mapscreen">
      <div className="mapscreen-map">
        <MapContainer className="mapscreen-canvas" center={EUROPE_CENTRE} zoom={4} zoomControl={false}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {PINNED.map((memory) => (
            <PinMarker key={memory.id} memory={memory} />
          ))}
        </MapContainer>

        <div className="mapscreen-search">
          <Search
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            results={SEARCH_RESULTS}
            selectedId={selectedId}
            onSelect={(result: SearchResult) => setSelectedId(result.id)}
          />
        </div>
      </div>

      <aside className="mapscreen-drawer">
        {isNarrow ? (
          <MobileDrawer
            {...MOBILE_DRAWER_EXAMPLE}
            onLike={noop}
            onShare={noop}
            onOpen={noop}
            onSelectPhoto={setActivePhoto}
            onUpload={noop}
            onOpenPreferences={noop}
            onAddPerson={noop}
          />
        ) : (
          <DetailDrawer
            memory={featuredMemory}
            activePhoto={activePhoto}
            onSelectPhoto={setActivePhoto}
            onFavorite={noop}
            onShare={noop}
            onExpand={noop}
            onUpload={noop}
            onOpenPreferences={noop}
            onAddPerson={noop}
          />
        )}
      </aside>
    </div>
  )
}
