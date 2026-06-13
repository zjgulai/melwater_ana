# Melwater P13 Round 2 Performance Alert QA

Date: 2026-06-13

## Scope

P13 round 2 covers:

- Frontend bundle splitting after the Vite 8 upgrade
- Healthcheck result persistence
- Optional webhook alert hooks for healthcheck failures
- Production rebuild and smoke validation

## Bundle Splitting

Before:

- Single JS bundle: about `880 KB`
- Vite warned that the chunk exceeded `500 KB`

Change:

- Added `build.rolldownOptions.output.codeSplitting.groups` in `vite.config.mjs`
- Split groups:
  - `chart-vendor`: `recharts`
  - `icon-vendor`: `@tabler/icons-react`
  - `react-vendor`: `react`, `react-dom`, `scheduler`
  - `vendor`: remaining `node_modules`

Local build result:

```bash
npm run build
```

Output chunks:

| Asset | Size |
|---|---:|
| `index-DPQ526Js.js` | 355,116 bytes |
| `chart-vendor-DyoTnfNC.js` | 338,910 bytes |
| `react-vendor-RMbG61jK.js` | 178,694 bytes |
| `icon-vendor-Bgs_0Tor.js` | 6,930 bytes |
| `rolldown-runtime-QTnfLwEv.js` | 694 bytes |

Acceptance:

- Pass.
- Largest JS chunk is below `500 KB`.
- Build warning is gone.
- `npm audit` remains at 0 total vulnerabilities.

## Health Alert Hook

Updated:

- `deploy/scripts/melwater-healthcheck.sh`
- `deploy/docker/melwater.env.example`

Added optional env vars:

```bash
MELWATER_ALERT_WEBHOOK_URL=
MELWATER_ALERT_WEBHOOK_TYPE=generic
```

Supported webhook payload types:

- `generic`
- `feishu`
- `wecom`

Default behavior:

- No webhook is called when `MELWATER_ALERT_WEBHOOK_URL` is empty.
- Success and failure results are written to:

```bash
/opt/melwater-ana/backups/last-health.json
```

## Local Validation

Commands:

```bash
sh -n deploy/scripts/melwater-healthcheck.sh
MELWATER_ENV_FILE=/tmp/does-not-exist \
MELWATER_HEALTH_RESULT_FILE=/tmp/melwater-health-fail.json \
deploy/scripts/melwater-healthcheck.sh
npm audit --json
npm run build
```

Results:

- Shell syntax passed.
- Failure path wrote JSON and exited with code `1`.
- `npm audit`: 0 vulnerabilities.
- Build passed with split chunks.

## Production Deployment

The app source was synced to:

```bash
/opt/melwater-ana/app
```

Rebuilt:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

Production build output confirmed split chunks:

- `index-DPQ526Js.js`
- `chart-vendor-DyoTnfNC.js`
- `react-vendor-RMbG61jK.js`
- `icon-vendor-Bgs_0Tor.js`
- `rolldown-runtime-QTnfLwEv.js`

## Production Smoke

Containers:

```bash
melwater_web   healthy
melwater_api   healthy
```

Public page:

```bash
https://melwater.lute-tlz-dddd.top
```

Result:

- `HTTP 200`
- Title: `Melwater Analyst Lab - Pain Radar`
- Page HTML references the split JS chunks listed above.

Healthcheck:

```json
{
  "ok": true,
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state"
}
```

Failure-path production dry-run:

```bash
MELWATER_PUBLIC_URL=https://127.0.0.1:1 \
MELWATER_HEALTH_RESULT_FILE=/tmp/melwater-health-failure-path.json \
/opt/melwater-ana/app/deploy/scripts/melwater-healthcheck.sh
```

Result:

- Exited with code `1`
- Wrote JSON failure result
- No webhook sent because no webhook URL is configured

## Remaining Debt

- No real alert webhook has been configured yet. The hook is ready, but a Feishu/WeCom/email endpoint must be supplied.
- `index` and `chart-vendor` chunks are now below the warning threshold but still sizeable. Further reduction would require route-level lazy loading or replacing/treeshaking chart dependencies.
