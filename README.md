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
npm install
npm run dev
```

`package-lock.json` is generated inside a linux container so CI can install it;
if `npm install` on Windows or macOS rewrites it, restore it with `git checkout
package-lock.json` instead of committing the rewrite.

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

The backend has no API yet, so `src/api/client.ts` returns mock data from
`src/api/mock.ts`, shaped like the endpoints in design doc 5.2 (types in
`src/api/types.ts`). When an endpoint exists, only its function in
`client.ts` changes. The mock keeps state until the page reloads, so a
correction really does update the Dashboard counts and the map.

### Photo metadata

Uploads accept JPEG and PNG up to 25 MB. The capture time and GPS position are
read from each file's EXIF (`src/api/exif.ts`, both byte orders, PNG eXIf
chunks). In production the Go worker does this after upload; until then the
mock backend uses this reader so the prototype shows real metadata. A GPS of
exactly 0,0 counts as no fix. Photos without usable GPS are kept with state
`needs-location` and appear in the gallery, not on the map.

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
