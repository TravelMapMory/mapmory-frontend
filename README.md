# MapMory (frontend)

MapMory is a photo-first travel-memory app. You upload the photos you took on a
trip and the backend reads their EXIF metadata to recover where and when each
one was taken, so your trips place themselves on a map instead of being filed
by hand. Everything is private until the owner shares it. This repository
holds only the frontend; the design document is the source of truth for
screens, rules and API.

## Prerequisites

- Node.js 24 (the version CI builds against)

## Getting started

```bash
npm ci
npm run dev
```

Use `npm ci` to install the committed dependency versions without rewriting the lockfile.

To produce a production build (this typechecks first):

```bash
npm run build
```

## UI

Screens are switched by local state in `src/App.tsx` (no router yet). The
header tabs are **Dashboard | Map**; a trip page is reached from either.

- **Dashboard** (`src/DashboardScreen.tsx`): totals, trip cards, recently
  uploaded, create trip, empty states.
- **Trip** (`src/TripScreen.tsx`): trip header, every photo including the ones
  without GPS as a gallery or a day-by-day journey list, upload with per-photo
  status (`src/components/UploadPanel.tsx`), and location correction: search
  for a place, drop or drag a pin on a map, or reuse the previous photo's
  place (`src/components/LocationPicker.tsx`). Creating a trip opens it.
- **Map · My photos** (`src/MapScreen.tsx`): the owner's located photos as
  clustered pins (`src/components/PhotoClusters.tsx`), filters for trip,
  capture dates and "Filter my photos", "Find a place", and a panel with the
  selected pin's photos. Below 900px the panel sits under the map.

The earlier Profile screen from the Figma mock-up was dropped, as agreed with
the team, because the design doc has no Profile page.

### Data

`src/api/client.ts` currently calls the in-memory mock in `src/api/mock.ts`.
Its types are frontend view models, not a complete implementation of the
OpenAPI contract. Backend integration will need response adapters, cursor
pagination, Firebase tokens, signed-URL expiry handling and the real batch
registration/upload/completion/status workflow.

The mock keeps state only until the page reloads. Closing the upload UI or
navigating away loses its local progress list even if processing continues.
It has no GCS storage, server processing, persistent batch recovery or access
checks. Its filename/size/mtime-based file IDs are globally deduplicated:
reusing a file in another trip can return the original trip's photo, and
concurrent repeated files can produce duplicate records. Use distinct files
for the gala's controlled upload attempts. Backend integration must use the
agreed `(batch_id, client_file_id)` identity; this mock is not proof of retry
idempotency or content deduplication.

My photos contains only owned photos. Shared collections and recipient rows
are deferred until their access and presentation model is agreed.

### Map limitations

The custom screen-space clustering is a prototype deviation from the
`Leaflet.markercluster` choice in design document §5.1. Its ordering,
performance and world-wrap edge cases have not yet been fully evaluated.

Large-dataset viewport loading is deferred. The design calls for at most
2,000 markers in the visible area. The mock initially fetches without a
bounding box; after a truncated result, it fetches viewports only while the
latest result remains truncated. A small viewport can therefore stop future
pan requests. The current implementation is suitable for the small demo
collection, not evidence that large collections are supported.

### Photo metadata

Uploads accept JPEG and PNG up to 25,000,000 bytes (25 MB). The capture time and GPS position are
read from each file's EXIF (`src/api/exif.ts`, both byte orders, PNG eXIf
chunks). In production the Go worker does this after upload; until then the
mock backend uses this reader so the prototype shows real metadata. A GPS of
exactly 0,0 counts as no fix. Photos without usable GPS are kept with state
`needs-location` and appear in the gallery, not on the map.

The browser parser is a demo stand-in for the Go worker, with known incomplete
and potentially incorrect behavior. Invalid dates are treated as unknown,
but GPS hemisphere handling and the assumption that `(0,0)` means no fix
remain mock limitations. Original EXIF coordinates are not retained separately
when the mock applies corrections.

Place search uses a fixed gazetteer, not a worldwide provider. Reverse lookup
assigns the nearest listed city within 50 km, automatically confirming labels
within 15 km or after a manual correction. These heuristics can assign the
wrong city/country and do not implement provider normalization, attribution,
confidence ranking or timezone lookup. Keep this logic isolated as a mock;
replace it with the server resolver during integration.

### Basemap

The design doc specifies Geoapify Positron tiles. Put a Geoapify browser key
in `.env.local` (git-ignored; see `.env.example`):

```
VITE_GEOAPIFY_KEY=your-key
```

and restart `npm run dev`. Without a key the map falls back to desaturated
OpenStreetMap tiles, so the app still runs for anyone who clones the repo.
For a Docker build, pass it with `--build-arg VITE_GEOAPIFY_KEY=...`.

### Icons

Every icon comes from `lucide-react`, not from a file, so icon colour follows
the CSS through `currentColor`. Status is never shown by colour alone: each
status has an icon and a word (doc 4.3).

### Images

The sample photos in `src/assets/pins/` are freely licensed photographs from
Wikimedia Commons, one per mock photo, each placed at the coordinates of the
landmark it shows. Each is credited with its author and licence in
[CREDITS.md](CREDITS.md); the licences require it and this repository is public.

## Docker

The image builds the app and serves the static bundle with nginx:

```bash
docker build -t mapmory-frontend .
docker run --rm -p 8080:8080 mapmory-frontend
```

Then open http://localhost:8080. nginx serves `index.html` for unknown paths,
so client-side routes will survive a refresh once the app has them.

The listen port comes from the `PORT` environment variable (default `8080`),
which is what Cloud Run injects:

```bash
docker run --rm -e PORT=9090 -p 9090:9090 mapmory-frontend
```

## Decisions

Settled in the design document: PostgreSQL, a REST API, Google Cloud Storage
with signed URLs for photos, Firebase Auth, and Cloud Run for deployment.
