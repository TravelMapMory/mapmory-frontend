# Environment and local setup

This guide covers the frontend's mock mode, persistent live mode, and Firebase Authentication emulator. It supplements the [README](../README.md) and [API modes](api-modes.md). The Go backend has its own [environment setup guide](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md); backend credentials, databases, and storage are configured there, not in this repository.

## Prerequisites

- Node.js 24 and npm.
- For live mode only: a compatible running MapMory Go API, migrated PostgreSQL database, configured photo storage, and a matching Firebase project or Auth emulator.
- For browser tests: Playwright Chromium (`npx playwright install chromium`).

From the frontend repository root:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:5173>. `.env.local` is ignored by Git. Restart Vite after changing its variables.

## Configuration matrix

| Setting | Mock frontend | Live frontend | Live frontend with Auth emulator |
| --- | --- | --- | --- |
| `VITE_API_URL` | Empty | Go API origin | Go API origin |
| `VITE_FIREBASE_API_KEY` | Empty (demo sign-in) | Firebase Web API key | Non-empty emulator Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Empty | Firebase auth domain | E.g. `localhost` |
| `VITE_FIREBASE_PROJECT_ID` | Empty | Must match backend project | Must match backend emulator project |
| `VITE_FIREBASE_APP_ID` | Empty | Firebase Web app ID | Non-empty emulator app ID |
| `VITE_FIREBASE_AUTH_EMULATOR_URL` | Empty | Empty | Auth emulator URL |
| `VITE_GEOAPIFY_KEY` | Optional | Optional | Optional |

**Two independent switches:** `VITE_API_URL` selects mock versus live API requests; `VITE_FIREBASE_API_KEY` selects demo sign-in versus Firebase sign-in. A live API should be paired with real Firebase authentication (or its emulator), since owner requests require a valid Firebase ID token. Firebase-only UI testing can use the Auth emulator while leaving `VITE_API_URL` empty; trips then remain mock data.

Every `VITE_*` value is included in the browser build. Firebase Web app configuration and a browser Geoapify tile key are public client configuration, **not server secrets**. Never put passwords, Firebase ID tokens, `DATABASE_URL`, backend geocoding keys, service-account credentials, or signed URLs in `.env.local`. Production frontend variables are resolved at **build time**.

## 1. Standalone mock mode (default)

The unmodified `.env.example` already enables this mode:

```dotenv
VITE_API_URL=
VITE_FIREBASE_API_KEY=
VITE_GEOAPIFY_KEY=
```

Run `npm run dev`. The app uses demonstration sign-in and sample trips, photographs, location handling, and sharing. No backend, Firebase project, database, or photo storage is required. Mock data is for UI development: it is not durable across devices and must not be used to validate real backend authorization or persistence.

You may configure `VITE_GEOAPIFY_KEY` for Geoapify basemap tiles; leaving it empty uses the map's fallback tiles.

## 2. Persistent live mode (recommended)

First follow the [backend setup guide](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md). The backend needs a migrated PostgreSQL database, Firebase ID-token verification with the matching project, enabled database user resolution, and configured local or Google Cloud Storage photo storage. Backend secrets stay in its own local environment or secret manager.

Configure the frontend `.env.local` with the matching **Firebase Web app** values:

```dotenv
VITE_API_URL=http://127.0.0.1:8080
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_APP_ID=<firebase-web-app-id>
VITE_FIREBASE_AUTH_EMULATOR_URL=
VITE_GEOAPIFY_KEY=
```

Start the Go API from the backend repository, then run `npm run dev` from the frontend repository. In development, `vite.config.ts` proxies `/api` requests to `VITE_API_URL`; the browser sends signed-in API requests using Firebase ID tokens. Photo bytes travel directly to backend-issued signed storage URLs, so the storage endpoint must permit the frontend origin where cross-origin requests are used.

**Live mode has no mock fallback.** If the backend is unreachable, misconfigured, or missing an endpoint, the frontend shows a real error rather than inserting demonstration trips or photographs. See [API modes](api-modes.md) for the API boundary.

