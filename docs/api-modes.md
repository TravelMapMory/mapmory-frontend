## Mock and Live API Modes

MapMory's frontend supports **mock mode** for standalone UI development and **live mode** for real requests to the Go backend. These modes are selected solely by `VITE_API_URL`; backend database and storage flags are separate decisions.

### Selecting a mode

For mock mode, remove or comment out the variable in `.env.local` (an empty value also disables it):

```dotenv
# VITE_API_URL=http://127.0.0.1:8080
```

For live mode:

```dotenv
VITE_API_URL=http://127.0.0.1:8080
```

Restart Vite after changing the environment. The `.env.example` template currently provides an API URL, so **copying it unchanged selects live mode**; comment that value out to get standalone demonstration data.

### Behavior by mode

| Area | Mock mode | Live mode |
|---|---|---|
| Identity | Demo sign-in if Firebase is not configured | Firebase ID token required for owner operations; same frontend authentication configuration applies |
| Trips and Dashboard | Predefined, editable in-browser examples | Persisted, owner-scoped trips and backend dashboard summary |
| Photo uploads | Simulated per-file status and EXIF | Batch registration, signed PUT, processing completion and status recovery |
| Photos and locations | Mock gallery, maps, search and corrections | Paginated gallery, owner map, place search and persisted corrections |
| Share management | Browser-local create/list/revoke | Authenticated `GET`/`POST /api/trips/{id}/shares`, `DELETE /api/shares/{id}` |
| Recipient view | Simulated `/s/{token}` collection | Anonymous `GET /api/s/{token}` returning only selected sanitized display images and coarse positions |
| Public discovery | Demo `/map/public` and `/public/{id}` | Anonymous `GET /api/public/map` and `GET /api/public/shares/{id}` |
| Revocation | Simulated UI behavior | Server-side invalidation of future collection requests |

The interface includes a **two-step creation flow**: select photos/title/audience, then review the selected thumbnails and audience before publishing. The owner-side preview is not the backend's final location rendering; the recipient sees server-coarsened positions.

Link shares can be opened by anyone possessing the unguessable link, without signing in. Public shares can also be discovered via the public map. All other trip photos remain private. The frontend supports public-share reporting, trip deletion, and account deletion when the compatible backend endpoints are available. Reported public shares are hidden pending manual moderation; the owner-facing review status is not yet exposed. Named users/groups and owner-selected share covers are not implemented.

### Prerequisites for live integration

A compatible backend must provide:

- Firebase Auth ID-token verification and matching frontend Firebase project (or a matching local Auth emulator).
- PostgreSQL, `MAPMORY_ENABLE_DB_USER_RESOLUTION=true`, and all required Goose migrations, including the sharing schema.
- Owner trip/photo/map and upload endpoints, place search/correction, plus backend PR #58's sharing and public endpoints.
- Working photo object storage and signed URL generation. This can be GCS with the necessary permissions, **or** the development-only local filesystem adapter from the separate backend branch if installed and tested. Do not set `MAPMORY_PHOTO_STORAGE=local` against a backend that lacks that adapter.

The browser uses Vite's `/api` development proxy for JSON requests. Image and upload bytes use backend-issued signed URLs; if these resolve to a different origin, that storage endpoint must allow the frontend's origin. Local files are not served by the frontend directly.

### Backend persistence does not select frontend mode

| Frontend | Backend | Result |
|---|---|---|
| `VITE_API_URL` unset | Not running or any mode | Mock demo records and simulated sharing |
| `VITE_API_URL` set | Missing/unavailable endpoints | Real requests fail or show errors; **no mock fallback** |
| `VITE_API_URL` set | Compatible database-backed backend with storage | Real trips, photo uploads, corrections and persisted shares |

### Testing

Mock and intercepted HTTP tests:

```bash
npm run test:acceptance
npm run test:boundaries
```

The boundary suite includes owner-scoped share CRUD, anonymous recipient and public-share access, public-map data boundaries and upload request flows. These tests do **not** require PostgreSQL or GCS and do not establish that an actual backend is operational.

With a disposable local PostgreSQL database, Firebase accounts and working storage, manually check the full live workflow:

1. Sign in, create a trip and upload both a GPS-tagged photo and a photo with missing GPS.
2. Wait for processing, correct a location, reload and verify persistence.
3. Select processed photos, review the preview, then publish a link share.
4. Open the token URL in a signed-out/private browser; confirm only chosen images and approximate positions are shown.
5. Revoke the share and verify a fresh lookup fails. Remember previously issued signed display URLs may remain usable until their expiry.
6. Create a public share, confirm it appears in the public map viewport, then revoke it and verify it disappears.
7. If possible, repeat recipient viewing from a phone and test using two separate owner accounts.

Never commit `.env.local`, Firebase tokens, local photo files or passwords. The mock and HTTP-intercepted suites are complementary to—not replacements for—this live smoke test.
