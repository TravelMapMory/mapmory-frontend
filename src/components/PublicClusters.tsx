import { divIcon, type LeafletKeyboardEvent } from 'leaflet'
import { Marker } from 'react-leaflet'
import { useMemo } from 'react'
import type { PublicCluster } from '../api/types'
import { mapPinHtml } from './mapPinHtml'
import placeholder from '../assets/photo-placeholder.svg'

function PublicClusterMarker({ cluster, onActivate }: { cluster: PublicCluster; onActivate: (c: PublicCluster) => void }) {
  const place = cluster.label ?? 'Unnamed place'
  const label = cluster.count > 1 ? `${cluster.count} public photos near ${place}` : `Public photo in ${place}`
  const photo = cluster.cover_url ?? placeholder

  // Same geometry as the owner's pins (PhotoClusters): the anchor is the centre of the photo ring.
  const icon = useMemo(
    () =>
      divIcon({
        className: 'map-pin-icon',
        html: mapPinHtml({ place, photo, count: cluster.count, label }),
        iconSize: cluster.count > 1 ? [68, 98] : [69, 84],
        iconAnchor: cluster.count > 1 ? [34, 34] : [34.5, 28],
      }),
    [place, photo, cluster.count, label],
  )

  // Leaflet only activates markers on click, so Enter and Space are handled here.
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

export interface PublicClustersProps {
  /** Already grouped by the server; the browser draws them as they are. */
  clusters: PublicCluster[]
  onActivate: (cluster: PublicCluster) => void
}

/**
 * The public map's markers. Unlike the owner's map, the browser does no
 * clustering of its own: `GET /api/public/map` returns at most 200 grid
 * cells, and each one becomes a pin.
 */
export default function PublicClusters({ clusters, onActivate }: PublicClustersProps) {
  return (
    <>
      {clusters.map((cluster) => (
        <PublicClusterMarker key={cluster.id} cluster={cluster} onActivate={onActivate} />
      ))}
    </>
  )
}
