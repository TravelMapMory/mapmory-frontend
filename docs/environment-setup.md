# Environment and local setup

Choose a **scenario** before editing `.env.local`. This guide covers the React/Vite application; the [backend environment guide](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md) uses the same scenario labels. Commands assume the **frontend repository root** unless indicated otherwise.

## Choose a scenario

| Scenario | Frontend API | Sign-in | Backend / PostgreSQL needed? | Instructions |
| --- | --- | --- | --- | --- |
| **A. Mock UI only** | Mock data | Demo sign-in | No | [Scenario A](#scenario-a--mock-ui-only) |
| **B. Firebase Auth UI with mock data** | Mock data | Local Auth emulator | No | [Scenario B](#scenario-b--firebase-auth-ui-with-mock-data) |
| **C. Full local, emulated auth** | Real Go API | Local Auth emulator | Yes | [Scenario C](#scenario-c--full-local-stack-with-firebase-auth-emulator) |
| **D. Full local, real auth** | Real Go API | Real development Firebase | Yes | [Scenario D](#scenario-d--full-local-stack-with-real-firebase) |
| **E. GCS-backed integration** | Real Go API | Same as C or D | Yes + private GCS | [Scenario E](#scenario-e--gcs-backed-integration) |
| **F. Automated tests** | Depends on test | Depends on test | Usually no; live tests yes | [Testing](#testing-by-dependency) |

**Two independent switches:** `VITE_API_URL` selects **mock vs real API**; `VITE_FIREBASE_API_KEY` selects **demo vs Firebase sign-in**. A real API expects Firebase ID tokens, so pair live mode with real Firebase or the Auth emulator. Starting an API alone does not turn off mock mode: `VITE_API_URL` must be set and Vite restarted.

## External services for a full setup

For **C–E**, configure the backend and external dependencies **before** starting the live frontend. The [backend external-services checklist](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md#external-services-and-credentials-for-a-full-setup) gives the credential sources and setup details.

| Service | Needed for | Where configuration belongs | Can you skip it? |
| --- | --- | --- | --- |
| **Firebase Authentication** | Real account sign-in and API ID tokens | Frontend `.env.local`: four `VITE_FIREBASE_*` Web app settings; backend `.env`: matching `FIREBASE_PROJECT_ID`. For C, use the Auth emulator on both sides. | No for C–E; choose emulator (C) or development Firebase project (D). |
| **PostgreSQL** | Persistent trips, users, photo metadata and sharing | Backend `DATABASE_URL`; apply Goose migrations | No for C–E; local Docker is the default. Supabase is an optional managed PostgreSQL host for authorized development, **not required** for local setup. |
| **Photo storage** | Signed uploads and image display | Backend `MAPMORY_PHOTO_STORAGE=local` or `gcs` | No; local filesystem is sufficient for C/D, private GCS bucket is needed only for E. |
| **Geoapify geocoding** | Automatic place labels and place search | **Backend only:** `GEOAPIFY_API_KEY` | Yes for basic upload; **no** if testing the complete geographic workflow. Obtain a project API key in the Geoapify dashboard. |
| **Geoapify map tiles** | Optional branded browser basemap | **Frontend only:** `VITE_GEOAPIFY_KEY` | Yes; fallback basemaps work without it. It is browser-visible, unlike backend `GEOAPIFY_API_KEY`. |
| **Google Cloud ADC / GCS IAM** | Real Firebase Admin initialization (D) or signed GCS storage (E) | Developer/cloud identity, not frontend Vite variables | Not needed for the default emulator + local-storage workflow C. |

**Recommended for newcomers:** Use **C** for ordinary end-to-end development. Authorized team members may use **D** with `mapmory-development`; external contributors can use their own Firebase development project by configuring matching frontend and backend project IDs and their own backend credentials. Use **E** only to test GCS. For automatic labels and place search in C or D, obtain and set the backend Geoapify key; leaving it blank is supported but does not exercise those features. Supabase is used for deployment but is not needed in a local setup.

## Prerequisites and config files

- Node.js **24** and npm; Playwright Chromium for browser tests.
- For C–E: running Go backend, migrated PostgreSQL database, and local or GCS photo storage (see [backend guide](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md)).
- For B or C: Firebase CLI (`npx firebase-tools`); for D: Firebase Web app configuration from `mapmory-development`.

Run once from the **frontend repository root**:

```bash
npm ci
cp -n .env.example .env.local
npx playwright install chromium  # only needed for browser tests
```

Edit `.env.local` using one of the scenario blocks below. The file is Git-ignored; restart `npm run dev` after edits. For scenario switching, **clear old values** (especially `VITE_API_URL` and `VITE_FIREBASE_AUTH_EMULATOR_URL`) instead of leaving conflicting settings. Any `VITE_*` setting is embedded into the browser bundle, **not secret**. Never put passwords, ID tokens, `DATABASE_URL`, backend Geoapify keys, or Google credentials in it.

### Frontend settings by scenario

| `.env.local` setting | A — mock | B — auth-only emulator | C — live + emulator | D — live + real Firebase |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | Empty | Empty | `http://127.0.0.1:8080` | `http://127.0.0.1:8080` |
| `VITE_FIREBASE_API_KEY` | Empty | `demo-api-key` | `demo-api-key` | Real Firebase Web key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Empty | `localhost` | `localhost` | Real auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Empty | `demo-mapmory` | `demo-mapmory` | `mapmory-development` |
| `VITE_FIREBASE_APP_ID` | Empty | `demo` | `demo` | Real Firebase Web app ID |
| `VITE_FIREBASE_AUTH_EMULATOR_URL` | Empty | `http://127.0.0.1:9099` | Same | **Empty** |
| `VITE_GEOAPIFY_KEY` | Optional | Optional | Optional | Optional |

`VITE_GEOAPIFY_KEY` is an optional **public browser map-tile key**; see the [external services table](#external-services-for-a-full-setup). Scenario E uses the frontend values from C or D: photo storage is configured in the backend.

## Scenario A — Mock UI only

In **frontend `.env.local`**:

```dotenv
VITE_API_URL=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_AUTH_EMULATOR_URL=
VITE_GEOAPIFY_KEY=
```

In **terminal 1**:

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Open <http://localhost:5173>. Demo sign-in and sample trips/photos/shares work **without** Go, Firebase, PostgreSQL, or photo storage. This mode does **not** verify backend ownership, persistence, or real signed uploads.

## Scenario B — Firebase Auth UI with mock data

This tests real Firebase Web SDK authentication flows against a **local emulator**, while trips and photos remain mocked. In `.env.local`:

```dotenv
VITE_API_URL=
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=demo-mapmory
VITE_FIREBASE_APP_ID=demo
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
VITE_GEOAPIFY_KEY=
```

In **terminal 1**, start Firebase Auth emulator:

```bash
npx firebase-tools emulators:start --only auth --project demo-mapmory
```

In **terminal 2**, start Vite:

```bash
npm run dev -- --host localhost --port 5173 --strictPort
```

Open <http://localhost:5173>, then register or sign in with a disposable emulator user. This does **not** require a backend. For the **dedicated automated emulator test**, use port `5180` as described under [Testing](#testing-by-dependency); do not use `5180` for full signed-photo integration.

## Scenario C — Full local stack with Firebase Auth emulator

This is the most self-contained **end-to-end** development scenario: persistent trips and uploaded photos, emulator test users, no real Firebase project or GCS bucket.

1. Follow [backend scenario C](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md#scenario-c--full-local-stack-with-firebase-auth-emulator): start PostgreSQL, apply Goose migrations, configure `MAPMORY_PHOTO_STORAGE=local`, start the Auth emulator, and start Go with `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.
2. In **frontend `.env.local`**, set:

   ```dotenv
   VITE_API_URL=http://127.0.0.1:8080
   VITE_FIREBASE_API_KEY=demo-api-key
   VITE_FIREBASE_AUTH_DOMAIN=localhost
   VITE_FIREBASE_PROJECT_ID=demo-mapmory
   VITE_FIREBASE_APP_ID=demo
   VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
   VITE_GEOAPIFY_KEY=
   ```

3. In the **frontend terminal**, start Vite:

   ```bash
   npm run dev -- --host localhost --port 5173 --strictPort
   ```

4. Open <http://localhost:5173>, create an emulator account, create a trip, upload a JPEG or PNG, refresh to verify persistence, correct a location, and create/open a share.

**Port choice matters:** the backend's loopback signed-photo endpoint allows browser origins on ports `5173`, `5174`, and `4173`. Port `5180` is dedicated to **authentication-only** tests and will not work for the full upload flow without changing backend development CORS rules. Vite proxies `/api` requests to `VITE_API_URL`, while signed photo requests go directly to their returned URL.

## Scenario D — Full local stack with real Firebase

Use a **real Firebase development project** while keeping PostgreSQL and photo storage local. The example uses the team's `mapmory-development` project and requires granted access. External contributors can use their **own** Firebase project; substitute its project ID and Web app configuration below, and configure the backend to verify the same project using their own Admin credentials/ADC.

1. Follow [backend scenario D](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md#scenario-d--full-local-stack-with-real-firebase), including appropriate ADC and a `FIREBASE_PROJECT_ID` matching the frontend. The documented impersonation identity is **team-only**; ensure the emulator host is **unset**.
2. In **frontend `.env.local`**, use the Firebase Web app identifiers from your chosen development project (from the team administrator or your own Firebase Console). The placeholders below are **not valid values**; replace `mapmory-development` too if using your own project:

   ```dotenv
   VITE_API_URL=http://127.0.0.1:8080
   VITE_FIREBASE_API_KEY=<firebase-web-api-key>
   VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
   VITE_FIREBASE_PROJECT_ID=mapmory-development
   VITE_FIREBASE_APP_ID=<firebase-web-app-id>
   VITE_FIREBASE_AUTH_EMULATOR_URL=
   VITE_GEOAPIFY_KEY=
   ```

3. Run Vite from the frontend root:

   ```bash
   npm run dev -- --host localhost --port 5173 --strictPort
   ```

4. Open <http://localhost:5173> and sign in with a **disposable real development account**. Confirm that trips and photos persist across refreshes. Do not use emulator-issued tokens with real Firebase.

Google **ADC** is a backend/cloud identity; the browser needs the **Firebase Web app configuration** and obtains a different **Firebase user ID token** after sign-in. Do not paste ADC files or service-account credentials into `.env.local`.

## Scenario E — GCS-backed integration

Follow C or D for Firebase and frontend settings. In the **backend**, change `MAPMORY_PHOTO_STORAGE=gcs`, set a private `MAPMORY_PHOTO_BUCKET`, and supply signing/storage IAM permissions and GCS bucket CORS. See [backend scenario E](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/environment-setup.md#scenario-e--use-private-gcs-instead-of-local-photo-storage). **No new frontend setting is needed.** Signed upload URLs will target GCS instead of the loopback photo endpoint.

## Testing by dependency

| Test | Infrastructure needed | Commands (frontend root) |
| --- | --- | --- |
| Lint, typecheck, build | None | `npm run lint` ; `npm run test:typecheck` ; `npm run build` |
| Mock acceptance tests | Playwright Chromium; starts a mock Vite server automatically on `4173` | `npm run test:acceptance` |
| Mock/live boundary checks | Playwright Chromium, config starts its own test server | `npm run test:boundaries` |
| Firebase emulator **auth-only** test | Emulator + separate Vite on `5180` | See below |
| Real backend integration | Disposable backend + valid test user tokens | `npm run test:integration` |

For the **auth-only emulator browser test**, start the emulator from Scenario B. Then, in a **second terminal** in the frontend root, launch a separate Vite instance on `5180` using explicit values that override `.env.local`:

```bash
VITE_API_URL= \
VITE_FIREBASE_API_KEY=demo-api-key \
VITE_FIREBASE_AUTH_DOMAIN=localhost \
VITE_FIREBASE_PROJECT_ID=demo-mapmory \
VITE_FIREBASE_APP_ID=demo \
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099 \
npx vite --host localhost --port 5180 --strictPort
```

In a **third terminal**, run the focused test:

```bash
MAPMORY_TEST_FIREBASE_APP_URL=http://localhost:5180 \
MAPMORY_TEST_FIREBASE_EMULATOR_URL=http://127.0.0.1:9099 \
npx playwright test --project=integration tests/integration/firebase-emulator.spec.ts
```

This test runs against **mock trips and photos** and needs no backend. Do not interpret it as testing full live uploads.

For real backend integration tests, configure disposable infrastructure and obtain fresh Firebase ID tokens for two separate test users using the [backend token helper](https://github.com/TravelMapMory/mapmory-backend/blob/main/docs/firebase-auth-testing.md). Provide `MAPMORY_TEST_API_URL`, `MAPMORY_TEST_ID_TOKEN`, and, for cross-account checks, `MAPMORY_TEST_OTHER_ID_TOKEN` in the **test runner's shell** (not `.env.local`):

```bash
# Set MAPMORY_TEST_* variables securely in this shell first.
npm run test:integration
```

Some integration tests **skip** if tokens or endpoints are absent. Check the results; skipped tests do not confirm a working live backend. For a manual end-to-end checklist, see [Live backend smoke test](live-backend-smoke-test.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Demo trips appear unexpectedly | `VITE_API_URL` empty or Vite not restarted. |
| Live page shows errors | Expected if Go API/DB/photo storage unavailable; there is no mock fallback in live mode. |
| Sign-in returns `401` from API | Frontend/backend project IDs and emulator settings must match. Refresh expired user tokens. |
| Auth emulator cannot connect | Is port `9099` running? Is `VITE_FIREBASE_AUTH_EMULATOR_URL` set? |
| Upload URL blocked by CORS | Use port `5173` for local signed-photo storage, not auth-only `5180`; verify object URL and storage CORS. |
| Place labels/search missing | Backend `GEOAPIFY_API_KEY` is separate from frontend `VITE_GEOAPIFY_KEY`. |
| Tests skipped | Set required `MAPMORY_TEST_*` environment variables in the test shell. |
| Environment change not reflected in deployed build | `VITE_*` values are captured at build time; rebuild the image. |

See [API modes](api-modes.md), [Account profiles and recovery](account-profile-and-recovery.md), and [Live backend smoke test](live-backend-smoke-test.md).
