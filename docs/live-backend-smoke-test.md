# Real backend smoke test (PR #48)

This procedure validates actual Firebase/PostgreSQL/photo-storage/sharing integration. The existing mock, boundary and intercepted HTTP suites cannot replace it.

## Setup

1. Use a **disposable development PostgreSQL database** and **disposable Firebase accounts**. The automated test creates trip/photo/share records; it does not delete them. Apply backend Goose migrations through `00007`.
2. In the backend, enable `MAPMORY_ENABLE_DB_USER_RESOLUTION=true`, set `DATABASE_URL`, and choose working `MAPMORY_PHOTO_STORAGE=local` (separate local-storage backend branch) or configured GCS. Set `FIREBASE_PROJECT_ID` and matching Firebase credentials. Start `go run ./cmd/server`.
3. In frontend `.env.local`, configure `VITE_API_URL=http://127.0.0.1:8080` and a matching Firebase web app (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`). Restart Vite.
4. Get a short-lived Firebase **user ID token** using the existing backend `scripts/firebase-id-token.sh` helper. Do not commit, print into a public log or paste it into chat. Export the token in the test shell; shell history should not contain token values. Use a second test account token for the optional cross-account check.

```bash
export MAPMORY_TEST_API_URL=http://127.0.0.1:8080
# Securely load MAPMORY_TEST_ID_TOKEN into the environment from your local setup.
# Optionally set MAPMORY_TEST_OTHER_ID_TOKEN to another account's ID token.
npx playwright test --project=integration tests/integration/live-upload-sharing.spec.ts
```

The test fails if no backend is reachable or if the required live services are incorrectly configured **once the environment variables are provided**. When absent, the test is skipped. To ensure it actually ran, check for `1 passed` rather than `1 skipped`.

## Automated coverage

- Health and authenticated database mode (an unsigned trip listing must return 401).
- Register and upload two real fixture images via signed PUT with no Firebase header; process both and fetch a signed display JPEG.
- Verify the GPS photo is located, the no-metadata photo needs correction, and both are persisted in the trip gallery.
- Create a one-photo link share; anonymously fetch only that image, with no original EXIF/owner-only fields; ensure the link share is not publicly addressable by ID.
- Optionally verify that a second Firebase account cannot read the trip.
- Revoke the link and verify fresh lookups return 410.
- Create a public share, retrieve it without credentials, revoke it and verify a subsequent public detail lookup returns 404.

The test intentionally does not inspect filesystem internals or assert that previously issued signed display URLs stop working at revocation. Those URLs are independently time-limited. Geocoding is provider-dependent and requires separate testing.

## Browser acceptance checklist

Run `npm run dev` and use the actual live frontend (not acceptance-test mode):

- [ ] Sign in with the same Firebase account and open the persisted trip created by the API test.
- [ ] Upload another photo through the browser and see per-file upload/processing states; refresh and verify persistence.
- [ ] Select the unlocated photo, choose **Set location**, save a manual location and refresh. Configure Geoapify if required by the running backend; verify city/place data and owner map position.
- [ ] In **Sharing**, select only intended photos, choose an audience, and inspect the pre-publication preview. Back to edit and verify selections persist.
- [ ] Create a link share, copy the URL, open it in a private browser without signing in, and inspect the selected image and approximate map position.
- [ ] Revoke it and refresh the anonymous recipient page: it should show the revoked state.
- [ ] Publish a public share, browse `/map/public` near its approximate location and open its public detail; revoke and refresh. A crowded or truncated cluster response can omit a newly added share, so check the API detail response if necessary.
- [ ] Repeat the recipient flow in mobile viewport/device and check keyboard focus/escape navigation.

## Troubleshooting

| Symptom | Likely cause / check |
|---|---|
| Signed PUT fails | The local storage branch is not running, signed URL points to wrong host, content-type or byte size differs, or the URL expired |
| Upload completes but display image fails | Storage signer, local file permissions, URL expiry or browser CORS |
| 401 on owner endpoints | Expired/incorrect Firebase ID token or mismatched Firebase project/emulator |
| 404 on `/api/users/me` or unsigned trip listing succeeds | Database mode is disabled; this is not the real persisted API |
| Sharing endpoint absent | Backend PR #58 not present or migration 00007 missing |
| Place search unavailable | `GEOAPIFY_API_KEY` not configured or provider unavailable |
| New share not on public map | Wrong viewport, share not public, cluster result truncated or public backend mode unavailable |

Avoid including Firebase tokens, signed URLs, original photos or local `.env` files in issue/PR logs.
