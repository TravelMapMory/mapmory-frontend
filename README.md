# MapMory (Frontend)

MapMory is a photo-first travel memory application that helps users organize and revisit their travels through an interactive map.

Instead of manually organizing photos by location, MapMory extracts GPS coordinates and timestamps from image metadata (EXIF) to associate photos with places and trips. Users can browse their memories geographically, correct missing locations, and eventually share selected photos with others.

This repository contains the **React frontend** of MapMory. The backend is implemented separately in Go.

The project's design document and OpenAPI specification define the intended functionality and API contracts.

## Project status

MapMory is currently a working frontend prototype with partial backend integration. Features are progressively migrated from mock implementations to the real backend.

| Feature | Current status |
|---|---|
| Landing page and navigation | Implemented |
| Sign-up and login | Firebase email/password authentication when configured; demo mode otherwise |
| Dashboard | Implemented |
| Trip creation and listing | Integrated with Go backend |
| Trip detail retrieval | Integrated with Go backend |
| Photo uploads | Mock implementation |
| EXIF extraction | Browser-side prototype |
| Location correction | Mock implementation |
| Interactive map | Implemented with mock photo data |
| Photo sharing | Planned |

The Go backend currently stores trips in memory. Firebase authentication is integrated in the frontend; database-backed application-user resolution is available separately in backend PR #41. Persistent trip storage, ownership enforcement, and the photo processing pipeline remain pending.

## Getting started

### Prerequisites

