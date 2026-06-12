# Melwater P8 Release Package QA

Date: 2026-06-12

## Scope

P8 validates the release and rollback package workflow for Melwater Analyst Lab.

Implemented scripts:

- `server/createReleasePackage.mjs`
- `server/verifyReleasePackage.mjs`

Package scripts:

```bash
npm run release:package
npm run release:verify
```

Runbook:

- `docs/audits/2026-06-12-melwater-p8-release-package-runbook.md`

## QA Results

Syntax:

```bash
node --check server/createReleasePackage.mjs
node --check server/verifyReleasePackage.mjs
```

Result: passed.

Build:

```bash
node ./node_modules/vite/bin/vite.js build
```

Result: passed.

Known note: Vite still reports the existing Recharts chunk-size warning. It is not a build failure.

Replay:

```json
{
  "ok": true,
  "eventCount": 8,
  "replayedEventCount": 0,
  "baselineCreatedAt": "2026-06-12T09:34:21.126Z"
}
```

Release package:

```json
{
  "ok": true,
  "releaseId": "playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z",
  "appFileCount": 22,
  "rollbackFileCount": 15,
  "appTarballBytes": 269452,
  "rollbackTarballBytes": 242017
}
```

Release verification:

```json
{
  "ok": true,
  "releaseId": "playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z",
  "appFileCount": 22,
  "rollbackFileCount": 15,
  "failures": []
}
```

Tarball checksum index:

```json
{
  "appTarballSha256": "d79590dc555d0d230aeace28a10475d7ffa93dc8fe40890df6c81612a364bb05",
  "rollbackTarballSha256": "ec2cdf140f83c88d4c12c6119ff13cee1c5e8615ef58f3a059f1cbfa79e9ee89"
}
```

App tarball spot-check:

- Includes `app/dist/index.html`
- Includes `app/server/reviewStateServer.mjs`
- Includes `app/deploy/nginx/melwater.conf`
- Includes `app/package-lock.json`
- Excludes `node_modules`
- Excludes `qa`
- Excludes live `state`

Rollback tarball spot-check:

- Includes `rollback/dist/index.html`
- Includes `rollback/state/review-state.json`
- Includes `rollback/state/review-events.jsonl`
- Includes `rollback/state/review-state-baseline.json`
- Includes `rollback/ROLLBACK_MANIFEST.json`

## Output

Latest release directory:

```bash
outputs/prototypes/playbook-pain-radar-lab/releases/playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z
```

Primary app tarball:

```bash
outputs/prototypes/playbook-pain-radar-lab/releases/playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z/playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z.tar.gz
```

Rollback tarball:

```bash
outputs/prototypes/playbook-pain-radar-lab/releases/playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z/playbook-pain-radar-lab-0.0.0-2026-06-12T11-33-45-644Z-rollback.tar.gz
```

## Acceptance

P8 passed syntax checks, build, replay, release packaging, release verification, tarball checksum generation, and app/rollback tarball content spot-checks.

## Remaining Gaps

- No remote upload to Tencent Cloud was executed.
- No one-command SSH deploy script exists yet.
- Release version still follows package version `0.0.0` plus timestamp; semantic release tagging is not configured.
- Release artifacts live under the prototype output directory and are not yet organized as a top-level product deliverable.
