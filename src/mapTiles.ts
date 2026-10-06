/**
 * Basemap (doc 4): Geoapify Positron when a browser key is configured in
 * `.env.local`, otherwise desaturated OpenStreetMap so the app still runs
 * for anyone who clones the repo without a key.
 */
const GEOAPIFY_KEY: string | undefined = import.meta.env.VITE_GEOAPIFY_KEY || undefined
export const TILES = GEOAPIFY_KEY
  ? {
      url: `https://maps.geoapify.com/v1/tile/positron/{z}/{x}/{y}{r}.png?apiKey=${GEOAPIFY_KEY}`,
      attribution:
        '© <a href="https://www.geoapify.com/">Geoapify</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      desaturate: false,
    }
  : {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      desaturate: true,
    }