- Node.js 24 (the version used in CI)
- npm
- [MapMory backend](https://github.com/TravelMapMory) (optional, for live API integration)

### Local development

Install the dependencies:

```bash
npm ci
```

Create your local environment configuration:

```bash
cp .env.example .env.local
```

The example configuration includes `VITE_API_URL` for the Go backend, `VITE_GEOAPIFY_KEY` for map tiles, and Firebase web app settings. To enable real login, configure `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID` in `.env.local`. These Firebase web settings are public application configuration, not server secrets.

To use the real trip API, start the Go backend in the backend repository:

```bash
go run ./cmd/server
```

To run the frontend entirely with mock data, remove or comment out `VITE_API_URL` in `.env.local`.

Start the development server:

```bash
npm run dev
```

Open http://localhost:5173.

The `.env.local` file is intended for local configuration and should not be committed to Git.

### Development commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Typecheck and build for production |
| `npm run lint` | Lint the source with oxlint |
| `npm run test:typecheck` | Run TypeScript checks |
| `npm run test:acceptance` | Run Playwright acceptance tests |
| `npm run test:acceptance:ui` | Open Playwright's interactive test runner |

Use `npm ci` to install the versions recorded in `package-lock.json` without modifying the lockfile.

## Application structure

### Pages and routing

MapMory uses a lightweight History API router (`src/router.ts`) without an additional routing dependency.

Each page has its own URL, supporting browser navigation, refreshing, and direct links.

| Route | Page | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/signup` | Sign up | Signed out |
| `/login` | Log in | Signed out |
| `/dashboard` | Dashboard | Signed in |
| `/map` | Map · My photos | Signed in |
| `/map?trip={id}` | Map filtered by trip | Signed in |
| `/trips/{id}` | Trip details | Signed in |
| Other paths | Page not found | Everyone |

Opening a protected page while signed out redirects to `/login`. After signing in, users return to their originally requested page.

With Firebase configured, authentication uses Firebase email/password accounts and Firebase restores the session after reload. Without Firebase configuration, demo sign-in uses `sessionStorage` and accepts any credentials.

Invalid routes and nonexistent trips display a "Page not found" screen. Authentication and server errors are handled separately.

### Main screens

- **Landing** (`src/LandingScreen.tsx`): Introduces MapMory and provides sign-up and sign-in entry points.
- **Authentication** (`src/AuthScreen.tsx`): Firebase email/password sign-up and login, with demo fallback when unconfigured.
- **Dashboard** (`src/DashboardScreen.tsx`): Trip cards, summaries, recent photos, trip creation, and empty states.
- **Trip details** (`src/TripScreen.tsx`): Trip information, photo gallery, journey view, uploads, and location correction.
- **Map** (`src/MapScreen.tsx`): Clustered photo markers, trip and date filters, place search, and photo previews.

The earlier Profile screen from the Figma mock-up was removed following team agreement because it was not part of the design document.

## Architecture

The frontend uses React, TypeScript, Vite, and Leaflet.

Its data-access layer separates UI components from the backend and mock implementations.

### Data flow

```text
React screens
    |
    v
src/api/client.ts
    |
    +---- Mock implementation
    |     src/api/mock.ts
    |
    +---- HTTP client
          src/api/http.ts
              |
              v
          Go REST API
              |
              v
          Response adapters
          src/api/adapters.ts
              |
              v
          Frontend view models
          src/api/types.ts
```

The main modules are:

- `src/api/client.ts` — Public API interface used by screens; selects mock or live implementations.
- `src/api/http.ts` — HTTP requests, bearer-token support, and structured API error handling.
- `src/api/adapters.ts` — Converts backend responses into frontend models.
- `src/api/types.ts` — Frontend data models.
- `src/api/mock.ts` — Local simulation of features without backend integration.

Screens should access data through `client.ts` rather than directly calling the backend or importing mock implementations.

### Backend integration

When `VITE_API_URL` is configured, the following endpoints use the Go backend:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trips` | List the current user's trips |
| POST | `/api/trips` | Create a trip |
| GET | `/api/trips/{trip_id}` | Retrieve an individual trip |

Trip creation returns the new trip's ID, which the frontend uses to navigate to its detail page and retrieve the created trip.

Missing trips return HTTP 404 according to the OpenAPI contract, and the frontend displays its not-found screen.

The HTTP client attaches Firebase ID tokens when Firebase is configured, and retries a 401 once with a refreshed token. A second 401 is returned as an API error rather than automatically signing out a valid Firebase session.

In development, Vite proxies `/api` requests to the backend configured by `VITE_API_URL`, avoiding the need for separate CORS configuration.

Other operations continue to use mock implementations until their backend endpoints are available.

### Firebase identity versus application-user identity

Firebase signs the user in and provides an ID token. The frontend attaches that token to live backend requests, but does **not** store or send a PostgreSQL `users.id` or an `owner_id`. The backend verifies the Firebase identity and must resolve the application-user UUID from the verified UID itself when enforcing ownership. Never trust a user ID supplied by the browser as an ownership assertion.

Backend PR #41 offers `GET /api/auth/me` (Firebase token verification) and, with `MAPMORY_ENABLE_DB_USER_RESOLUTION=true` and PostgreSQL configured, `GET /api/users/me` (returns `{ id, auth_subject }`). These endpoints are useful for integration testing but **neither is called automatically by the frontend**. A successful Firebase login therefore does not by itself prove backend database availability. The current trip routes are still in-memory and do not enforce user ownership.

To verify end-to-end identity resolution, start the backend according to its `docs/application-user-resolution.md`, configure both applications with the **same Firebase project**, log in from the frontend and copy the ID token from an authenticated `/api/trips` request in DevTools (do not share or commit it). From a local terminal, call:

```bash
curl -i -H "Authorization: Bearer $FIREBASE_ID_TOKEN" http://localhost:8080/api/auth/me
curl -i -H "Authorization: Bearer $FIREBASE_ID_TOKEN" http://localhost:8080/api/users/me
```

Export `FIREBASE_ID_TOKEN` in the shell first. The latter endpoint should return the same `id` on repeated requests for the same account. Avoid logging tokens, passwords or refresh tokens.

Remaining integration work includes:

- Backend trip ownership enforcement and authorization
- Persistent trip and photo storage
- Cursor-based pagination
- Signed URL upload registration and completion
- Asynchronous photo processing and status recovery
- Location resolution and correction
- Photo sharing and access control

## Maps and photo metadata

### Interactive map

MapMory uses Leaflet to display photos geographically.

The current prototype supports marker clustering, trip and date filtering, place search, and photo previews.

Clustering is implemented using a custom screen-space algorithm. Large-dataset viewport loading and some world-wrap edge cases are not yet fully supported.

### Basemap configuration

The intended basemap is Geoapify Positron.

To enable it, add your browser API key to `.env.local`:

```dotenv
VITE_GEOAPIFY_KEY=your-key
```

Restart the development server after changing environment variables.

Without a Geoapify key, the application falls back to desaturated OpenStreetMap tiles.

For Docker builds, the key can be supplied using:

```bash
docker build \
  --build-arg VITE_GEOAPIFY_KEY=your-key \
  -t mapmory-frontend .
```

### Photo metadata

The upload prototype accepts JPEG and PNG images up to 25,000,000 bytes (25 MB).

The browser-side EXIF reader (`src/api/exif.ts`) extracts capture timestamps and GPS coordinates for the mock implementation.

Photos without usable GPS coordinates remain available in the gallery with the `needs-location` state but do not appear on the map.

Location correction currently supports place search and manual pin placement using mock data.

The production architecture delegates EXIF extraction, image processing, and place resolution to backend services rather than relying on the browser implementation.

## Development conventions

See [Frontend Coding Conventions](docs/coding-conventions.md)
for our TypeScript, React, accessibility, testing, and linting policies.

Before opening a pull request, run:

```bash
npm run lint
npm run build
npm run test:typecheck
```

## Testing

MapMory uses Playwright for frontend acceptance testing.

### Running tests

Install the dependencies and Chromium:

```bash
npm ci
npx playwright install chromium
```

Run TypeScript checks and acceptance tests:

```bash
npm run test:typecheck
npm run test:acceptance
```

For interactive debugging:

```bash
npm run test:acceptance:ui
```

To inspect the HTML test report:

```bash
npx playwright show-report
```

On Linux environments missing browser dependencies, install them with:

```bash
npx playwright install --with-deps chromium
```

### Test coverage

The acceptance suite covers:

- Landing, sign-up, login, and navigation flows
- Dashboard summaries and trip creation
- Trip and photo navigation
- Gallery and journey views
- Map filtering and place search
- Location correction
- Mock photo uploads, progress, failures, and retries
- Empty, loading, and error states
- Keyboard interactions and responsive layouts

Tests run at desktop (1440px), tablet (768px), and phone (390px) viewport widths.

The suite uses a dedicated Vite server at `127.0.0.1:4173` with controlled mock data and blocked external requests. It does not require a Firebase account, Geoapify key, or running Go backend.

See [Acceptance Test Coverage](tests/docs/acceptance-coverage.md) for detailed assertions, fixtures, and deferred testing work.

These tests do not establish complete browser compatibility, accessibility compliance, or real backend integration correctness. Backend flows should also be verified separately.

Test screenshots, traces, and reports are generated locally and ignored by Git.

## Docker and deployment

The frontend can be built into a Docker image that serves its static assets using nginx.

Build and run:

```bash
docker build -t mapmory-frontend .
docker run --rm -p 8080:8080 mapmory-frontend
```

Open http://localhost:8080.

The nginx configuration supports SPA routing by serving `index.html` for frontend paths that do not correspond to static files.

The container's listening port is configurable through the `PORT` environment variable (default `8080`):

```bash
docker run --rm \
  -e PORT=9090 \
  -p 9090:9090 \
  mapmory-frontend
```

This supports platforms such as Google Cloud Run.

**Note:** Vite environment variables are resolved during the frontend build. Running the container does not automatically configure its API backend. Production deployment must also provide suitable API routing.

## Known limitations

MapMory is still under active development. Important limitations include:

- Authentication currently uses a demo account without real access control.
- Backend trips are stored in memory and disappear when the server restarts.
- Photo uploads and processing remain mock implementations.
- Mock upload identity and retry behavior do not represent production guarantees.
- Browser-side EXIF parsing and place resolution are incomplete.
- Map clustering and viewport loading are not optimized for large datasets.
- Sharing functionality has not been integrated.

See [Known Limitations](docs/limitations.md) for detailed implementation caveats and deferred work.

## References and credits

The design document is the source of truth for the application's intended screens, behavior, and architecture. The OpenAPI specification defines the backend API contract.

The planned production stack includes PostgreSQL, Google Cloud Storage with signed URLs, Firebase Auth, and Google Cloud Run.

Icons are provided by `lucide-react`, with status information represented through both text and iconography.

Sample photographs in `src/assets/pins/` are sourced from Wikimedia Commons. Their authors and licenses are documented in [CREDITS.md](CREDITS.md).
