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

### What is NOT faithful yet

The Figma file is on a Starter plan and its MCP tool-call quota was exhausted part
way through this build. Two consequences, both still open:

1. **The icons are stand-ins.** Every SVG under `src/assets/` was hand-authored in
   Lucide's style, not exported from Figma, because the asset manifest could never
   be fetched. Shapes and stroke weights are approximations.
2. **The design's photographs are missing.** Every image slot falls back to
   `src/assets/photo-placeholder.svg`. The carousel, the avatars, the map teaser,
   the city chips and the pinboard all render as grey placeholder blocks.

Layout, structure, copy and the token values in `src/tokens.css` come from real
design data. Individual paddings and font sizes inside components that were built
after the quota ran out are pixel estimates and are marked in this file's history
rather than asserted as correct. Re-running the build once the quota resets (or on
a paid Figma plan) is what closes the gap.

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
