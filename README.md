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

To produce a production build (this typechecks first):

```bash
npm run build
```

## Map tiles

Tiles come from OpenStreetMap and need no API key. Swapping in MapBox later is
still an open option; nothing in this repository is tied to OSM beyond the
single tile-layer URL in `src/App.tsx`.

## Open decisions

These are not settled yet, and nothing in this repository assumes an answer to
any of them:

- **Database** — MongoDB or PostgreSQL.
- **API style** — GraphQL or REST.
- **Photo blob storage** — not yet discussed.

Deployment is expected to target Google Cloud via GitHub Actions.
