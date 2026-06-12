# Melwater P6 Ops Hardening QA

Date: 2026-06-12

## Scope

P6 hardens the Review State API for small production or private Tencent Cloud deployment without introducing a new database yet.

This round focuses on:

- Role-based API tokens
- Atomic state/export writes
- Manual backup packages
- Prometheus-style metrics
- Admin backup API
- Deployment-oriented environment examples

## Implemented

Role-based tokens:

- `viewer`: can read state, events, replay, metrics.
- `editor`: can read and write review-state entries.
- `admin`: can read, write, and create backups.

Environment:

```bash
REVIEW_STATE_TOKEN=single-admin-token
REVIEW_STATE_TOKENS={"viewer-token":{"role":"viewer","actor":"Viewer QA"},"editor-token":{"role":"editor","actor":"Editor QA"},"admin-token":{"role":"admin","actor":"Admin QA"}}
```

`REVIEW_STATE_TOKEN` remains a backward-compatible single admin token. `REVIEW_STATE_TOKENS` enables multiple tokens and roles.

API endpoints:

- `GET /api/review-state/health`
- `GET /api/review-state/metrics`
- `GET /api/review-state`
- `GET /api/review-state/events?limit=100`
- `GET /api/review-state/replay`
- `POST /api/review-state`
- `POST /api/review-state/backup`

State durability:

- JSON/CSV/manifest writes now use temp-file + rename atomic writes.
- Existing event JSONL remains append-only.
- Backup packages are written to `state/backups/<timestamp>-<label>/`.

CLI:

```bash
npm run review:migrate
npm run review:replay
npm run review:backup -- --label=p6-smoke
```

## QA Results

Syntax:

```bash
node --check server/reviewStateStore.mjs
node --check server/reviewStateApi.mjs
node --check server/backupReviewState.mjs
node --check server/migrateReviewState.mjs
node --check server/replayReviewEvents.mjs
```

Result: passed.

Migration and replay:

```json
{
  "ok": true,
  "schemaVersion": 2,
  "eventCount": 8,
  "replayedEventCount": 0,
  "baselineCreatedAt": "2026-06-12T09:34:21.126Z"
}
```

Manual backup:

```json
{
  "ok": true,
  "label": "p6-smoke",
  "fileCount": 11,
  "files": [
    "review-state.json",
    "review-events.jsonl",
    "review-state-baseline.json",
    "review-state-manifest.json",
    "review-state.csv",
    "review-events.csv",
    "action-status.csv",
    "concept-decision.csv",
    "crisis-triage.csv",
    "quote-review.csv",
    "search-verdict.csv"
  ]
}
```

Role matrix:

```json
{
  "unauthorizedHealth": 401,
  "viewerRead": 200,
  "viewerWrite": 403,
  "editorWrite": 200,
  "editorBackup": 403,
  "adminBackup": 200,
  "metricsStatus": 200,
  "metricsHasReplayOk": true,
  "replayStatus": 200,
  "replayOk": true
}
```

Build:

```bash
node ./node_modules/vite/bin/vite.js build
```

Result: passed.

Note: `npm run build` hit a local `spawn sh EAGAIN` resource error once, then direct Vite build passed. This was an OS process-spawn issue, not a compile failure.

Vite middleware after restart:

```json
{
  "healthStatus": 200,
  "authRequired": false,
  "role": "admin",
  "metricsStatus": 200,
  "metricsHasReplayOk": true,
  "replayStatus": 200,
  "eventCount": 8
}
```

## Tencent Cloud Deployment Notes

Recommended minimum deployment layout:

- Frontend static build served by CDN or Nginx.
- Review State API as a Node process behind HTTPS reverse proxy.
- `REVIEW_STATE_DIR` on a persistent cloud disk path.
- `REVIEW_STATE_CORS_ORIGIN` pinned to the frontend origin.
- `REVIEW_STATE_TOKENS` stored as secret environment variables.
- Schedule `npm run review:backup -- --label=daily` before daily deployment or data refresh.
- Monitor `/api/review-state/metrics` for `melwater_review_state_replay_ok 1`.

## Acceptance

P6 passed syntax checks, migration, replay, backup creation, role-based auth matrix, metrics, Vite middleware health/replay/metrics, and production build.

## Remaining Gaps

- JSONL append is append-only and practical for the prototype, but not a transactional database.
- No token rotation UI or secret manager integration exists yet.
- No IP allowlist, rate limiting, or request correlation ID exists yet.
- Backup retention cleanup is manual.
- Cloud deployment files such as PM2/systemd/Nginx/Tencent Cloud runbook are not yet added.
