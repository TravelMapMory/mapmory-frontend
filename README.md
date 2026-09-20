# MapMory (frontend)

MapMory is a photo-first travel-memory app. You upload the photos you took on a
trip and the backend reads their EXIF metadata to recover where and when each
one was taken, so your memories place themselves on a map instead of being
filed by hand. The map is the main UI: a search bar filters what is already
there, memories can be grouped flexibly by city, country or your own custom
grouping, privacy is customizable per user, and a profile page collects your
own trips. This repository holds only the frontend.

## Prerequisites

- Node.js 24 (the version CI builds against)

## Getting started

```bash
npm install
npm run dev
```

`package-lock.json` is generated inside a linux container so CI can install it;
if `npm install` on macOS rewrites it, restore it with `git checkout
package-lock.json` instead of committing the rewrite.

To produce a production build (this typechecks first):

```bash
npm run build
```

## UI

Two screens, switched by the header's trailing control (`src/App.tsx`). No routing
dependency yet: the design specifies no URLs.

- **Map** (`src/MapScreen.tsx`) — a desaturated OpenStreetMap basemap under the
  design's search control and five memory markers, with the memory drawer docked
  on the right. Below 900px the desktop drawer is replaced by the mobile one,
  which is a different layout in the design, not a restyle of the same one.
- **Profile** (`src/ProfileScreen.tsx`) — the 400px identity column beside the
  stats, journey, cities and pinboard column.

Components live in `src/components/`, one Figma node each, and read their colours
and radii from `src/tokens.css`.

### Basemap

The design draws a flat, pale grey landmass. Rather than a ready-made grey
basemap, the OSM tiles are desaturated in CSS: CARTO's `light_nolabels` serves an
"API KEY REQUIRED" watermark tile without a key, and Stadia's toner-lite answers
401. A static picture of a map would match the mock-up more closely but would
throw away panning and zooming.

Nothing is tied to OSM beyond the single tile-layer URL in `src/MapScreen.tsx`,
so swapping in MapBox later remains an open option.

### Icons

Every icon comes from `lucide-react`, not from a file. The design's set is Lucide:
an exported `chevron-right` is `M6 12L10 8L6 4` on a 16 viewBox, which is Lucide's
`m9 18 6-6-6-6` on a 24 viewBox scaled by exactly 16/24, and `plus` matches the
same way. Using the components rather than SVG files also means icon colour flows
from the CSS tokens through `currentColor`.

Lucide expresses `strokeWidth` in its own 24 viewBox, so a 2px rendered stroke —
what the design specifies — needs `strokeWidth = 48 / size`. Every call site
follows that rule, and icon sizes come from the design nodes rather than from
whatever size an exported file happened to be.

### Images

Two different provenances, both deliberate:

- The memory carousel photograph and the two shared-with avatars are the design's
  own, recovered from the one Figma asset manifest that was issued before the
  file's MCP quota ran out.
- The five landmark photographs behind the map pins, the city chips, the pinboard
  and the journey hero, plus the profile sidebar's map teaser, are **stand-ins**. Figma never issued asset URLs for those
  nodes, so they are freely licensed photographs from Wikimedia Commons. Each is
  credited with its author and licence in [CREDITS.md](CREDITS.md) — the licences
  require it and this repository is public. Replace them with the design's own
  photographs when the Figma quota allows, and delete the matching rows there.

Individual paddings and font sizes inside components built while the Figma quota was
exhausted are pixel estimates rather than measurements.

## Docker

The image builds the app and serves the static bundle with nginx:

```bash
docker build -t mapmory-frontend .
docker run --rm -p 8080:8080 mapmory-frontend
```

Then open http://localhost:8080. Client-side routes are served `index.html`, so
deep links such as `/profile/xyz` survive a refresh.

The listen port comes from the `PORT` environment variable (default `8080`),
which is what Cloud Run injects:

```bash
docker run --rm -e PORT=9090 -p 9090:9090 mapmory-frontend
```

## Open decisions

These are not settled yet, and nothing in this repository assumes an answer to
any of them:

- **Database** — MongoDB or PostgreSQL.
- **API style** — GraphQL or REST.
- **Photo blob storage** — not yet discussed.

Deployment is expected to target Google Cloud via GitHub Actions.
