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

Every page has an address (`src/router.ts`, a small History API router, no
dependency), so Back/Forward, reload and copied links work. The header tabs
are **Dashboard | Map**; a trip page is reached from either.

| Path | Page | Who |
| --- | --- | --- |
| `/` | Landing | signed out (signed in → `/dashboard`) |
| `/signup`, `/login` | Sign up / log in | signed out (signed in → `/dashboard`) |
| `/dashboard` | Dashboard | owner |
| `/map`, `/map?trip={id}` | Map · My photos, optionally one trip | owner |
| `/trips/{id}` | Trip detail | owner |
| anything else | Page not found | everyone |

Opening an owner page while signed out goes to `/login` and, after logging
in, back to the page that was asked for. nginx already serves `index.html` for
unknown paths (`nginx.conf.template`), so deep links work in production too.
Mock data still resets on reload, so a trip created in the browser is gone
after a reload of its page.

- **Landing** (`src/LandingScreen.tsx`): what a signed-out visitor sees first
  (demo gala feedback): what MapMory does, the three main features, and
  "Get started" (sign up) / "Sign in" (log in). Both open one form
  (`src/AuthScreen.tsx`) that can switch between the two. Until Firebase Auth
  is wired in, submitting it with any details opens the demo account, which is
  remembered for the tab in `sessionStorage`; "Sign out" in the header returns
  to the landing page.
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

`src/api/client.ts` is the only module screens import for data. Endpoints
move from the mock (`src/api/mock.ts`) to the Go backend one at a time:

- `src/api/http.ts` sends the request, adds the Firebase ID token when one is
  set (`setTokenProvider`, used once Firebase Auth lands), and turns the
  backend's `{ "error": { "code", "message" } }` into an `ApiError`.
- `src/api/adapters.ts` turns backend JSON into the view models in
  `src/api/types.ts`, with neutral defaults for fields the backend does not
  send yet (e.g. a trip's cities and dates).
- `LIVE` in `client.ts` lists the endpoints the backend serves. Today that is
  `GET /api/trips` and `POST /api/trips`.

To use the backend, run it (`go run ./cmd/server` in mapmory-backend) and set
`VITE_API_URL=http://localhost:8080` in `.env.local`. The Vite dev server then
forwards `/api` to it, so no CORS setup is needed. Without `VITE_API_URL`
everything uses the mock, which is what the acceptance tests do. In live mode
a trip created on the backend cannot be opened yet, because
`GET /api/trips/{id}` still comes from the mock; when the backend adds an
endpoint, add it to `LIVE` and, if needed, an adapter.

Still to do for full integration: cursor pagination, signed-URL expiry
handling and the real batch registration/upload/completion/status workflow.

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

## Acceptance tests

Install the pinned dependencies and Playwright's Chromium once:

```bash
npm ci
npx playwright install chromium
npm run test:typecheck
npm run test:acceptance
```

On Linux machines missing browser libraries, use
`npx playwright install --with-deps chromium`. CI installs those dependencies.
The tests start their own Vite server at `127.0.0.1:4173` and block external
requests, so tiles, fonts and provider availability cannot change the result.
No Geoapify key or Firebase account is needed.

The suite covers Dashboard forms and summaries, trip/card navigation, Map
filters and world search, photo/trip navigation, Gallery/Journey states,
location correction, and mock upload selection/drop/progress/retry controls.
It includes empty collections, malformed metadata, mixed uploads, failed reads
and saves, loading states, and long content. Keyboard and layout checks run at
desktop (1440px), tablet (768px) and phone (390px) widths; uncaught browser errors
fail every E2E test. The exact byte boundary runs once on desktop.

See [the coverage inventory](tests/docs/acceptance-coverage.md) for the controls,
assertions, fixture setup and deliberately deferred integration work. Test data
and one-shot failures are enabled only on the dedicated acceptance-test server;
ordinary development and production builds keep the normal mock behavior.

These are Chromium viewport checks, not a claim of Safari/Firefox compatibility
or a complete accessibility audit. They do not test real storage, authentication,
persistent recovery or large datasets. Run the gala flow on an actual phone too.

Use `npm run test:acceptance:ui` to debug, or `npx playwright show-report` to
inspect the HTML report. Failure screenshots and traces are saved in
`test-results/`; generated reports are git-ignored. To use an existing Chromium
binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its absolute path.
