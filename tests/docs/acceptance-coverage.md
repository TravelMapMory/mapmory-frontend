# UI acceptance coverage

The suite checks the implemented mock prototype, starting from commit `dd24c14`.
Each E2E scenario runs in Chromium at desktop (1440 × 900), tablet (768 × 1024)
and phone (390 × 844) widths. The byte-limit boundary runs once on desktop.
Phone emulation is not a real iOS/Safari test.

Run `npm run test:typecheck`, `npm run test:acceptance` and `npm run build`.
Install Chromium first with `npx playwright install chromium`.
`npm run test:acceptance:ui` opens the interactive runner; `npx playwright show-report`
opens the last HTML report. Failed tests retain a screenshot and trace.

## Controls and visible outcomes

| Area | Assertions | File |
| --- | --- | --- |
| Main navigation | Dashboard/Map transitions, keyboard activation and visible focus | `acceptance.spec.ts`, `keyboard-and-layout.spec.ts` |
| Dashboard totals/cards/recent photos | Seeded totals, newest-first cards, recent upload order, empty collections, counts after upload/correction | `dashboard.spec.ts`, `upload-controls.spec.ts`, `trip-and-correction.spec.ts` |
| Create trip | Blank/whitespace validation, trimming, max length, private empty trip, Cancel/Escape, failed creation retry, duplicate submission prevention | `dashboard.spec.ts`, `keyboard-and-layout.spec.ts` |
| Dashboard upload | Destination selection, Cancel/Escape, file selection opens correct trip, totals refresh | `dashboard.spec.ts`, `upload-controls.spec.ts` |
| Trip card actions | Every seeded card opens the correct Trip and Map filter | `dashboard.spec.ts` |
| Map filters | Place/country/trip text, case and whitespace, inclusive From/To, combined filters, Clear filters, latest query wins, missing capture dates | `map-controls.spec.ts`, `keyboard-and-layout.spec.ts` |
| Map empty/error states | Empty owner collection, unlocated and partly located trips, correction route, zero matches including selected trip, read retry | `map-controls.spec.ts` |
| Map interaction | Zoom in/out, pan, cluster expansion, unsplittable cluster opening, Enter/Space activation | `map-controls.spec.ts`, `acceptance.spec.ts` |
| World search | Independent from photo filters, suggestion click, arrows/Enter/Escape, minimum query length, no results, failure/retry, Clear and focus, stale suggestion prevention | `map-controls.spec.ts`, `keyboard-and-layout.spec.ts` |
| Photos at a place | Country/city separation, photo previous/next and wrap, keyboard arrows, counter, trip previous/next and wrap, single-photo controls, Open trip, Close/Escape | `map-controls.spec.ts`, `acceptance.spec.ts`, `keyboard-and-layout.spec.ts` |
| Trip navigation/views | Back, Show on map, Gallery/Journey pressed states, Upload toggle, dated/undated sections, empty trip, loading/read failures and retries | `trip-and-correction.spec.ts` |
| Photo state/action presentation | Processing states, ready, missing location, failure; appropriate Change/Set/Review actions | `trip-and-correction.spec.ts` |
| Location correction | Review next, confirm suggested label, current location, keyboard search, previous-photo location, click/drag pin, Save/Cancel/Escape, save retry, preserved capture metadata, updated totals/map | `trip-and-correction.spec.ts`, `acceptance.spec.ts` |
| Upload input/progress | JPEG/PNG, missing EXIF, GPS/capture time, invalid dates, malformed image, HEIC, invalid type, exact byte limit, independent mixed results, queued files, progress completion | `upload.spec.ts`, `upload-controls.spec.ts` |
| Upload actions/lifetime | Retry, Set location updates row/gallery, drag/drop, append file selection, close/reopen during processing, reload clears mock uploads | `upload.spec.ts`, `upload-controls.spec.ts` |
| Keyboard/layout | Tab reachability and visible rings, keyboard actions, overflow/control bounds on normal/expanded/long-content screens, overlapping photo controls | `acceptance.spec.ts`, `keyboard-and-layout.spec.ts`, `dashboard.spec.ts` |
| Metadata/place helpers | Invalid dates, leap days, wall-clock preservation, country/city keys | `checks/metadata-and-places.spec.ts` |

Every E2E test rejects uncaught browser errors. External tile/image requests are
blocked so provider availability cannot change the outcome. Consequently these
tests do not verify that external images/tiles actually load or attribution links
resolve. Static labels and decorative icons are checked through their associated
states; they are not treated as clickable controls.

## Deterministic scenarios

`boot(page, options)` installs `__MAPMORY_ACCEPTANCE__` before importing the app.
The hook only runs when both Vite development mode and `VITE_ACCEPTANCE_TESTS=true`
are enabled. The Playwright server supplies that flag; normal development and
production builds do not enable these scenarios.

Scenarios: empty collection, empty trip, all unlocated, same city in two countries
with multiple trips, long content, every photo state, and all-undated photos.
`failNext` causes a named read/save to fail once, before mutation. Optional latency
makes loading/saving states observable. This is function-level mock injection,
not HTTP interception or an integration test of Go/Firebase/GCS.

## Deliberately outside this suite

- Unimplemented title/notes editing and full-photo gallery viewing.
- Production registration identity, concurrent completion, interrupted processing,
  persistence and expired signed URL renewal. The temporary mock still has the
  documented cross-trip deduplication and concurrent duplicate limitations.
- Large-dataset viewport retrieval and the 2,000-marker truncation behavior.
- Real EXIF preservation through mobile photo selection and provider geocoding
  accuracy; browser extraction and fixed-city resolution remain demo stand-ins.
- Agreed backend pagination, capture-order policy, timezone display/editing,
  authentication and sharing/access models.
- A full accessibility audit, real touch-device testing, Firefox or Safari.

The tests enforce current intended behavior; passing them does not make the mock
ready for production integration.
