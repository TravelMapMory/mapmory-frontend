# MapMory (Frontend)

MapMory is a photo-first travel memory application that helps users organize and revisit their travels through an interactive map.

Instead of manually organizing photos by location, MapMory extracts GPS coordinates and timestamps from image metadata (EXIF) to associate photos with places and trips. Users can browse their memories geographically, correct missing locations, and share selected photos by link or through the public map.

This repository contains the **React frontend** of MapMory. The backend is implemented separately in Go.

The project's design document and OpenAPI specification define the intended functionality and API contracts.

## Project status

MapMory includes an interactive mock-data prototype and a separate live API mode. The frontend has adapters for authenticated trip and photo management, photo uploads, location correction, and selective sharing. Those live features require a compatible, running Go backend; an empty or unavailable live service does not supply demonstration photos as a fallback.

| Feature | Current frontend behavior |
|---|---|
| Landing, navigation, public map entry | Implemented |
| Authentication | Firebase email/password when configured; demo sign-in otherwise |
| Dashboard | Live trip listing, summary and recent photos using backend API; demonstration data in mock mode |
| Trip creation, detail, editing | Connected to Go API in live mode |
| Photo uploads and processing status | Signed-URL registration/upload/completion and recovery in live mode; simulated in mock mode |
| Trip gallery, journey, map | Paginated live photos, owner map markers and filtering; mock alternatives |
| Location search and correction | Live place search and location updates; simulated in mock mode |
| Share creation and management | Owner-scoped list/create/revoke; fixed photo selections; two-step preview before publishing |
| Anonymous recipient view | Link token `/s/{token}` or public-share ID `/public/{id}`; selected display images and approximate locations only |
| Public map | `/map/public`, viewport-bounded clustering and public-share discovery |

Sharing supports **anyone with the link** and **public discovery**. Public-share reporting and owner-initiated trip/account deletion are implemented. Named recipients, groups and owner-selected share covers are not implemented. Reported public shares are hidden from discovery pending manual moderation; an owner-facing moderation-status indicator is not yet available.

