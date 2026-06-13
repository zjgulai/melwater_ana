# Melwater P14 Ops Token Page QA

Date: 2026-06-13

## Scope

P14 first round covers the no-external-alert operations loop while Feishu/WeCom credentials are not ready:

- Add an in-product API token settings surface
- Add an authenticated production Ops status API
- Expose release, healthcheck, backup, and review-state replay status
- Deploy to Tencent Cloud Docker production
- Validate the UI and API without exposing secrets

## Implementation

Frontend:

- Added `Ops Status & Access` as a system settings page.
- Added local browser token management for `melwater:apiToken`.
- Added reviewer name management for `melwater:reviewer`.
- Added token test against `/api/review-state/health`.
- Added production health, release, backup, and review-state runtime cards.

Backend:

- Added authenticated `GET /api/review-state/ops`.
- Returned only operational metadata:
  - release ref
  - auth role
  - review-state metrics
  - last healthcheck JSON
  - latest backup manifest
- No token or secret values are returned.

Docker:

- Mounted production backup root read-only into the API container.
- Added `MELWATER_RELEASE_REF`, `MELWATER_OPS_BACKUP_ROOT`, and `MELWATER_OPS_LAST_HEALTH_FILE`.

## Local Validation

Commands:

```bash
npm run build
npm run review:replay
npm audit --json
```

Results:

- Build passed.
- `review:replay` returned `ok: true`.
- `npm audit`: 0 total vulnerabilities.

API route validation:

```bash
REVIEW_STATE_PORT=4181 \
REVIEW_STATE_TOKENS='{"viewer-token":{"role":"viewer","actor":"Local Viewer"}}' \
MELWATER_RELEASE_REF=local-p14 \
node server/reviewStateServer.mjs
```

Checks:

- `GET /api/review-state/ops` without token returned `401`.
- `GET /api/review-state/health` with viewer token returned `ok: true`.
- `GET /api/review-state/ops` with viewer token returned `release.ref: local-p14` and `reviewState.replayOk: true`.

## Production Deployment

Synced app source to:

```bash
/opt/melwater-ana/app
```

Updated non-secret production env:

```bash
MELWATER_RELEASE_REF=21753102-p14-working
MELWATER_BACKUP_HOST_ROOT=/opt/melwater-ana/backups
```

After commit and push, production `MELWATER_RELEASE_REF` and `/opt/melwater-ana/app/REVISION` were updated to:

```bash
d32febcd
```

Rebuilt:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

Containers:

- `melwater_api`: healthy
- `melwater_web`: healthy

Note:

- The first healthcheck ran during the web container start window and returned `melwater_web not healthy`.
- After Docker healthcheck completed, the formal production smoke passed.

## Production Smoke

Healthcheck:

```json
{
  "ok": true,
  "checkedAt": "2026-06-13T04:37:43Z",
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "releaseRef": "21753102-p14-working"
}
```

Manual backup:

```json
{
  "ok": true,
  "createdAt": "2026-06-13T04:37:43Z",
  "label": "p14-smoke",
  "container": "melwater_api",
  "bytes": 785,
  "sha256": "a1ef9ac1ae2d97e29101ff8dc03300407fe63c09dbc1d036a88ec458603f0a63"
}
```

Ops API:

- `ok: true`
- `auth.role: admin`
- `release.ref: d32febcd`
- `reviewState.schemaVersion: 2`
- `reviewState.replayOk: true`
- `healthcheck.ok: true`
- `backup.latest.label: p14-smoke`

Browser smoke:

- Opened `https://melwater.lute-tlz-dddd.top`.
- Navigated to `Ops 状态`.
- Confirmed page title: `Ops Status & Access`.
- Confirmed token input exists.
- Confirmed no-token state is visible.
- Browser console had no errors.

## Acceptance

Pass.

The product now has a self-service token settings page and an authenticated Ops status surface. This closes the immediate operations visibility gap while external Feishu/WeCom alerting is still pending.

## Remaining Debt

- Real Feishu/WeCom webhook is still not configured.
- Ops page currently depends on browser-local token storage; SSO or server-side session auth is a future hardening item.
- Container-level status and certificate expiry are still checked by scripts, not yet surfaced in `/ops`.