To smoke-test the full workflow, see [Live backend smoke test](live-backend-smoke-test.md). In brief: sign in, create a trip, upload a GPS-tagged and an unlocated JPEG/PNG, correct a location, refresh to confirm persistence, create a selected-photo link share, open it signed out, and revoke it. Public publishing requires a verified email address; private trips and link shares do not.

## 3. Firebase Auth emulator

The emulator allows Firebase sign-up, sign-in, email verification, and account-deletion testing without access to the shared Firebase project.

Start the Auth emulator in a separate terminal:

```bash
npx firebase-tools emulators:start --only auth --project demo-mapmory
```

For **auth-only frontend testing**, leave `VITE_API_URL` empty and configure:

```dotenv
VITE_API_URL=
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=demo-mapmory
VITE_FIREBASE_APP_ID=demo
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
```

Restart Vite. This exercises the real Firebase client code against the emulator, but trips and photos remain mocked. The emulator's verification links can be inspected through its local out-of-band codes endpoint; they are not sent as real emails.

For **full live integration with the emulator**, also set `VITE_API_URL` to the Go API origin and configure the backend to use the **same** Firebase project and emulator host (`FIREBASE_PROJECT_ID=demo-mapmory` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`) together with working PostgreSQL and photo storage. Do not mix emulator-issued tokens with a production Firebase project. Never set `VITE_FIREBASE_AUTH_EMULATOR_URL` in a deployed build.

## Testing

Mock and boundary tests do not require live credentials:

```bash
npm run lint
npm run build
npm run test:typecheck
npx playwright install chromium
npm run test:acceptance
npm run test:boundaries
```

For the Firebase emulator browser test, start the emulator as above and a separate Vite server configured for the emulator on port 5180, then run:

```bash
MAPMORY_TEST_FIREBASE_APP_URL=http://localhost:5180 \
MAPMORY_TEST_FIREBASE_EMULATOR_URL=http://127.0.0.1:9099 \
npx playwright test --project=integration tests/integration/firebase-emulator.spec.ts
```

For **real backend integration tests**, configure a disposable backend and provide the test runner with `MAPMORY_TEST_API_URL`, `MAPMORY_TEST_ID_TOKEN`, and, for cross-account checks, `MAPMORY_TEST_OTHER_ID_TOKEN`. These are **test-runner environment variables**, not `VITE_*` frontend settings. Obtain fresh tokens through the backend's documented local helper and load them securely; do not commit or log them. Then run:

```bash
npm run test:integration
```

Some integration tests skip when the required environment variables are absent. Confirm the test results rather than treating a skipped suite as a pass. The automated mock and intercepted-request suites do not prove that the deployed database, image storage, or geocoding is working.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Demo trips appear unexpectedly | `VITE_API_URL` is empty, or Vite was not restarted after editing `.env.local`. |
| Live pages fail instead of showing sample data | Expected when the configured API is unavailable: check the Go API, proxy target, database mode, and migrations. |
| 401 from owner endpoints | Ensure Firebase Web and backend project IDs match, the ID token is current, and both use the same Auth emulator when enabled. |
| Firebase emulator connection fails | Check the emulator port, `VITE_FIREBASE_AUTH_EMULATOR_URL`, and whether the emulator process is running. |
| Upload or display-image request fails | Check backend photo storage, signed-URL expiry, content type, storage endpoint, and CORS for cross-origin signed URLs. |
| Place search or labels unavailable | Check the backend's Geoapify configuration; `VITE_GEOAPIFY_KEY` only controls browser map tiles. |
| Integration tests report “skipped” | Set the required `MAPMORY_TEST_*` variables in the test shell and use disposable accounts and infrastructure. |
| Environment change has no effect in a deployed build | `VITE_*` settings are bundled at build time; rebuild the frontend image. |

For account-specific verification, see [Account profiles and recovery](account-profile-and-recovery.md). For live endpoint and storage checks, see [Live backend smoke test](live-backend-smoke-test.md).
