# Melwater P7 Tencent Cloud Deployment Runbook

Date: 2026-06-12

## Scope

P7 turns the P6 hardened prototype into a deployable operations package for a Tencent Cloud CVM or lightweight Linux server.

This round does not deploy to production directly. It adds deployable artifacts, self-check scripts, backup retention, and an acceptance checklist.

## Added Artifacts

Deployment templates:

- `deploy/env/melwater-review-state.env.example`
- `deploy/systemd/melwater-review-state-api.service`
- `deploy/pm2/ecosystem.config.cjs`
- `deploy/nginx/melwater.conf`
- `deploy/crontab/review-state-backup.cron`

Ops scripts:

- `server/verifyDeployment.mjs`
- `server/pruneReviewBackups.mjs`

Package scripts:

```bash
npm run review:verify-deploy
npm run review:prune-backups
```

## Recommended Tencent Cloud Layout

Use one CVM or lightweight application server first:

- App path: `/opt/melwater/playbook-pain-radar-lab`
- Persistent state: `/var/lib/melwater/review-state`
- Environment file: `/etc/melwater/review-state.env`
- Frontend static files: `/opt/melwater/playbook-pain-radar-lab/dist`
- API upstream: `127.0.0.1:4174`
- Public origin: `https://melwater.example.com`

Security expectations:

- Bind Node API to `127.0.0.1`, not public `0.0.0.0`.
- Expose only Nginx HTTPS publicly.
- Keep `REVIEW_STATE_TOKENS` outside git.
- Pin `REVIEW_STATE_CORS_ORIGIN` to the production frontend origin.
- Restrict SSH access with Tencent Cloud security groups.

## Deployment Steps

1. Create service user and directories:

```bash
sudo useradd --system --home /opt/melwater --shell /usr/sbin/nologin melwater
sudo mkdir -p /opt/melwater/playbook-pain-radar-lab /var/lib/melwater/review-state /etc/melwater
sudo chown -R melwater:melwater /opt/melwater /var/lib/melwater
```

2. Copy project files to:

```bash
/opt/melwater/playbook-pain-radar-lab
```

3. Install dependencies and build:

```bash
cd /opt/melwater/playbook-pain-radar-lab
npm ci
npm run build
npm run review:migrate
npm run review:backup -- --label=pre-deploy
```

4. Create `/etc/melwater/review-state.env` from:

```bash
deploy/env/melwater-review-state.env.example
```

Set real values for:

- `REVIEW_STATE_DIR`
- `REVIEW_STATE_CORS_ORIGIN`
- `REVIEW_STATE_TOKENS`
- `REVIEW_STATE_API_BASE`
- `REVIEW_STATE_VERIFY_TOKEN`

5. Choose one process manager.

Systemd:

```bash
sudo cp deploy/systemd/melwater-review-state-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now melwater-review-state-api
sudo systemctl status melwater-review-state-api
```

PM2 alternative:

```bash
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
```

6. Configure Nginx:

```bash
sudo cp deploy/nginx/melwater.conf /etc/nginx/conf.d/melwater.conf
sudo nginx -t
sudo systemctl reload nginx
```

7. Add backup cron:

```bash
crontab -u melwater deploy/crontab/review-state-backup.cron
```

## Post-Deploy Acceptance

Run from the server:

```bash
cd /opt/melwater/playbook-pain-radar-lab
npm run review:verify-deploy
npm run review:verify-deploy -- --require-auth
npm run review:backup -- --label=post-deploy
npm run review:prune-backups -- --keep=14
```

Expected:

- `health.ok = true`
- `replay.ok = true`
- Metrics include `melwater_review_state_replay_ok 1`
- `--require-auth` passes in production
- Backup package is created
- Prune dry-run does not delete unless `--apply` is present

## Rollback

1. Stop API:

```bash
sudo systemctl stop melwater-review-state-api
```

2. Restore previous build files under `/opt/melwater/playbook-pain-radar-lab`.

3. Restore state from a backup directory if needed:

```bash
sudo cp /var/lib/melwater/review-state/backups/<backup>/review-state* /var/lib/melwater/review-state/
sudo cp /var/lib/melwater/review-state/backups/<backup>/*.csv /var/lib/melwater/review-state/
```

4. Re-run:

```bash
npm run review:replay
sudo systemctl start melwater-review-state-api
npm run review:verify-deploy
```

## Acceptance

P7 is accepted when:

- Deployment templates exist.
- Backup retention can run dry-run and apply mode.
- Deployment self-check passes against local or staging API.
- Build and replay still pass.
- Runbook defines deploy, verify, backup, prune, and rollback steps.

## Remaining Gaps

- This is still a file-backed state service, not a database-backed HA service.
- No Tencent Cloud CAM/Secrets Manager integration is implemented.
- No SSL certificate automation is included.
- No external observability sink is configured yet.
- No blue-green release script is included.
