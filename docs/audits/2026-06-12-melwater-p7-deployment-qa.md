# Melwater P7 Deployment QA

Date: 2026-06-12

## Scope

P7 validates the deployment artifacts and operations scripts added for Tencent Cloud style deployment.

Primary goal:

- Make the current prototype deployable as a frontend static build plus a private Node Review State API behind Nginx.
- Add self-checks that fail loudly when production auth is missing.
- Add backup retention dry-run/apply support.

## Added

Deployment artifacts:

- `deploy/env/melwater-review-state.env.example`
- `deploy/systemd/melwater-review-state-api.service`
- `deploy/pm2/ecosystem.config.cjs`
- `deploy/nginx/melwater.conf`
- `deploy/crontab/review-state-backup.cron`

Scripts:

- `server/verifyDeployment.mjs`
- `server/pruneReviewBackups.mjs`

Package commands:

```bash
npm run review:verify-deploy
npm run review:prune-backups
```

Runbook:

- `docs/audits/2026-06-12-melwater-p7-tencent-cloud-deployment-runbook.md`

## QA Results

Syntax:

```bash
node --check server/verifyDeployment.mjs
node --check server/pruneReviewBackups.mjs
node --check server/reviewStateApi.mjs
node --check server/reviewStateStore.mjs
```

Result: passed.

Backup retention dry-run:

```json
{
  "ok": true,
  "mode": "dry-run",
  "keep": 1,
  "total": 1,
  "retained": [
    "2026-06-12T10-33-49-291Z-p6-smoke"
  ],
  "pruned": []
}
```

Local Vite deployment self-check:

```json
{
  "apiBase": "http://127.0.0.1:5173/api/review-state",
  "tokenProvided": false,
  "ok": true,
  "failures": []
}
```

Local `--require-auth` guard:

```json
{
  "ok": false,
  "failures": [
    "auth-required"
  ]
}
```

This failure is expected for local unauthenticated development and required for production safety checks.

Temporary production-style API with admin token:

```json
{
  "tokenProvided": true,
  "health": 200,
  "authRequired": true,
  "role": "admin",
  "replay": 200,
  "metricsHasReplayOk": true,
  "backup": 200,
  "ok": true,
  "failures": []
}
```

Temporary production-style API without token:

```json
{
  "health": 401,
  "replay": 401,
  "metrics": 401,
  "ok": false
}
```

Replay:

```json
{
  "ok": true,
  "eventCount": 8,
  "replayedEventCount": 0,
  "baselineCreatedAt": "2026-06-12T09:34:21.126Z"
}
```

Build:

```bash
node ./node_modules/vite/bin/vite.js build
```

Result: passed.

Known note: Vite still reports the Recharts chunk-size warning. It is not a build failure.

## Acceptance

P7 passed:

- Deployment artifact creation
- Syntax checks
- Backup retention dry-run
- Local deployment self-check
- Production auth-required guard
- Temporary authenticated API self-check with backup
- Unauthorized production API failure check
- Replay
- Frontend build

## Remaining Gaps

- Real Tencent Cloud production deployment was not executed in this environment.
- TLS certificate automation is not included.
- Tencent Cloud Secrets Manager/CAM integration is not included.
- No blue-green release or one-command remote deploy script yet.
- External monitoring is not connected; metrics endpoint is ready for scraping.
