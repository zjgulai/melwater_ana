# Melwater P11 Remote Deploy Automation Runbook

Date: 2026-06-12

## Scope

P11 turns the P8 release package into an auditable remote deployment workflow for Tencent Cloud CVM.

It adds:

- Remote preflight, deploy, and rollback command planner
- Explicit `--execute` gate before any remote mutation
- Public site smoke verifier
- Environment template for SSH, remote paths, service name, and verification token

## Files

- `server/remoteRelease.mjs`
- `server/verifyPublicSite.mjs`
- `deploy/env/remote-deploy.env.example`

Package scripts:

```bash
npm run deploy:preflight
npm run deploy:remote
npm run deploy:rollback
npm run deploy:verify-public
```

## Configuration

Copy and fill:

```bash
cp deploy/env/remote-deploy.env.example .remote-deploy.env
set -a
. ./.remote-deploy.env
set +a
```

Required values:

- `MELWATER_DEPLOY_HOST`
- `MELWATER_DEPLOY_USER`
- `REVIEW_STATE_API_BASE`
- `REVIEW_STATE_VERIFY_TOKEN`

Recommended Tencent Cloud defaults:

- App path: `/opt/melwater/playbook-pain-radar-lab`
- State path: `/var/lib/melwater/review-state`
- Stage path: `/tmp/melwater-deploy/releases`
- Service: `melwater-review-state-api`
- App user: `melwater`

Edge proxy refresh (for shared ingress scenarios):

- Set `MELWATER_EDGE_RESTART_ENABLED=1` (or any truthy value: `true`, `1`, `on`).
- Default container is `ai_video_nginx`; override with `MELWATER_EDGE_CONTAINER`.
- Optional override command `MELWATER_EDGE_REFRESH_CMD` (for example: `docker restart ai_video_nginx`).

## Preflight

Local preflight validates env variables and the latest local release package:

```bash
npm run deploy:preflight
```

Run read-only SSH checks:

```bash
npm run deploy:preflight -- --check-ssh
```

or:

```bash
npm run deploy:preflight -- --execute
```

The SSH check confirms:

- `node`, `npm`, `tar`, `rsync`, `sha256sum`, and `systemctl` exist on the server
- Passwordless sudo is available when `MELWATER_REMOTE_USE_SUDO=1`
- The remote stage parent directory can be created
- `docker` exists when edge refresh is enabled with the default docker command

## Deploy

Dry-run deploy plan:

```bash
npm run deploy:remote
```

Execute deploy after reviewing the JSON command plan:

```bash
npm run deploy:remote -- --execute
```

The deploy flow:

1. Creates a remote stage directory.
2. Uploads app tarball, rollback tarball, and `release-index.json`.
3. Verifies remote SHA256 checksums.
4. Creates a pre-deploy state backup when an existing app is present.
5. Extracts and syncs app files to `MELWATER_DEPLOY_PATH`.
6. Runs `npm ci --omit=dev`.
7. Runs review-state migration against `MELWATER_REMOTE_STATE_DIR`.
8. Restarts the systemd service.
9. Refreshes shared edge proxy (optional, non-blocking).
10. Runs authenticated deployment verification.

## Rollback

Dry-run rollback plan:

```bash
npm run deploy:rollback
```

Execute rollback:

```bash
npm run deploy:rollback -- --execute
```

The rollback flow restores:

- `rollback/dist/` to the app `dist/`
- `rollback/state/` to the persistent state directory

Then it replays state, refreshes the shared edge proxy (optional, non-blocking), and runs authenticated deployment verification.

## Public Site Smoke Check

Default target:

```bash
npm run deploy:verify-public
```

Override URL or expected text:

```bash
PUBLIC_SITE_URL=https://mkt.lute-tlz-dddd.top \
PUBLIC_SITE_EXPECT_TEXT=Melwater \
npm run deploy:verify-public
```

## Safety Rules

- Remote deploy and rollback are dry-run by default.
- Remote mutations require `--execute`.
- Tokens are read from environment variables only.
- No SSH key, token, or production host value is committed.
- Release and rollback tarballs are verified locally and remotely before mutation.

## Acceptance

P11 is accepted when:

- Missing production env vars fail preflight with explicit diagnostics.
- A fully configured dry-run prints deterministic deploy and rollback command plans.
- Public site smoke check returns `ok=true`.
- Existing build, release verification, and replay checks still pass.