The Go backend must support the corresponding endpoints, PostgreSQL persistence, Firebase verification and image storage. The Go backend must include the sharing, reporting, and deletion endpoints (backend #58, #60, and #61). See [Mock and Live API Modes](docs/api-modes.md) for precise requirements and limitations.

## Getting started

### Prerequisites

- Node.js 24 (the version used in CI)
- npm
- [MapMory backend](https://github.com/TravelMapMory) (optional, for live API integration)

### Development data modes

The frontend supports mock and live API modes. Leave `VITE_API_URL` unset to use predefined demo trips and photos, including simulated sharing. Set `VITE_API_URL` to connect to the Go backend.

The backend's database settings do not switch the frontend between these modes. Live photo sharing additionally requires a compatible sharing backend, PostgreSQL, Firebase and configured photo storage.

See [Mock and Live API Modes](docs/api-modes.md) for configuration details, limitations, and testing instructions.

### Account verification and onboarding

When Firebase is configured, sign-up requests an email verification message and the account menu shows the signed-in account. Verification is **non-blocking**: unverified owners can still create trips, upload photos, and use sharing. The reminder offers Resend email and a check for completed verification; delayed, expired, or invalid links can be replaced by requesting another email. Email delivery can vary by provider. The getting-started guide tracks trip creation, uploads, and a first successful place review or location correction; owners can review remaining photos later. It disappears when all steps are complete or when dismissed. The dismissal preference is scoped to the Firebase user ID (the demo account has its own preference).

To test Firebase sign-up, verification, resend, and deletion without real email delivery, start the Firebase Auth emulator as described below, then run `MAPMORY_TEST_FIREBASE_APP_URL=http://localhost:5180 MAPMORY_TEST_FIREBASE_EMULATOR_URL=http://127.0.0.1:9099 npx playwright test --project=integration tests/integration/firebase-emulator.spec.ts` with the frontend running on port 5180 using the emulator environment settings. Standard acceptance tests do not include this integration project.

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

With database mode and photo storage configured, uploads and trip photo lists use the real API: the browser registers files, PUTs each one directly to a storage-signed URL, then asks the backend to process it. Location correction and sharing also use live API endpoints. GCS is the existing backend storage option; the separately proposed local-filesystem backend branch can be used instead once that branch is applied and verified. A frontend setting alone cannot enable local photo storage.

Without access to the shared Firebase project, sign in against the [Firebase Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) instead: run `npx firebase-tools emulators:start --only auth --project demo-mapmory`, set `VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`, any non-empty `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID=demo-mapmory`, and start the backend with `FIREBASE_PROJECT_ID=demo-mapmory FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Emulator accounts exist only while the emulator runs.

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
| `npm run test:integration` | Test authenticated live trip APIs against the Go backend |
| `npm run test:boundaries` | Verify mock/live separation for summary, uploads and sharing |

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
| `/s/{token}` | Link recipient view | Anyone possessing the link |
| `/map/public` | Public map | Everyone |
| `/public/{id}` | Public collection view | Everyone for public, unrevoked shares |
| Other paths | Page not found | Everyone |

Opening a protected page while signed out redirects to `/login`. After signing in, users return to their originally requested page.

With Firebase configured, authentication uses Firebase email/password accounts and Firebase restores the session after reload. Without Firebase configuration, demo sign-in uses `sessionStorage` and accepts any credentials.

Invalid routes and nonexistent trips display a "Page not found" screen. Authentication and server errors are handled separately.

### Main screens

- **Landing** (`src/LandingScreen.tsx`): Introduces MapMory and provides sign-up and sign-in entry points.
- **Authentication** (`src/AuthScreen.tsx`): Firebase email/password sign-up and login, with demo fallback when unconfigured.
- **Dashboard** (`src/DashboardScreen.tsx`): Trip cards, summaries, recent photos, trip creation, and empty states.
- **Trip details** (`src/TripScreen.tsx`): Trip information, photo gallery, journey view, uploads, and location correction.
- **Map** (`src/MapScreen.tsx`): Clustered owner photo markers, trip and date filters, place search, and photo previews.
- **Sharing** (`src/components/ShareSettings.tsx`, `src/components/SharePreview.tsx`): Choose processed photos, preview title/selection/audience, publish link or public shares and revoke them.
- **Recipient** (`src/SharedScreen.tsx`): Anonymous, share-scoped gallery and approximate-location map.
- **Public map** (`src/PublicMapScreen.tsx`): Explore public shares within the map viewport, with bounded clusters.

**Photo viewer controls:** Select a thumbnail in the Gallery or Journey view to open the viewer. Use **← / →** or Previous/Next to move between photos, **Esc** or Close to dismiss it, and **Tab** / **Shift+Tab** to move between controls. Press **Enter** or **Space** to activate a focused button. Clicking the backdrop also closes the viewer. Closing returns keyboard focus to the thumbnail that opened it.

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

When `VITE_API_URL` is set, `src/api/client.ts` uses the Go API for the following families of operations:

| Endpoint(s) | Purpose |
|---|---|
| `GET /api/me/summary` | Owner dashboard counts and recent uploads |
| `GET, POST /api/trips`; `GET, PATCH /api/trips/{id}` | Trip listing, creation, detail and editing |
| `GET /api/trips/{id}/photos`; `GET /api/map/photos` | Paginated gallery and owner map |
| `POST /api/trips/{id}/batches`; batch file completion/status endpoints | Photo registration, signed URL upload, processing and recovery |
| `GET /api/places/search`; `PATCH /api/photos/{id}/location` | Place lookup and owner correction |
| `GET, POST /api/trips/{id}/shares`; `DELETE /api/shares/{id}` | Owner sharing management |
| `GET /api/s/{token}` | Anonymous link recipient collection |
| `GET /api/public/shares/{id}`; `GET /api/public/map` | Public collection and viewport-limited map |

These are *frontend integrations*, not a guarantee that an arbitrary backend checkout implements the entire API. Live sharing depends on backend PR #58. The HTTP client attaches Firebase ID tokens for owner requests and retries a 401 once with a refreshed token; anonymous recipient and public endpoints do not require an account.

In development, Vite proxies `/api` requests to `VITE_API_URL`. File bytes use separate signed PUT/GET URLs supplied by storage, which can have their own origin and CORS requirements. The frontend never uploads originals through the `/api` proxy.

### Mock and live data boundaries

Leaving `VITE_API_URL` unset selects the demonstration dataset, including simulated uploads, share links, revocation, and public shares. Setting it selects live requests for all endpoint families listed above, **without falling back to mock records** when the server responds with an error or empty dataset. The mock link/share state is browser-local rather than cross-device persistence.

The two modes are independent of the backend's `MAPMORY_ENABLE_DB_USER_RESOLUTION` flag. To exercise persistence and authorization, use a database-backed backend with the required migrations. See [API Modes](docs/api-modes.md) for a setup matrix and integration checks.

### Firebase identity versus application-user identity

Firebase signs the user in and provides an ID token. The frontend attaches that token to live backend requests, but does **not** store or send a PostgreSQL `users.id` or an `owner_id`. The backend verifies the Firebase identity and must resolve the application-user UUID from the verified UID itself when enforcing ownership. Never trust a user ID supplied by the browser as an ownership assertion.

Backend PR #41 offers `GET /api/auth/me` (Firebase token verification) and, with `MAPMORY_ENABLE_DB_USER_RESOLUTION=true` and PostgreSQL configured, `GET /api/users/me` (returns `{ id, auth_subject }`). These endpoints are useful for integration testing but **neither is called automatically by the frontend**. A successful Firebase login therefore does not by itself prove backend database availability.

The database-backed Go API provides persistent, owner-scoped trip operations when `MAPMORY_ENABLE_DB_USER_RESOLUTION=true`. The frontend passes Firebase ID tokens and does not supply or control the internal owner UUID.

Integration testing has confirmed that trips survive backend restarts and that two distinct Firebase users cannot list or retrieve one another's private trips.

These guarantees depend on using the database-backed implementation; the older in-memory fallback does not provide equivalent persistence or ownership enforcement.

To verify end-to-end identity resolution, start the backend according to its `docs/application-user-resolution.md`, configure both applications with the **same Firebase project**, log in from the frontend and copy the ID token from an authenticated `/api/trips` request in DevTools (do not share or commit it). From a local terminal, call:

```bash
curl -i -H "Authorization: Bearer $FIREBASE_ID_TOKEN" http://localhost:8080/api/auth/me
curl -i -H "Authorization: Bearer $FIREBASE_ID_TOKEN" http://localhost:8080/api/users/me
```

Export `FIREBASE_ID_TOKEN` in the shell first. The latter endpoint should return the same `id` on repeated requests for the same account. Avoid logging tokens, passwords or refresh tokens.

The remaining release verification is a real upload → process → correct → preview → share → anonymous view → revoke flow against the compatible PostgreSQL-backed backend, preferably also on a mobile browser. Automated mock and intercepted-request tests do not replace this check.

## Maps and photo metadata

### Interactive map

MapMory uses Leaflet to display photos geographically.

The owner map supports markers, filtering, place search and viewport requests; the public map uses bounded server-side clusters. The public response is capped, and a truncation notice explains that not all matches may be shown at once.

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

The image also takes `VITE_API_URL` and the four `VITE_FIREBASE_*` settings as build args. Left empty, it serves the mock data with the demo sign-in. The `deploy` job passes each one from the Actions variable of the same name and refuses to build when `VITE_API_URL` is set without `VITE_FIREBASE_API_KEY`. In production, `VITE_API_URL` is `https://mapmory.app`, because Caddy serves `/api` from the same origin. Set these variables only once the API runs in database mode; the order is in [backend #53](https://github.com/TravelMapMory/mapmory-backend/issues/53).

### Photo metadata

The upload prototype accepts JPEG and PNG images up to 25,000,000 bytes (25 MB).

The browser-side EXIF reader (`src/api/exif.ts`) supports the mock implementation. The real backend extracts EXIF and generates sanitized display images during processing.

Photos without usable GPS coordinates remain available in the gallery with the `needs-location` state but do not appear on the map.

In live mode, location correction uses backend place search and a photo location patch; mock mode keeps its local simulation.

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

### API integration and boundary tests

Additional Playwright suites verify the frontend's integration with the Go backend and the separation between persistent and demonstration data.

#### Live API integration

The integration suite exercises the actual Go backend using Firebase ID tokens. It covers:

- Trip creation, retrieval, and listing, including response adaptation.
- Authentication, input validation, and error responses.
- Bidirectional trip ownership isolation between two distinct Firebase users.

Start a compatible backend checkout with PostgreSQL and `MAPMORY_ENABLE_DB_USER_RESOLUTION=true`. Set the following environment variables:

| Variable | Purpose |
|---|---|
| `MAPMORY_TEST_API_URL` | Local backend URL, e.g. `http://127.0.0.1:8080` |
| `MAPMORY_TEST_ID_TOKEN` | Firebase ID token for test account A |
| `MAPMORY_TEST_OTHER_ID_TOKEN` | Firebase ID token for test account B |

Run:

```bash
npm run test:integration
```

Tests requiring missing credentials are reported as skipped. The ownership test verifies that both tokens resolve to different application users before checking trip access in both directions.

**Use a disposable development database.** The tests create persistent trips and may leave test records behind. Never commit or publish Firebase tokens.

#### Mock/live boundary regression

The boundary suite uses isolated Vite servers to verify data-source separation. It covers mock demonstration data, live dashboard summaries, real sharing owner/recipient/public-map contracts, and signed upload flows with intercepted HTTP responses. It does not require a running Go server:

```bash
npm run test:boundaries
```

The mock-mode acceptance suite runs at desktop, tablet and phone viewports. The live client suite and actual backend integration checks complement these tests; passing intercepted-request tests does not establish end-to-end object storage, persistence, or cross-account privacy.

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

- A compatible, configured Go backend is required for live mode; live UI adapter support does not by itself guarantee server readiness.
- Only link and public sharing audiences are implemented. Public reporting and self-service account deletion are available; owner-facing moderation status and owner-selected share covers are not yet implemented. Named recipient/group sharing is not implemented.
- The owner-side pre-publication preview confirms selected photos, labels and audience, **not** a pixel-accurate reproduction of the recipient map; the backend computes the share's approximate display positions.
- Revocation blocks new recipient collection lookups. Already issued signed display-image URLs may remain usable until they expire; no original image URLs are exposed to share recipients.
- Public-map requests are bounded and may be truncated; moving or zooming the viewport retrieves another result set.
- The local filesystem backend storage option is a separate development-only backend change, not something configured by the frontend alone. GCS remains an option where provisioned.
- Full live upload/correction/share/revocation and real mobile-device testing must be performed against the configured backend before release.

## References and credits

The design document is the source of truth for the application's intended screens, behavior, and architecture. The OpenAPI specification defines the backend API contract.

The planned production stack includes PostgreSQL, Google Cloud Storage with signed URLs, Firebase Auth, and Google Cloud Run.

Icons are provided by `lucide-react`, with status information represented through both text and iconography.

Sample photographs in `src/assets/pins/` are sourced from Wikimedia Commons. Their authors and licenses are documented in [CREDITS.md](CREDITS.md).
