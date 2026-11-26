import { useState } from 'react'

/** One selectable basemap: its tiles, credits and a single preview tile of Europe for the layers menu. */
export interface BasemapSpec {
  label: string
  url: string
  attribution: string
  /** Greys the tile pane, for a quiet map that lets the photo pins stand out. */
  desaturate: boolean
  /** Highest zoom the tile server renders; Leaflet scales its tiles beyond it. */
  maxNativeZoom: number
  thumb: string
}

const OSM_CREDIT = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const GEOAPIFY_CREDIT = `© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> ${OSM_CREDIT}`
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_THUMB = 'https://tile.openstreetmap.org/4/8/5.png'

/**
 * Street basemap (doc 4): Geoapify OSM Bright when a browser key is configured
 * in `.env.local`, otherwise the standard OpenStreetMap tiles, which need no
 * key, so the app still runs for anyone who clones the repo.
 */
const GEOAPIFY_KEY: string | undefined = import.meta.env.VITE_GEOAPIFY_KEY || undefined
const geoapify = (style: string) => `https://maps.geoapify.com/v1/tile/${style}/{z}/{x}/{y}{r}.png?apiKey=${GEOAPIFY_KEY}`
const geoapifyThumb = (style: string) => `https://maps.geoapify.com/v1/tile/${style}/4/8/5.png?apiKey=${GEOAPIFY_KEY}`

export const TILES: BasemapSpec = GEOAPIFY_KEY
  ? { label: 'Map', url: geoapify('osm-bright'), attribution: GEOAPIFY_CREDIT, desaturate: false, maxNativeZoom: 19, thumb: geoapifyThumb('osm-bright') }
  : { label: 'Map', url: OSM_TILES, attribution: OSM_CREDIT, desaturate: false, maxNativeZoom: 19, thumb: OSM_THUMB }

/** The basemaps a viewer can pick from the layers menu, in menu order. */
export const BASEMAPS = {
  map: TILES,
  minimal: GEOAPIFY_KEY
    ? { label: 'Minimal', url: geoapify('positron'), attribution: GEOAPIFY_CREDIT, desaturate: false, maxNativeZoom: 19, thumb: geoapifyThumb('positron') }
    : { label: 'Minimal', url: OSM_TILES, attribution: OSM_CREDIT, desaturate: true, maxNativeZoom: 19, thumb: OSM_THUMB },
  terrain: {
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: `Map data: ${OSM_CREDIT}, SRTM · Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`,
    desaturate: false,
    maxNativeZoom: 17,
    thumb: 'https://a.tile.opentopomap.org/4/8/5.png',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
    desaturate: false,
    maxNativeZoom: 18,
    thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/5/8',
  },
} satisfies Record<string, BasemapSpec>

export type Basemap = keyof typeof BASEMAPS

/**
 * Leaflet's zoom animation: scales the current tiles while the new ones load,
 * instead of blanking and redrawing them, which reads as flicker. Off for
 * viewers who ask for reduced motion (Leaflet does not check that itself).
 */
export const ANIMATE_ZOOM = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const STORAGE_KEY = 'mapmory.basemap'

/** Whether a stored value names a known basemap, so an old or edited value cannot break the map. */
function isBasemap(value: string | null): value is Basemap {
  return value !== null && Object.hasOwn(BASEMAPS, value)
}

/** Reads the viewer's last basemap; storage can be missing or blocked, so it falls back to the street map. */
function storedBasemap(): Basemap {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isBasemap(value) ? value : 'map'
  } catch {
    return 'map'
  }
}

/** The viewer's basemap choice, remembered in this browser across the map screens. */
export function useBasemap(): [Basemap, (next: Basemap) => void] {
  const [basemap, setBasemap] = useState<Basemap>(storedBasemap)
  const choose = (next: Basemap) => {
    setBasemap(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage is a convenience: without it the choice lasts until the page is left.
    }
  }
  return [basemap, choose]
}
