## Mock and Live API Modes

MapMory's frontend supports two data modes: **mock mode** for developing and demonstrating the interface without a backend, and **live mode** for integrating with the Go API.

The mode is controlled by the frontend environment variable `VITE_API_URL`, independently of the backend's database configuration.

### Mock mode

To run the frontend with predefined demonstration data, leave `VITE_API_URL` unset:

```dotenv
# VITE_API_URL=http://localhost:8080
```

Restart the Vite development server after changing the environment configuration.

In mock mode:

- The Dashboard displays predefined trips, photos, and statistics.
- Users can explore the trip viewer, maps, and sharing interface without a running backend.
- Share creation, recipient viewing, and revocation are simulated in the browser, using local mock data and state.
- Mock shares do not exist in PostgreSQL and are not accessible across independent browsers or devices through a shared backend.
- Mock revocation does not constitute server-side access revocation.

**The sharing UI is not new to the live-sharing integration.** The earlier frontend sharing work implemented the share-management and recipient experiences using mock data. This allows interface development and demonstrations without waiting for the backend.

### Live mode

To connect the frontend to the Go API, configure:

```dotenv
VITE_API_URL=http://localhost:8080
```

In live mode, implemented operations use real API requests rather than predefined demonstration data.

For the complete photo-sharing workflow, the backend must have:

- Database-backed user resolution enabled.
- A valid PostgreSQL connection with the required migrations applied, including the sharing schema.
- Firebase authentication configured.
- A configured photo storage bucket and the permissions necessary to serve signed display-image URLs.
- The sharing endpoints introduced by backend PR #58.

Frontend PR #48 connects the existing sharing interface to these backend endpoints. It includes live share creation, listing and revocation, anonymous recipient retrieval, public-share retrieval, public-map queries, API adapters, and error handling.

A frontend configured for live mode does not automatically fall back to mock photos when the backend has no data or does not support an endpoint.

### Backend database mode is independent

The backend's `MAPMORY_ENABLE_DB_USER_RESOLUTION` and `DATABASE_URL` settings control backend persistence and user resolution. They do **not** control whether the frontend uses mock data.

| Frontend configuration | Backend configuration | Expected behavior |
|---|---|---|
| `VITE_API_URL` unset | Any / not running | Predefined demonstration data and simulated sharing |
| `VITE_API_URL` set | Legacy backend without database mode | Live API requests where supported; no predefined frontend demo photos |
| `VITE_API_URL` set | Database-backed backend with sharing support | Real persisted trips, photos, and sharing |

### Testing sharing

**Mock UI testing:** Run the frontend without `VITE_API_URL`. Verify photo selection, share creation, recipient presentation, and revocation using demonstration data.

**Live integration testing:** Run the frontend against a compatible backend with PostgreSQL and photo storage configured. Upload and process a real photo, create a share, open its link in another browser or private window, and revoke it.

Live integration tests must verify that operations reach the backend, that recipients do not need authentication, that private trip data is not exposed, and that revoked or missing shares produce the expected error states.

Mock-mode success does not establish that live sharing works end to end.
