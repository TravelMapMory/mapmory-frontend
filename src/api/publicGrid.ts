/*
 * Server-side grouping for `GET /api/public/map` (doc 5.2), written once so
 * the mock answers exactly as the Go backend should:
 *
 *   1. Only photos of public, unrevoked, unreported shares are input, each at
 *      its coarse display position (doc 5.4).
 *   2. Photos outside the bbox are dropped.
 *   3. The rest fall into square cells of CELL_PX screen pixels at the
 *      requested zoom (Web Mercator, like the map tiles), so cells look the
 *      same size at every latitude.
 *   4. The PUBLIC_CLUSTER_LIMIT fullest cells are returned, largest first.
 *
 * It has no browser or asset imports, so it also runs in the unit checks.
 */
import { PUBLIC_CLUSTER_LIMIT } from './limits'
import type { BBox, PublicCluster, PublicMapPage, PublicMapQuery, PublicShareRef } from './types'

/** Side of one grid cell in screen pixels. A typical laptop map is about 15 × 12 cells. */
export const CELL_PX = 64
/** A cluster names at most this many shares; `share_count` has the total. */
export const MAX_SHARES_PER_CLUSTER = 5
const TILE_PX = 256
/** Web Mercator stops here; the map cannot show the poles. */
const MAX_LAT = 85.05112878
const MAX_ZOOM = 22

/** One public photo as the grouping sees it. */
export interface PublicPoint {
  photo_id: string
  share_id: string
  share_title: string
  thumb_url: string | null
  /** Coarse position: city centre, or rounded to 0.01°. Never the exact one. */
  lat: number
  lng: number
  city: string | null
  country: string | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/**
 * Leaflet reports longitudes past ±180 after the map wraps around the world.
 * This brings them back to [-180, 180]; a box that then crosses the
 * antimeridian keeps west > east, and a box wider than the world covers it.
 */
export function normalizeBBox([west, south, east, north]: BBox): BBox {
  const s = clamp(Math.min(south, north), -90, 90)
  const n = clamp(Math.max(south, north), -90, 90)
  if (east - west >= 360) return [-180, s, 180, n]
  const w = wrapLng(west)
  let e = wrapLng(east)
  // 180 wraps to -180; keep the eastern edge of a box that ends there.
  if (e === -180 && east > west) e = 180
  return [w, s, e, n]
}

export function inBBox(lat: number, lng: number, [west, south, east, north]: BBox): boolean {
  if (lat < south || lat > north) return false
  return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east
}

/**
 * The position shared and public views may show (doc 5.4): the centre of the
 * photo's city when it has one, otherwise the exact position rounded to a
 * 0.01° grid, about 1 km.
 */
export function coarsePosition(lat: number, lng: number, cityCentre: { lat: number; lng: number } | null) {
  if (cityCentre) return { lat: cityCentre.lat, lng: cityCentre.lng }
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
}

/** Pixel position on the whole-world map at `zoom`, as Leaflet's EPSG:3857 projection computes it. */
function worldPixel(lat: number, lng: number, zoom: number) {
  const size = TILE_PX * 2 ** zoom
  const sin = Math.sin((clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  }
}

/** The most common value, ties broken alphabetically so the label does not flicker between requests. */
function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value
      bestCount = count
    }
  }
  return best
}

function toCluster(id: string, points: PublicPoint[]): PublicCluster {
  // A photo in two public shares is one photo on the map, but both shares are listed.
  const photos = new Map<string, PublicPoint>()
  for (const p of points) if (!photos.has(p.photo_id)) photos.set(p.photo_id, p)
  const unique = [...photos.values()]

  const shares = new Map<string, PublicShareRef & { photos: Set<string> }>()
  for (const p of points) {
    const ref = shares.get(p.share_id) ?? { id: p.share_id, title: p.share_title, cover_url: p.thumb_url, photo_count: 0, photos: new Set() }
    ref.cover_url ??= p.thumb_url
    ref.photos.add(p.photo_id)
    ref.photo_count = ref.photos.size
    shares.set(p.share_id, ref)
  }
  const ranked = [...shares.values()]
    .sort((a, b) => b.photo_count - a.photo_count || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map(({ id: shareId, title, cover_url, photo_count }) => ({ id: shareId, title, cover_url, photo_count }))

  const lats = unique.map((p) => p.lat)
  const lngs = unique.map((p) => p.lng)
  return {
    id,
    lat: lats.reduce((a, b) => a + b, 0) / unique.length,
    lng: lngs.reduce((a, b) => a + b, 0) / unique.length,
    count: unique.length,
    label: mostCommon(unique.map((p) => p.city)) ?? mostCommon(unique.map((p) => p.country)),
    cover_url: unique.find((p) => p.thumb_url)?.thumb_url ?? null,
    bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
    share_count: ranked.length,
    shares: ranked.slice(0, MAX_SHARES_PER_CLUSTER),
  }
}

/** Groups public photos for one `GET /api/public/map` request. */
export function clusterPublicPoints(points: PublicPoint[], query: PublicMapQuery, limit = PUBLIC_CLUSTER_LIMIT): PublicMapPage {
  const zoom = clamp(Math.round(query.zoom), 0, MAX_ZOOM)
  const bbox = normalizeBBox(query.bbox)
  const cells = new Map<string, PublicPoint[]>()
  for (const point of points) {
    if (!inBBox(point.lat, point.lng, bbox)) continue
    const { x, y } = worldPixel(point.lat, point.lng, zoom)
    const id = `${zoom}/${Math.floor(x / CELL_PX)}/${Math.floor(y / CELL_PX)}`
    const cell = cells.get(id)
    if (cell) cell.push(point)
    else cells.set(id, [point])
  }
  const clusters = [...cells].map(([id, cell]) => toCluster(id, cell)).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
  return { clusters: clusters.slice(0, limit), truncated: clusters.length > limit }
}
