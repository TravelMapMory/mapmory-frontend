# Dependency audit

Date: 26 Nov 2026 (frontend issue #60).

## What `npm audit` reported

Five high-severity findings on `main`, in two groups:

| Package | Path | Advisories | Fix |
| --- | --- | --- | --- |
| `vite` 8.3.0 - 8.3.2 | direct dev dependency | dev-server file exposure and cross-origin script execution (GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg), plus three `launch-editor` issues | Compatible update, no major bump |
| `@grpc/grpc-js` <= 1.13.5 | `firebase` > `@firebase/firestore` > `@grpc/grpc-js` (1.9.16) | GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 | `npm audit fix --force` offered `firebase@9.14.0`, a downgrade across three majors; rejected |

`@firebase/firestore`, `@firebase/firestore-compat` and `firebase` were listed only because they depend on the vulnerable gRPC range.

## What changed

- `vite` raised to `^8.4.0` (8.4.0 installed), the same major.
- `package.json` `overrides` pins `@grpc/grpc-js` to `^1.14.7`. Firestore asks for `~1.9.0`, but the 1.x API it uses is unchanged. `npm ls` shows a single clean copy, `npm audit` reports 0 vulnerabilities, and build, tests and boundary tests pass.
- CI runs `npm audit --omit=dev --audit-level=high`, so a new high-severity advisory in a production dependency fails the build.

## Relevance to MapMory

- The app imports only `firebase/app` and `firebase/auth` (`src/auth.ts`). It never imports Firestore, and the production bundle contains no gRPC or Firestore code, so the gRPC advisories could not be reached from the shipped app. The override only keeps the lockfile clean.
- The vite advisories concern the dev server. The production image serves the built static files with nginx, so they apply to developer machines only.

## What remains

- Nothing is reported by `npm audit` at any level after these changes.
- Major updates are not applied here and need their own review: `firebase` 13, `@types/node` 26, `@axe-core/playwright` 4.14, `@playwright/test` 1.65.
- Revisit the `overrides` entry when `firebase` ships a release that depends on a patched `@grpc/grpc-js`, then delete it.
