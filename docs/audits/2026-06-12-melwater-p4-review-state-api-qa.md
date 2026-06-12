# Melwater P4 Review State API QA

Date: 2026-06-12

## Scope

P4 productionizes the P3 writeback loop into a reusable Review State API layer.

The goal is to move beyond Vite-only local middleware by adding:

- Shared API/store modules
- Standalone API server entry
- Actor identity
- Entry versioning
- Optimistic conflict detection
- Event history
- Audit-log UI
- CSV/JSON exports for state and event replay

## Implemented

Server modules:

- `server/reviewStateStore.mjs`
- `server/reviewStateApi.mjs`
- `server/reviewStateServer.mjs`

Runtime modes:

- Vite dev middleware: `http://127.0.0.1:5173/api/review-state`
- Standalone API: `npm run api`, default `http://127.0.0.1:4174/api/review-state`

API endpoints:

- `GET /api/review-state`
- `POST /api/review-state`
- `GET /api/review-state/events?limit=100`

State entries now include:

- `value`
- `meta`
- `version`
- `createdAt`
- `updatedAt`
- `updatedBy`

Events are written to:

- `state/review-events.jsonl`
- `state/review-events.csv`

## Frontend Integration

Updated `useWritebackState(namespace)`:

- Loads full entry metadata from API.
- Persists local fallback entries when API is unavailable.
- Sends `actor` and `X-Melwater-User`.
- Sends `expectedVersion` for optimistic conflict detection.
- Displays `api writeback`, `local fallback`, or `conflict refreshed`.

Added page:

- `Review Audit Log`

The audit page shows event count, actors, namespaces, latest operation, version movement, and event metadata.

## Automated QA

Build:

```bash
npm run build
```

Result: passed.

Known build note: Vite still reports the existing Recharts-related chunk size warning over 500 kB. No build failure.

API and conflict QA:

```json
{
  "viteNamespaces": [
    "actionStatus",
    "conceptDecision",
    "crisisTriage",
    "quoteReview",
    "searchVerdict"
  ],
  "conflictStatus": 409,
  "conflictMessage": "write conflict: expectedVersion does not match current version",
  "updateStatus": 200,
  "updateVersion": 2,
  "eventCount": 5,
  "latestOperation": "delete",
  "latestActor": "QA-P4",
  "standaloneReadOk": true,
  "cleanedConflictKey": true,
  "cleanedProbeKey": true
}
```

Browser audit-page QA:

```json
{
  "auditTitle": "Review Audit Log",
  "auditRows": 6,
  "syncBadge": "api writeback",
  "hasBrowserActor": true,
  "latestNamespace": "quoteReview",
  "latestVersion": 2
}
```

Final state snapshot:

```json
{
  "namespaces": 5,
  "eventCount": 8,
  "quoteValue": "approved",
  "quoteVersion": 4,
  "actors": [
    "Analyst",
    "QA Browser P4",
    "QA-P4"
  ],
  "hasConflictQaEvents": true
}
```

## Screenshots

- `outputs/prototypes/playbook-pain-radar-lab/qa/p4-audit-log.png`

## Remaining Gaps

- Actor identity is still browser/local-header based, not authenticated identity.
- Conflict handling is optimistic and entry-level; no merge UI is implemented yet.
- Event history is append-only JSONL/CSV, not a durable database or queue.
- Standalone API has no auth, rate limiting, schema migration, or deployment wrapper yet.
- The frontend still talks to same-origin `/api/review-state`; production deployment needs an environment-configurable API base URL.

## Acceptance

P4 passed local build, Vite API QA, standalone API QA, conflict detection, event export, browser audit-page QA, and final state verification.
