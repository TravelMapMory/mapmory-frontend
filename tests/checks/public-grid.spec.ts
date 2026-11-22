import { expect, test } from '@playwright/test'
import { PUBLIC_CLUSTER_LIMIT } from '../../src/api/limits'
import {
  clusterPublicPoints,
  coarsePosition,
  inBBox,
  MAX_SHARES_PER_CLUSTER,
  normalizeBBox,
  type PublicPoint,
} from '../../src/api/publicGrid'
import type { BBox } from '../../src/api/types'

const WORLD: BBox = [-180, -85, 180, 85]

function point(photo_id: string, lat: number, lng: number, extra: Partial<PublicPoint> = {}): PublicPoint {
  return { photo_id, share_id: 's1', share_title: 'Share one', thumb_url: `/${photo_id}.jpg`, lat, lng, city: null, country: null, ...extra }
}

test('public positions are the city centre, or rounded to 0.01° without a city', () => {
  expect(coarsePosition(48.8584, 2.2945, { lat: 48.8566, lng: 2.3522 })).toEqual({ lat: 48.8566, lng: 2.3522 })
  expect(coarsePosition(48.85844, 2.29451, null)).toEqual({ lat: 48.86, lng: 2.29 })
  expect(coarsePosition(-33.86785, 151.20732, null)).toEqual({ lat: -33.87, lng: 151.21 })
})

test('bounding boxes past ±180 wrap, and wider than the world cover it', () => {
  expect(normalizeBBox([-200, 10, -160, 20])).toEqual([160, 10, -160, 20])
  expect(normalizeBBox([170, 10, 190, 20])).toEqual([170, 10, -170, 20])
  expect(normalizeBBox([-10, 10, 180, 20])).toEqual([-10, 10, 180, 20])
  expect(normalizeBBox([-400, -95, 400, 95])).toEqual([-180, -90, 180, 90])
  // A box that crosses the antimeridian keeps both sides and nothing in between.
  expect(inBBox(15, 175, [160, 10, -160, 20])).toBe(true)
  expect(inBBox(15, -170, [160, 10, -160, 20])).toBe(true)
  expect(inBBox(15, 0, [160, 10, -160, 20])).toBe(false)
})

test('only photos inside the visible area are returned', () => {
  const page = clusterPublicPoints([point('paris', 48.86, 2.35), point('tokyo', 35.68, 139.69)], { bbox: [-10, 35, 30, 60], zoom: 4 })
  expect(page.clusters.map((c) => c.count)).toEqual([1])
  expect(page.clusters[0].cover_url).toBe('/paris.jpg')
  expect(page.truncated).toBe(false)
})

test('nearby places merge when zoomed out and separate when zoomed in', () => {
  const points = [
    point('p1', 48.8566, 2.3522, { city: 'Paris', country: 'France' }),
    point('p2', 48.8566, 2.3522, { city: 'Paris', country: 'France' }),
    point('b1', 52.52, 13.405, { city: 'Berlin', country: 'Germany' }),
  ]
  const far = clusterPublicPoints(points, { bbox: WORLD, zoom: 2 })
  expect(far.clusters).toHaveLength(1)
  expect(far.clusters[0]).toMatchObject({ count: 3, label: 'Paris', bounds: [2.3522, 48.8566, 13.405, 52.52] })

  const near = clusterPublicPoints(points, { bbox: WORLD, zoom: 6 })
  expect(near.clusters.map((c) => [c.label, c.count])).toEqual([
    ['Paris', 2],
    ['Berlin', 1],
  ])
  // Photos at one city centre cannot be split by zooming: the bounds are a single point.
  expect(near.clusters[0].bounds).toEqual([2.3522, 48.8566, 2.3522, 48.8566])
})

test('cluster ids and order are stable, largest first', () => {
  const points = [point('a', 10, 10), point('b', 20, 20), point('c', 20, 20)]
  const first = clusterPublicPoints(points, { bbox: WORLD, zoom: 5 })
  const again = clusterPublicPoints([...points].reverse(), { bbox: WORLD, zoom: 5 })
  expect(first.clusters.map((c) => c.id)).toEqual(again.clusters.map((c) => c.id))
  expect(first.clusters.map((c) => c.count)).toEqual([2, 1])
  expect(first.clusters[0].id).toMatch(/^5\/\d+\/\d+$/)
})

test(`at most ${PUBLIC_CLUSTER_LIMIT} clusters are returned, the fullest ones`, () => {
  const points: PublicPoint[] = []
  for (let lat = -60; lat <= 70; lat += 2) for (let lng = -178; lng <= 178; lng += 2) points.push(point(`${lat},${lng}`, lat, lng))
  // One cell with two photos must survive the cut.
  points.push(point('extra', 0, 0))
  const page = clusterPublicPoints(points, { bbox: WORLD, zoom: 6 })
  expect(page.clusters).toHaveLength(PUBLIC_CLUSTER_LIMIT)
  expect(page.truncated).toBe(true)
  expect(page.clusters[0].count).toBe(2)
  expect(clusterPublicPoints(points.slice(0, 50), { bbox: WORLD, zoom: 6 }).truncated).toBe(false)
})

test('a cluster counts each photo once and lists its largest shares', () => {
  const points: PublicPoint[] = [
    // The same photo in two public shares is one photo on the map.
    point('x', 41.9, 12.5, { share_id: 'a', share_title: 'Alpha' }),
    point('x', 41.9, 12.5, { share_id: 'b', share_title: 'Beta' }),
    point('y', 41.9, 12.5, { share_id: 'b', share_title: 'Beta' }),
  ]
  for (let i = 0; i < 6; i++) points.push(point(`z${i}`, 41.9, 12.5, { share_id: `s${i}`, share_title: `Share ${i}` }))
  const [cluster] = clusterPublicPoints(points, { bbox: WORLD, zoom: 10 }).clusters
  expect(cluster.count).toBe(8)
  expect(cluster.share_count).toBe(8)
  expect(cluster.shares).toHaveLength(MAX_SHARES_PER_CLUSTER)
  expect(cluster.shares[0]).toEqual({ id: 'b', title: 'Beta', cover_url: '/x.jpg', photo_count: 2 })
})

test('labels prefer the most common city, then the country', () => {
  const page = clusterPublicPoints(
    [
      point('1', 60.17, 24.94, { city: 'Helsinki', country: 'Finland' }),
      point('2', 60.17, 24.94, { city: 'Espoo', country: 'Finland' }),
      point('3', 60.2, 24.9, { country: 'Finland' }),
    ],
    { bbox: WORLD, zoom: 3 },
  )
  // A tie between cities is broken alphabetically, so the label never flickers.
  expect(page.clusters[0].label).toBe('Espoo')
  expect(clusterPublicPoints([point('1', 60, 25, { country: 'Finland' })], { bbox: WORLD, zoom: 3 }).clusters[0].label).toBe('Finland')
  expect(clusterPublicPoints([point('1', 60, 25)], { bbox: WORLD, zoom: 3 }).clusters[0].label).toBeNull()
})
