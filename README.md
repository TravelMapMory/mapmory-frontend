# UniMap (frontend)

UniMap is a photo-first travel-memory app. You upload the photos you took on a
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
docker build -t unimap-frontend .
docker run --rm -p 8080:8080 unimap-frontend
```

Then open http://localhost:8080. Client-side routes are served `index.html`, so
deep links such as `/profile/xyz` survive a refresh.

The listen port comes from the `PORT` environment variable (default `8080`),
which is what Cloud Run injects:

```bash
docker run --rm -e PORT=9090 -p 9090:9090 unimap-frontend
```

## Open decisions

These are not settled yet, and nothing in this repository assumes an answer to
any of them:

- **Database** — MongoDB or PostgreSQL.
- **API style** — GraphQL or REST.
- **Photo blob storage** — not yet discussed.

Deployment is expected to target Google Cloud via GitHub Actions.
