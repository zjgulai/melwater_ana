# Melwater P15 Action Closed Loop QA

Date: 2026-06-13

## Scope

P15 upgrades the Action Closed Loop page from a simple status list into a business-use workflow:

- Derive action category, topic, priority, business impact, and evidence linkage from the collected Melwater data.
- Persist action owner, priority, impact, and status through review-state API namespaces.
- Add filters for owner, status, priority, evidence linkage, and keyword search.
- Export the current filtered action set to CSV.
- Keep the current warm-neutral Analyst Lab UI style.

## Implementation

Frontend:

- `ActionLoopPage` now uses four writeback namespaces:
  - `actionStatus`
  - `actionOwner`
  - `actionPriority`
  - `actionImpact`
- Action cards show:
  - derived P0/P1/P2/P3 priority
  - category and topic
  - owner name
  - expected metric
  - due date and review date
  - business impact
  - linked evidence samples and quote URLs when available
- The page provides:
  - owner/status/priority/evidence filters
  - keyword search
  - CSV export for filtered rows

Backend:

- `reviewStateStore.mjs` registers three new persistent CSV-backed namespaces:
  - `action-impact.csv`
  - `action-owner.csv`
  - `action-priority.csv`
- These namespaces are included in:
  - `review-state.json`
  - per-namespace CSV exports
  - `review-state.csv`
  - replay verification
  - ops review-state metrics

## Local Validation

Commands:

```bash
npm run build
npm run review:replay
npm audit --json
git diff --check
```

Results:

- Build passed.
- `review:replay` returned `ok: true`.
- `npm audit`: 0 total vulnerabilities.
- `git diff --check`: no whitespace errors.

Temporary API validation:

- Started local API with isolated state directory:
  - `REVIEW_STATE_DIR=/tmp/melwater-p15-state.a8m7sp`
  - `REVIEW_STATE_PORT=4185`
- Wrote smoke entries into:
  - `actionOwner`
  - `actionPriority`
  - `actionImpact`
- Readback confirmed:

```json
{
  "owner": "PM owner",
  "priority": "P1",
  "impact": "business impact smoke",
  "namespaces": [
    "actionImpact",
    "actionOwner",
    "actionPriority",
    "actionStatus"
  ]
}
```

Replay on the isolated state returned:

```json
{
  "ok": true,
  "eventCount": 3,
  "replayedEventCount": 3
}
```

## Production Deployment

Application commit deployed:

```bash
dc006288
```

Synced app source to:

```bash
/opt/melwater-ana/app
```

Updated:

```bash
/opt/melwater-ana/app/REVISION
MELWATER_RELEASE_REF=dc006288
```

Rebuilt:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f /opt/melwater-ana/app/deploy/docker/docker-compose.yml up -d --build
```

Containers after deployment:

- `melwater_api`: healthy
- `melwater_web`: healthy

## Production Smoke

Public site:

```json
{
  "ok": true,
  "url": "https://melwater.lute-tlz-dddd.top",
  "status": 200,
  "title": "Melwater Analyst Lab - Pain Radar",
  "expectedTextProvided": true,
  "failures": []
}
```

Healthcheck:

```json
{
  "ok": true,
  "checkedAt": "2026-06-13T05:20:34Z",
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "releaseRef": "dc006288",
  "failureCount": 0,
  "incidentThreshold": 3,
  "incidentOpen": false
}
```

Ops API summary:

- `reviewState.replayOk: true`
- `reviewState.entriesByNamespace` includes:
  - `actionImpact`
  - `actionOwner`
  - `actionPriority`
  - `actionStatus`
- Certificate:
  - `host: melwater.lute-tlz-dddd.top`
  - `notAfter: Sep 11 02:49:24 2026 GMT`
  - `daysRemaining: 90`

Browser smoke:

- Page title: `Melwater Analyst Lab - Pain Radar`
- Opened `Action Closed Loop`.
- Rendered:
  - 24 visible action cards
  - 57-row export button
  - 4 controls per card: status, owner name, priority, business impact
  - 14 linked evidence/quote records
- Browser console:
  - no errors
  - no warnings
- Browser showed `local fallback` because the smoke browser had no production API token configured; production token auth remains enabled and verified separately.

## Acceptance

Pass.

The Action Closed Loop page now supports owner assignment, priority triage, business impact capture, evidence-linked review, filtered CSV export, and API-backed audit persistence for the new fields.

## Remaining Debt

- Owner names are still analyst-entered values; team directory or Feishu user binding can be added after real workspace credentials are available.
- Business impact is derived from available pain-card/query metadata and can later be upgraded to quantified revenue, ticket, or conversion models.
- CSV export is browser-side; if recurring scheduled exports are needed, add an API endpoint for server-side export bundles.
