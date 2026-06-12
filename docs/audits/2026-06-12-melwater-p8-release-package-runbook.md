# Melwater P8 Release Package Runbook

Date: 2026-06-12

## Scope

P8 defines the release-package process for the Melwater Analyst Lab prototype.

It produces:

- App release folder and `.tar.gz`
- Rollback snapshot folder and `.tar.gz`
- Release index with tarball SHA256 checksums
- App `RELEASE_MANIFEST.json`
- Rollback `ROLLBACK_MANIFEST.json`

## Release Inputs

The app release intentionally includes only runtime/deployment files:

- `dist/`
- `server/`
- `deploy/`
- `package.json`
- `package-lock.json`
- `.env.example`
- `vite.config.mjs`

The app release intentionally excludes:

- `node_modules/`
- `.npm-cache/`
- `qa/`
- `src/`
- live `state/`
- historical screenshots/logs

The rollback snapshot includes:

- `dist/`
- `state/`
- `.env.example`

`state/backups/*` contents are excluded from the rollback tarball to avoid nesting historical backup packages into every release.

## Commands

Build and validate:

```bash
node ./node_modules/vite/bin/vite.js build
npm run review:replay
```

Create release package:

```bash
npm run release:package
```

Verify latest release package:

```bash
npm run release:verify
```

Verify a specific release:

```bash
node server/verifyReleasePackage.mjs --release-dir=/path/to/release
```

## Output Layout

Generated under:

```bash
outputs/prototypes/playbook-pain-radar-lab/releases/<release-id>/
```

Expected files:

```bash
app/
rollback/
release-index.json
<release-id>.tar.gz
<release-id>-rollback.tar.gz
```

## Deploy Handoff

For a Tencent Cloud CVM deployment, copy:

- `<release-id>.tar.gz`
- `<release-id>-rollback.tar.gz`
- `release-index.json`

Before applying:

```bash
sha256sum <release-id>.tar.gz
sha256sum <release-id>-rollback.tar.gz
```

Compare the results with `release-index.json`.

Deploy:

```bash
tar -xzf <release-id>.tar.gz
rsync -a app/ /opt/melwater/playbook-pain-radar-lab/
cd /opt/melwater/playbook-pain-radar-lab
npm ci --omit=dev
npm run review:migrate
sudo systemctl restart melwater-review-state-api
npm run review:verify-deploy -- --require-auth
```

## Rollback

Unpack rollback bundle:

```bash
tar -xzf <release-id>-rollback.tar.gz
sudo systemctl stop melwater-review-state-api
rsync -a rollback/dist/ /opt/melwater/playbook-pain-radar-lab/dist/
rsync -a rollback/state/ /var/lib/melwater/review-state/
sudo systemctl start melwater-review-state-api
npm run review:replay
npm run review:verify-deploy -- --require-auth
```

## Acceptance

A release is acceptable when:

- Build passes.
- Replay passes.
- `release:package` creates app and rollback bundles.
- `release:verify` passes with no checksum failures.
- Tarball SHA256 values exist in `release-index.json`.
- App tarball does not include `node_modules`, `qa`, or live `state`.
- Rollback tarball includes `dist` and `state` snapshot.
