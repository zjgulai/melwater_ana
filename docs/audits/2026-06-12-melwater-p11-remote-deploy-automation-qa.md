# Melwater P11 Remote Deploy Automation QA

Date: 2026-06-12

## QA Scope

This QA validates the remote deployment automation layer added after P10.

It does not execute production deployment because no Tencent Cloud SSH host, SSH key, or production admin token is available in this Codex session.

## Expected Local Behavior

- `npm run deploy:preflight` should fail locally until required production env vars are provided.
- `npm run deploy:remote` should fail locally until required production env vars are provided.
- With placeholder env vars, dry-run deploy should print a command plan and should not connect to production.
- `npm run deploy:verify-public` should check the configured public homepage.

## Commands

```bash
node --check server/remoteRelease.mjs
node --check server/verifyPublicSite.mjs
npm run deploy:preflight
MELWATER_DEPLOY_HOST=203.0.113.10 \
MELWATER_DEPLOY_USER=ubuntu \
REVIEW_STATE_API_BASE=https://mkt.lute-tlz-dddd.top/api/review-state \
REVIEW_STATE_VERIFY_TOKEN=placeholder \
npm run deploy:remote
MELWATER_DEPLOY_HOST=203.0.113.10 \
MELWATER_DEPLOY_USER=ubuntu \
REVIEW_STATE_API_BASE=https://mkt.lute-tlz-dddd.top/api/review-state \
REVIEW_STATE_VERIFY_TOKEN=placeholder \
npm run deploy:rollback
npm run deploy:verify-public
npm run release:package
npm run release:verify
npm run review:replay
node ./node_modules/vite/bin/vite.js build
```

## Results

| Check | Result | Notes |
|---|---:|---|
| `node --check server/remoteRelease.mjs` | Pass | Syntax valid |
| `node --check server/verifyPublicSite.mjs` | Pass | Syntax valid |
| `npm run deploy:preflight` without env | Expected fail | Missing `MELWATER_DEPLOY_HOST`, `MELWATER_DEPLOY_USER`, `REVIEW_STATE_API_BASE`, `REVIEW_STATE_VERIFY_TOKEN` |
| Placeholder deploy dry-run | Pass | Generated command plan, no remote execution, token redacted |
| Placeholder rollback dry-run | Pass | Generated rollback plan, no remote execution, token redacted |
| `npm run deploy:verify-public` | Pass | `https://mkt.lute-tlz-dddd.top/` returned `HTTP 200`, title `Momcozy - Market Insight Platform` |
| `npm run review:replay` | Pass | State replay ok |
| `npm run build` | Pass | Vite build ok; chunk-size warning remains |
| `npm run release:package` | Pass | Created P11 release package |
| `npm run release:verify` | Pass | Latest release package verified |

Latest P11 release:

- Release ID: `playbook-pain-radar-lab-0.0.0-2026-06-12T12-01-03-693Z`
- App tarball SHA256: `0bc5e35b46e7cc428e0dce1cf8069f208e7d678d8b3c452a1130e0b5d2128ec5`
- Rollback tarball SHA256: `0db1ac5d3db19a5fa6696b02f7ca270f4fbf04dbde80f05806a8197302317318`

## Production Gaps

- SSH execution still requires real Tencent Cloud connection details.
- `REVIEW_STATE_VERIFY_TOKEN` must be provisioned from production secrets.
- The server must already have systemd, Nginx, Node, npm, tar, rsync, and sha256sum.
- Passwordless sudo is expected when `MELWATER_REMOTE_USE_SUDO=1`.
