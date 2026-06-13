# Melwater P13 Security Backup Health QA

Date: 2026-06-13

## Scope

P13 first round covers:

- Dependency security audit remediation
- Melwater-only backup script
- Melwater-only restore dry-run and restore drill
- Production healthcheck script
- Production cron installation

The work is scoped to the Melwater deployment under `/opt/melwater-ana` and the `melwater_*` Docker containers.

## Dependency Security

Initial audit:

- `high`: 3
- Root cause: Vite build chain via `esbuild <0.28.1`
- Direct packages involved:
  - `vite@6.4.2`
  - `@vitejs/plugin-react@5.0.4`

Change:

- Upgraded `vite` to `8.0.16`
- Upgraded `@vitejs/plugin-react` to `6.0.2`
- Resulting `esbuild`: `0.28.1`

Validation:

```bash
npm audit --json
npm run review:replay
npm run build
```

Result:

- `npm audit`: 0 total vulnerabilities
- `review:replay`: pass
- `vite build`: pass
- The chunk-size warning remains a performance optimization debt, not a security blocker.

Production rebuild result:

- API image build: `found 0 vulnerabilities`
- Web image build: `found 0 vulnerabilities`
- Vite production build: `vite v8.0.16`

## Added Operations Scripts

Scripts:

- `deploy/scripts/melwater-backup.sh`
- `deploy/scripts/melwater-restore.sh`
- `deploy/scripts/melwater-restore-drill.sh`
- `deploy/scripts/melwater-healthcheck.sh`

Cron:

- `deploy/crontab/melwater-ops.cron`

Installed production cron:

```cron
*/5 * * * * /opt/melwater-ana/app/deploy/scripts/melwater-healthcheck.sh >> /opt/melwater-ana/backups/healthcheck.log 2>&1
17 3 * * * /opt/melwater-ana/app/deploy/scripts/melwater-backup.sh daily >> /opt/melwater-ana/backups/review-state-backup.log 2>&1
```

## Backup Validation

Command:

```bash
/opt/melwater-ana/app/deploy/scripts/melwater-backup.sh p13-smoke
```

Result:

```json
{
  "ok": true,
  "label": "p13-smoke",
  "container": "melwater_api",
  "backupFile": "/opt/melwater-ana/backups/review-state/20260613T040228Z-p13-smoke.tar.gz",
  "bytes": 786,
  "sha256": "4cf42b833a9ed3cfeb0b2294a323497cdcd05a9c8b1c037e8ebf0c4834a4c8e9"
}
```

The script verifies the archive with `tar -tzf` and writes a JSON manifest next to the tarball.

## Restore Dry-Run Validation

Command:

```bash
/opt/melwater-ana/app/deploy/scripts/melwater-restore.sh \
  --backup=/opt/melwater-ana/backups/review-state/20260613T040228Z-p13-smoke.tar.gz
```

Result:

- Pass.
- The script reports the intended target volume and requires `--execute` before touching production state.

## Restore Drill Validation

Command:

```bash
/opt/melwater-ana/app/deploy/scripts/melwater-restore-drill.sh \
  --backup=/opt/melwater-ana/backups/review-state/20260613T040228Z-p13-smoke.tar.gz
```

Result:

- Pass.
- Backup was restored into a temporary Docker volume.
- `server/replayReviewEvents.mjs` passed against the temporary volume.
- Temporary drill volume was removed after the run.

Replay result:

```json
{
  "ok": true,
  "stateDir": "/data",
  "eventCount": 0,
  "replayedEventCount": 0,
  "currentNamespaces": [
    "actionStatus",
    "conceptDecision",
    "crisisTriage",
    "quoteReview",
    "searchVerdict"
  ]
}
```

## Healthcheck Validation

Command:

```bash
/opt/melwater-ana/app/deploy/scripts/melwater-healthcheck.sh
```

Result:

```json
{
  "ok": true,
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state"
}
```

Checks performed:

- Public homepage returns `HTTP 200`
- Homepage contains `Melwater Analyst Lab`
- Authenticated `/api/review-state/health` passes
- Authenticated `/api/review-state/metrics` contains `melwater_review_state_replay_ok 1`
- `melwater_api` Docker health is healthy
- `melwater_web` Docker health is healthy

## Production State After P13

Containers:

```bash
melwater_api   healthy
melwater_web   healthy
```

Cron:

- Healthcheck every 5 minutes
- Review-state backup daily at 03:17 server time

Backups:

```bash
/opt/melwater-ana/backups/review-state/
```

## Remaining Debt

- Frontend bundle remains larger than 500 KB. This is now a performance/code-splitting task, not a security blocker.
- Token distribution is still manual through `/opt/melwater-ana/secrets/access-tokens.txt`.
- There is no external alert sink yet. Healthcheck logs locally; next step can wire failures to Feishu/WeCom/email.
