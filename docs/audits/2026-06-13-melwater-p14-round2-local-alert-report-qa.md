# Melwater P14 Round 2 Local Alert Report QA

Date: 2026-06-13

## Scope

P14 round 2 covers the local operations fallback while Feishu/WeCom webhook credentials are not ready:

- Track consecutive healthcheck failures locally
- Write `health-alerts.log`
- Open and resolve `health-incident.json`
- Generate daily JSON and Markdown Ops reports
- Surface incident/report status through `/api/review-state/ops`
- Show incident/report status on the Ops page
- Install the daily report cron on Tencent Cloud production

## Implementation

Healthcheck:

- `deploy/scripts/melwater-healthcheck.sh`
- Sources production env before deriving defaults.
- Adds:
  - `MELWATER_HEALTH_INCIDENT_THRESHOLD`
  - `MELWATER_HEALTH_INCIDENT_FILE`
  - `MELWATER_HEALTH_ALERT_LOG`
  - `MELWATER_HEALTH_FAILURE_COUNT_FILE`
- Failure path writes:
  - `last-health.json`
  - `health-alerts.log`
  - `health-incident.json` when threshold is reached
- Success path:
  - resets failure count to `0`
  - appends a recovery event when recovering from failure
  - marks incident as `resolved`

Ops report:

- `deploy/scripts/melwater-ops-report.sh`
- Writes dated and latest report files:
  - `/opt/melwater-ana/backups/ops-reports/*-ops-report.json`
  - `/opt/melwater-ana/backups/ops-reports/*-ops-report.md`
  - `/opt/melwater-ana/backups/ops-report-latest.json`
  - `/opt/melwater-ana/backups/ops-report-latest.md`
- Includes:
  - release ref
  - last healthcheck
  - incident status
  - latest backup manifest
  - Melwater container status
  - TLS certificate `notAfter` when `openssl` is available
  - `/ops` API snapshot when a health token is available

Ops API and UI:

- `/api/review-state/ops` now includes:
  - `incident`
  - `alertLog.latest`
  - `opsReport`
- Ops page now shows:
  - incident summary card
  - incident detail banner
  - latest Ops report summary
  - recent alert log tail

Cron:

```cron
*/5 * * * * /opt/melwater-ana/app/deploy/scripts/melwater-healthcheck.sh >> /opt/melwater-ana/backups/healthcheck.log 2>&1
17 3 * * * /opt/melwater-ana/app/deploy/scripts/melwater-backup.sh daily >> /opt/melwater-ana/backups/review-state-backup.log 2>&1
23 3 * * * /opt/melwater-ana/app/deploy/scripts/melwater-ops-report.sh >> /opt/melwater-ana/backups/ops-report.log 2>&1
```

## Local Validation

Commands:

```bash
sh -n deploy/scripts/melwater-healthcheck.sh
sh -n deploy/scripts/melwater-ops-report.sh
sh -n deploy/scripts/melwater-backup.sh
npm run build
npm run review:replay
npm audit --json
```

Results:

- Shell syntax passed.
- Frontend build passed.
- `review:replay` returned `ok: true`.
- `npm audit`: 0 total vulnerabilities.

Failure-path validation:

- Ran healthcheck with no env file and threshold `1`.
- Exit code: `1`.
- `last-health.json` contained:
  - `ok: false`
  - `failureCount: 1`
  - `incidentOpen: true`
- `health-incident.json` contained:
  - `status: open`
  - `incidentType: healthcheck_consecutive_failure`
- `health-alerts.log` received a JSONL failure event.

Ops report validation:

- Ran `melwater-ops-report.sh` against temporary health, incident, and backup manifest fixtures.
- Generated latest JSON and Markdown report files.
- Markdown report included Health, Backup, Certificate, Containers, and Runbook sections.

Local API validation:

- Started API on port `4182` with test incident/report files.
- `GET /api/review-state/ops` returned:
  - `incident.status: open`
  - `incident.failureCount: 3`
  - `alertLog.latest[0].message: local incident test`
  - `opsReport.incidentStatus: open`
  - `reviewState.replayOk: true`

## Production Deployment

Synced app source to:

```bash
/opt/melwater-ana/app
```

Updated non-secret production env:

```bash
MELWATER_RELEASE_REF=bce2d360-p14r2-working
MELWATER_HEALTH_INCIDENT_THRESHOLD=3
MELWATER_HEALTH_INCIDENT_FILE=/opt/melwater-ana/backups/health-incident.json
MELWATER_HEALTH_ALERT_LOG=/opt/melwater-ana/backups/health-alerts.log
MELWATER_OPS_REPORT_ROOT=/opt/melwater-ana/backups/ops-reports
MELWATER_OPS_REPORT_LATEST_JSON=/opt/melwater-ana/backups/ops-report-latest.json
MELWATER_OPS_REPORT_LATEST_MD=/opt/melwater-ana/backups/ops-report-latest.md
```

After commit and push, production `MELWATER_RELEASE_REF` and `/opt/melwater-ana/app/REVISION` were updated to:

```bash
23c098e3
```

Installed cron:

```bash
/etc/cron.d/melwater-ops
```

Rebuilt:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

Containers:

- `melwater_api`: healthy
- `melwater_web`: healthy

## Production Smoke

Healthcheck:

```json
{
  "ok": true,
  "checkedAt": "2026-06-13T04:54:36Z",
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "releaseRef": "23c098e3",
  "failureCount": 0,
  "incidentThreshold": 3,
  "incidentOpen": false
}
```

Ops API:

- `ok: true`
- `auth.role: admin`
- `release.ref: 23c098e3`
- `reviewState.schemaVersion: 2`
- `reviewState.replayOk: true`
- `healthcheck.ok: true`
- `incident: null`
- `alertLog.latest: []`
- `opsReport.ok: true`
- `opsReport.incidentStatus: none`
- `opsReport.latestBackupFile: 20260613T043743Z-p14-smoke.tar.gz`
- `opsReport.markdownFile: 20260613T045436Z-ops-report.md`

Cron:

- `/etc/cron.d/melwater-ops` contains healthcheck, backup, and ops report jobs.

Browser smoke:

- Opened `https://melwater.lute-tlz-dddd.top`.
- Navigated to `Ops 状态`.
- Confirmed page title: `Ops Status & Access`.
- Confirmed Incident UI exists.
- Confirmed token input exists.
- Browser console had no errors.

## Acceptance

Pass.

Melwater now has a local alert and daily report loop that works without external webhook credentials. Failure signals are persisted as JSON/JSONL, reports are generated for audit and handoff, and the product Ops page exposes the current incident/report state.

## Remaining Debt

- Real Feishu/WeCom webhook still needs credentials and endpoint configuration.
- Incident routing is still local-file based; long-term target is notification delivery plus ticket creation.
- Ops report is generated by cron; there is not yet an in-product manual “generate report now” button.
