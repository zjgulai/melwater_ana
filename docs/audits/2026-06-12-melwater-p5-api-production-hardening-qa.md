# Melwater P5 API Production Hardening QA

Date: 2026-06-12

## Scope

P5 closes the remaining P4 production-readiness gaps for the review-state layer.

This round focuses on:

- Environment-configurable frontend API base URL
- Optional token auth for standalone API
- CORS configuration for cross-origin frontend/API deployment
- Schema v2 migration manifest
- State baseline for migrated historical state
- Event replay verification for post-migration writes
- CLI commands for migration and replay QA

## Implemented

Frontend:

- Added `VITE_REVIEW_STATE_API_BASE`.
- Default remains same-origin `/api/review-state`, so local Vite keeps working.
- If `localStorage["melwater:apiToken"]` exists, frontend requests send `Authorization: Bearer <token>`.

Server/API:

- Added `GET /api/review-state/health`.
- Added `GET /api/review-state/replay`.
- Added optional `REVIEW_STATE_TOKEN`.
- Added optional `REVIEW_STATE_CORS_ORIGIN`.
- Added `REVIEW_STATE_DIR` support for standalone state placement.

State exports:

- `state/review-state-manifest.json`
- `state/review-state-baseline.json`
- Existing JSON/CSV state exports are still refreshed.
- Existing event JSONL/CSV exports are still refreshed.

CLI:

```bash
npm run review:migrate
npm run review:replay
```

Environment template:

- `.env.example`

## Migration Result

```json
{
  "ok": true,
  "schemaVersion": 2,
  "eventCount": 8,
  "replayedEventCount": 0,
  "baselineCreatedAt": "2026-06-12T09:34:21.126Z",
  "namespaces": [
    "actionStatus",
    "conceptDecision",
    "crisisTriage",
    "quoteReview",
    "searchVerdict"
  ]
}
```

`replayedEventCount` is `0` immediately after migration because the current historical state becomes the baseline. New writes after this baseline are replayed and compared against current state.

## Automated QA

Build:

```bash
npm run build
```

Result: passed.

Known build note: Vite still reports the existing Recharts-related chunk size warning over 500 kB. No build failure.

Migration and replay:

```bash
npm run review:migrate
npm run review:replay
```

Result: both passed.

Vite middleware health:

```json
{
  "status": 200,
  "body": {
    "ok": true,
    "authRequired": false,
    "schemaVersion": 2
  }
}
```

Vite middleware replay:

```json
{
  "status": 200,
  "body": {
    "ok": true,
    "eventCount": 8,
    "currentNamespaces": [
      "actionStatus",
      "conceptDecision",
      "crisisTriage",
      "quoteReview",
      "searchVerdict"
    ]
  }
}
```

Standalone API with token:

```json
{
  "unauthorizedStatus": 401,
  "healthStatus": 200,
  "authRequired": true,
  "postStatus": 200,
  "postVersion": 1,
  "replayStatus": 200,
  "eventCount": 1
}
```

## Acceptance

P5 passed local build, migration, replay, same-origin Vite API health/replay, standalone token-auth API, authorized write, event listing, and replay verification.

## Remaining Gaps

- Token auth is suitable for prototype/private deployment, not a full identity system.
- Review state is still JSON/CSV file backed; production should move to a durable database or object store with backup policy.
- Replay starts from a migration baseline, not from the beginning of all historical manual review activity.
- No rate limiting, request audit correlation ID, or role-based permission model exists yet.
- The frontend has no UI for entering/changing API token; token is currently configured via localStorage.
