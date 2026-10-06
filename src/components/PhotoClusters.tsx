import { divIcon, latLngBounds, type LeafletKeyboardEvent, type Map as LeafletMap } from 'leaflet'
import { Marker, useMap, useMapEvents } from 'react-leaflet'
import { useCallback, useMemo, useState } from 'react'
import type { MapPhoto } from '../api/types'
import { mapPinHtml } from './mapPinHtml'
import placeholder from '../assets/photo-placeholder.svg'

/** Pins whose centres are closer than this many screen pixels merge into one cluster. */
const RADIUS_PX = 88
/** Zooming into a cluster never goes past street level. */
const MAX_FIT_ZOOM = 16

export interface PhotoCluster {
  key: string
  lat: number
  lng: number
  /** In capture order; the first one is the cluster's face. */
  photos: MapPhoto[]
}

/**
 * Greedy screen-space clustering, the same idea as Leaflet.markercluster:
 * each photo joins the first cluster whose seed is within RADIUS_PX at the
 * current zoom, otherwise it seeds a new one. The server caps a response at
 * 2,000 markers, so the O(photos × clusters) loop stays cheap.
 */
export function clusterPhotos(map: LeafletMap, photos: MapPhoto[], zoom: number): PhotoCluster[] {
  const seeds: { x: number; y: number; photos: MapPhoto[] }[] = []
  for (const photo of photos) {
    const point = map.project([photo.lat, photo.lng], zoom)
    const home = seeds.find((s) => (s.x - point.x) ** 2 + (s.y - point.y) ** 2 < RADIUS_PX ** 2)
    if (home) home.photos.push(photo)
    else seeds.push({ x: point.x, y: point.y, photos: [photo] })
  }
  return seeds.map((seed) => ({
    // Every member id, so a marker is only reused for exactly the same photos.
    key: seed.photos.map((p) => p.id).join('|'),
    lat: seed.photos.reduce((sum, p) => sum + p.lat, 0) / seed.photos.length,
    lng: seed.photos.reduce((sum, p) => sum + p.lng, 0) / seed.photos.length,
    photos: seed.photos,
  }))
}

/**
 * The place a pin is named after: the most common city among its photos
 * (country when a photo has no city), plus how many other places it covers,
 * e.g. "Rome" or "Paris +1".
 */
function placeLabel(cluster: PhotoCluster): string {
  const counts = new Map<string, number>()
  for (const p of cluster.photos) {
    const place = p.city ?? p.country
    if (place) counts.set(place, (counts.get(place) ?? 0) + 1)
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) return 'Unnamed place'
  return ranked.length === 1 ? ranked[0][0] : `${ranked[0][0]} +${ranked.length - 1}`
}

function ClusterMarker({ cluster, onActivate }: { cluster: PhotoCluster; onActivate: (c: PhotoCluster) => void }) {
  const count = cluster.photos.length
  const place = placeLabel(cluster)
  const label = count > 1 ? `${count} photos near ${place}` : `Photo at ${cluster.photos[0].place_name ?? place}`
  const photo = cluster.photos.find((p) => p.thumb_url)?.thumb_url ?? placeholder

  // Same geometry as the original pin design: the anchor is the centre of the photo ring.
  const icon = useMemo(
    () =>
      divIcon({
        className: 'map-pin-icon',
        html: mapPinHtml({ place, photo, count, label }),
        iconSize: count > 1 ? [68, 98] : [69, 84],
        iconAnchor: count > 1 ? [34, 34] : [34.5, 28],
      }),
    [place, photo, count, label],
  )

  // Leaflet makes the marker a focusable role="button" but only clicks
  // activate it, so Enter and Space are handled here.
  const eventHandlers = useMemo(
    () => ({
      click: () => onActivate(cluster),
      keydown: (event: LeafletKeyboardEvent) => {
        const key = event.originalEvent.key
        if (key !== 'Enter' && key !== ' ') return
        event.originalEvent.preventDefault()
        onActivate(cluster)
      },
    }),
    [cluster, onActivate],
  )

  return <Marker position={[cluster.lat, cluster.lng]} icon={icon} title={label} eventHandlers={eventHandlers} />
}

export interface PhotoClustersProps {
  photos: MapPhoto[]
  /** A single photo, or a cluster that cannot be split by zooming further. */
  onSelect: (photos: MapPhoto[]) => void
}

/**
 * The owner's located photos as clustered pins. Activating a cluster zooms
 * in to split it; when zooming would not separate it any further (several
 * photos taken in the same spot), the photos open in the panel instead.
 */
export default function PhotoClusters({ photos, onSelect }: PhotoClustersProps) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  const clusters = useMemo(() => clusterPhotos(map, photos, zoom), [map, photos, zoom])

  const activate = useCallback(
    (cluster: PhotoCluster) => {
      const spots = new Set(cluster.photos.map((p) => `${p.lat},${p.lng}`))
      if (spots.size > 1) {
        const bounds = latLngBounds(cluster.photos.map((p) => [p.lat, p.lng]))
        const target = Math.min(map.getBoundsZoom(bounds.pad(0.2)), MAX_FIT_ZOOM)
        if (target > map.getZoom()) {
          map.flyToBounds(bounds, { padding: [80, 80], maxZoom: MAX_FIT_ZOOM, duration: 0.6 })
          return
        }
      }
      onSelect(cluster.photos)
    },
    [map, onSelect],
  )

  return (
    <>
      {clusters.map((cluster) => (
        <ClusterMarker key={cluster.key} cluster={cluster} onActivate={activate} />
      ))}
    </>
  )
}
