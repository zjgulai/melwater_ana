# Melwater P12 Production Gate QA

Date: 2026-06-12

## Scope

P12 executes the production go-live gate one step at a time. Each step has a test command, acceptance result, and next-action decision.

No production deployment was executed in this round because Tencent Cloud SSH credentials and the production verification token are not available in the current Codex session.

## Gate 1: Local Release Baseline

Command:

```bash
git status --short
git log -1 --oneline
npm run release:verify
npm run review:replay
npm run build
```

Result:

- Pass.
- Current commit: `dd706396 Add remote deploy automation`.
- Latest release ID: `playbook-pain-radar-lab-0.0.0-2026-06-12T12-01-03-693Z`.
- App tarball SHA256: `0bc5e35b46e7cc428e0dce1cf8069f208e7d678d8b3c452a1130e0b5d2128ec5`.
- Rollback tarball SHA256: `0db1ac5d3db19a5fa6696b02f7ca270f4fbf04dbde80f05806a8197302317318`.
- `release:verify` passed with no failures.
- `review:replay` passed with 8 total events and 0 replay delta events.
- Vite build passed.

Acceptance:

- Gate passed.
- The Vite chunk-size warning remains a performance debt, not a release blocker for this gate.

## Gate 2: Production Input Readiness

Command:

```bash
test -f .remote-deploy.env
```

Environment presence check:

- `.remote-deploy.env`: missing
- `MELWATER_DEPLOY_HOST`: missing
- `MELWATER_DEPLOY_USER`: missing
- `MELWATER_DEPLOY_PORT`: missing
- `MELWATER_SSH_KEY_PATH`: missing
- `REVIEW_STATE_API_BASE`: missing
- `REVIEW_STATE_VERIFY_TOKEN`: missing

Acceptance:

- Gate blocked.
- Required inputs must be supplied from Tencent Cloud and production secret management before any real deployment.

## Gate 3: Remote Preflight

Command:

```bash
npm run deploy:preflight
```

Result:

- Expected fail.
- Local release artifact validation passed.
- Remote SSH preflight did not run because required production env vars are missing.

Explicit missing values reported by the script:

- `MELWATER_DEPLOY_HOST`
- `MELWATER_DEPLOY_USER`
- `REVIEW_STATE_API_BASE`
- `REVIEW_STATE_VERIFY_TOKEN`

Acceptance:

- Gate blocked until production env is supplied.
- This is a safe block: no SSH connection or remote mutation occurred.

## Gate 4: Public Site Smoke Check

Command:

```bash
npm run deploy:verify-public
```

Result:

- Pass.
- URL: `https://mkt.lute-tlz-dddd.top/`
- Status: `HTTP 200`
- Title: `Momcozy - Market Insight Platform`
- Response size: 581 bytes

Acceptance:

- Gate passed for public homepage reachability.
- This does not validate the review-state API endpoint because no production API token is available.

## Gate 5: Deploy Dry-Run Plan

Command:

```bash
MELWATER_DEPLOY_HOST=203.0.113.10 \
MELWATER_DEPLOY_USER=ubuntu \
REVIEW_STATE_API_BASE=https://mkt.lute-tlz-dddd.top/api/review-state \
REVIEW_STATE_VERIFY_TOKEN=placeholder \
npm run deploy:remote
```

Result:

- Pass.
- Dry-run only; no remote execution.
- Command plan includes:
  - remote tool preflight
  - remote stage directory creation
  - upload of app tarball, rollback tarball, and `release-index.json`
  - remote SHA256 verification
  - pre-deploy state backup
  - app sync to `/opt/melwater/playbook-pain-radar-lab`
  - `npm ci --omit=dev`
  - review-state migration
  - systemd restart
  - authenticated deployment verification
- Token is redacted in command output.

Acceptance:

- Gate passed as a dry-run plan.
- Real deployment remains blocked until production env is supplied and `--execute` is intentionally added.

## Gate 6: Rollback Dry-Run Plan

Command:

```bash
MELWATER_DEPLOY_HOST=203.0.113.10 \
MELWATER_DEPLOY_USER=ubuntu \
REVIEW_STATE_API_BASE=https://mkt.lute-tlz-dddd.top/api/review-state \
REVIEW_STATE_VERIFY_TOKEN=placeholder \
npm run deploy:rollback
```

Result:

- Pass.
- Dry-run only; no remote execution.
- Command plan includes:
  - remote tool preflight
  - remote stage directory creation
  - artifact upload and checksum verification
  - service stop
  - `rollback/dist/` restore
  - `rollback/state/` restore
  - ownership repair
  - state replay
  - service start
  - authenticated deployment verification
- Token is redacted in command output.

Acceptance:

- Gate passed as a rollback dry-run plan.
- Real rollback remains blocked until production env is supplied and `--execute` is intentionally added.

## Go-Live Decision

Current decision: **No-go for real production deployment**.

Reason:

- Local release baseline is ready.
- Public homepage is reachable.
- Deploy and rollback plans are ready.
- Remote preflight and production API verification cannot be executed without Tencent Cloud SSH credentials and production verification token.

## Required Inputs For Next Gate

Prepare a local, uncommitted `.remote-deploy.env` from:

```bash
outputs/prototypes/playbook-pain-radar-lab/deploy/env/remote-deploy.env.example
```

Fill:

- `MELWATER_DEPLOY_HOST`
- `MELWATER_DEPLOY_USER`
- `MELWATER_DEPLOY_PORT`
- `MELWATER_SSH_KEY_PATH`
- `REVIEW_STATE_API_BASE`
- `REVIEW_STATE_VERIFY_TOKEN`

Then run:

```bash
set -a
. ./.remote-deploy.env
set +a
npm run deploy:preflight -- --check-ssh
```

Only after that passes should production deploy be considered:

```bash
npm run deploy:remote -- --execute
```
