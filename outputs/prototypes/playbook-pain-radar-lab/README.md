# Melwater Analyst Lab Prototype

Interactive VOC closed-loop analytics prototype for the Melwater playbook workstream.

## What Is Source

Commit-worthy source files:

- `src/`
- `server/`
- `deploy/`
- `package.json`
- `package-lock.json`
- `.env.example`
- `.npmrc`
- `vite.config.mjs`
- `index.html`
- `AGENTS.md`
- `design-qa.md`

Generated/runtime files are intentionally ignored by git:

- `node_modules/`
- `.npm-cache/`
- `dist/`
- `qa/`
- `state/`
- `releases/`

## Rebuild

```bash
npm ci
node ./node_modules/vite/bin/vite.js build
npm run review:migrate
npm run review:replay
```

## Run Locally

```bash
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173/
```

## Review State

Local review-state files are generated under `state/` and are not committed.

Useful commands:

```bash
npm run review:migrate
npm run review:replay
npm run review:backup -- --label=manual
npm run review:verify-deploy
```

## Release Package

```bash
npm run release:package
npm run release:verify
```

Generated release bundles are written to `releases/` and are not committed. Keep them as local or external deployment artifacts.
