# MapMory frontend

React, TypeScript, Vite and Leaflet client for [MapMory](https://mapmory.app), a photo-first travel-memory application. Organize trips, browse photos on a map, correct locations and share selected memories. The Go API lives in the [backend repository](https://github.com/TravelMapMory/mapmory-backend).

The frontend supports **mock mode** (no accounts or services) and **live mode** (Firebase Authentication and the persistent Go API). Live mode does not silently fall back to demonstration records if the backend fails.

## Quick start

**Requirements:** Node.js 24 and npm. No Firebase, PostgreSQL, Go server or cloud credentials are required for mock mode.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. The example configuration intentionally leaves `VITE_API_URL` and `VITE_FIREBASE_API_KEY` empty, enabling demo sign-in and mock trip/photo data. Mock content is not shared or persisted across devices.

For **live development**, first configure and start the [backend](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md), then add its URL and matching Firebase Web app settings to `.env.local`. See [Environment and local setup](docs/environment-setup.md) for a step-by-step live and emulator setup. Restart Vite after changing environment variables.

## Configuration

Copy `.env.example` to `.env.local` (ignored by Git). The following are the application-facing settings; the [environment guide](docs/environment-setup.md) explains the complete setup and testing variables.

| Variable | Required for | Meaning |
| --- | --- | --- |
| `VITE_API_URL` | Live backend mode | Go API origin, typically `http://127.0.0.1:8080`; **empty = mock API** |
| `VITE_FIREBASE_API_KEY` | Real Firebase sign-in | Public Firebase Web API key; **empty = demo sign-in** |
| `VITE_FIREBASE_AUTH_DOMAIN` | Real Firebase sign-in | Firebase Web authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Real Firebase sign-in | Must match backend `FIREBASE_PROJECT_ID` |
| `VITE_FIREBASE_APP_ID` | Real Firebase sign-in | Firebase Web application ID |
| `VITE_FIREBASE_AUTH_EMULATOR_URL` | Optional local emulator | Firebase Auth emulator origin; never set in production |
| `VITE_GEOAPIFY_KEY` | Optional map tiles | Browser tile key; fallback tiles are used when unset |

All four core Firebase Web variables must be configured together for real sign-in. **Every `VITE_*` setting is embedded in the browser bundle**: do not put database URLs, server-side Geoapify keys, ID tokens, passwords or service-account credentials in this file. Vite settings are resolved at *build time*, not container startup.

### Development scenarios

| Scenario | What it tests | External services |
| --- | --- | --- |
| **A. Mock UI** | Interface with sample data (default) | None |
| **B. Auth UI with mock data** | Firebase sign-in screens | Local Firebase Auth emulator; no backend |
| **C. Full local (recommended)** | Persistent upload → correct → share | Go API, PostgreSQL, local photo storage and Auth emulator; optional Geoapify key |
| **D. Real Firebase** | Full local app with real development authentication | Same as C, using team development Firebase + authorized backend ADC |
| **E. GCS integration** | Real signed cloud uploads | Same as C or D, plus a private development GCS bucket and signing permissions |
| **F. Tests** | Automated test suites | Depends on suite; some live tests skip without configured infrastructure |

See the [scenario-by-scenario setup guide](docs/environment-setup.md) and its [external-services table](docs/environment-setup.md#external-services-for-a-full-setup) for configuration sources and exact commands. **Scenario C is the recommended full local workflow.** For automatic labels and place search, set the **backend** `GEOAPIFY_API_KEY`; the optional frontend `VITE_GEOAPIFY_KEY` only selects map tiles.


In live mode, the backend enforces ownership using the verified Firebase ID token; the browser never supplies a trusted PostgreSQL user UUID. Unverified users may manage private trips and link shares, but public publication requires email verification.

## Architecture and features

| Area | Behavior |
| --- | --- |
| Authentication | Firebase email/password sign-up, login, verification, display-name editing and password recovery; demo sign-in in mock mode |
| Trips and dashboard | Persistent owner-scoped trips, counts, recent uploads and editing in live mode; sample data in mock mode |
| Photos | Signed-URL uploads, processing status, paginated gallery, journey and map views |
| Places | EXIF-derived locations, place search, manual correction and geographic filters |
| Sharing | Link-only collections, public discovery, recipient galleries, revocation and public reporting |
| Public map | Viewport-bounded discovery of publicly shared collections |

Pages use the History API router in `src/router.ts`: `/` (landing), `/signup`, `/login`, `/dashboard`, `/map`, `/trips/{id}`, `/s/{token}`, `/map/public` and `/public/{id}`. Owner pages require sign-in; share-link and public pages are accessible to their intended anonymous audiences. Direct links and browser history are supported.

UI screens call `src/api/client.ts`, which selects `src/api/mock.ts` or the live HTTP client (`src/api/http.ts`). `src/api/adapters.ts` converts backend responses to frontend view models; screens should not bypass this boundary. In live mode, photo originals are uploaded to storage-signed URLs, not through the `/api` JSON proxy. See [API modes](docs/api-modes.md) for the mock/live contract and [backend OpenAPI](https://github.com/TravelMapMory/mapmory-backend/blob/main/openapi/openapi.yaml) for server endpoints.

## Development and testing

```bash
npm run lint                 # oxlint
npm run build                # TypeScript check + production build
npm run test:typecheck       # TypeScript checks for tests
npx playwright install chromium
npm run test:acceptance      # Desktop, tablet and phone mock-mode tests
npm run test:boundaries      # Mock/live isolation; no real backend required
```

`npm run test:acceptance:ui` opens the interactive runner. `npm run test:integration` exercises a **real** Go API with disposable Firebase accounts and a migrated test database; it needs `MAPMORY_TEST_API_URL`, `MAPMORY_TEST_ID_TOKEN` and `MAPMORY_TEST_OTHER_ID_TOKEN` in the test runner environment. Missing live credentials cause applicable integration tests to skip; **check the Playwright report**, because a successful command exit with skipped cases does not establish that live integration was exercised. Never commit tokens. See [Acceptance coverage](tests/docs/acceptance-coverage.md), [API modes](docs/api-modes.md) and [Coding conventions](docs/coding-conventions.md).

The browser suites do not replace end-to-end testing against real Firebase, PostgreSQL, photo storage and mobile devices.

## Deployment

The production frontend is served as static assets from an nginx container behind Caddy on the MapMory VM, alongside the Go API. `docker build -t mapmory-frontend .` builds the image; `docker run --rm -p 8080:8080 mapmory-frontend` runs it on the default port. The nginx server supports SPA fallback; `PORT` controls its listener. Vite variables must be provided **when building the image**. See [backend deployment](https://github.com/TravelMapMory/mapmory-backend/blob/main/deploy/README.md).

MapMory includes optional standalone PWA metadata and icons. This does **not** enable offline caching or push notifications.

## Known limitations

- **iOS installed-app input defect (unresolved):** On a tested iPhone, text fields fail to receive focus in standalone Home Screen mode, despite working in Safari. Use Safari on affected devices. See [Standalone installation](docs/standalone-install.md); do not mark standalone iOS login verified.
- Live use requires a compatible, configured Go backend; a working Firebase sign-in alone does not establish backend readiness.
- Only link and public sharing are supported, not named recipients or groups. Reported public shares are hidden from discovery pending moderation; a recipient's previously issued signed display URL may remain usable until expiry.
- Live upload, sharing and mobile-device flows require smoke testing against the deployed infrastructure. No offline service worker or background synchronization is provided.

## Documentation and credits

- [Environment and local setup](docs/environment-setup.md) — required/optional variables and complete mock/live setup
- [API modes](docs/api-modes.md) — live and mock boundaries, integration guidance
- [Account profiles and recovery](docs/account-profile-and-recovery.md) — Firebase account management verification
- [Standalone installation](docs/standalone-install.md) — PWA installation and iOS limitation
- [Live backend smoke test](docs/live-backend-smoke-test.md) — deployed functionality checks
- [Dependency audit](docs/dependency-audit.md) and [Coding conventions](docs/coding-conventions.md)
- [Credits](CREDITS.md) — sample photograph attribution and licenses

The [backend repository](https://github.com/TravelMapMory/mapmory-backend) contains the authoritative API contract, database, storage and deployment documentation. UI icons use `lucide-react`.
