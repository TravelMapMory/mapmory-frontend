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

## Map tiles

Tiles come from OpenStreetMap and need no API key. Swapping in MapBox later is
still an open option; nothing in this repository is tied to OSM beyond the
single tile-layer URL in `src/App.tsx`.

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

## UI skeleton

Two screens, switched by local state in `src/App.tsx` (two screens do not
justify a routing dependency yet):

- **Map** (`src/MapScreen.tsx`) — Leaflet map with OSM tiles and placeholder
  pins, a list of memory cards beside it, and a row of counters underneath.
- **Profile** (`src/ProfileScreen.tsx`) — identity card, a featured memory, and
  a photo gallery.

All pins, counters, names and dates are fabricated placeholders. Photos render
as labelled grey blocks rather than committed stand-in images.

### Figma fidelity

The layout follows the team's mock-up (`w3-services-design-template`), but the
file is shared view-only: Figma's inspect panel and the Figma MCP tools both
require edit access, so exact colours, spacing and type scales could not be
read. Every token in `src/index.css` is an approximation. To replace them with
the real values, share the Figma file with edit access.
