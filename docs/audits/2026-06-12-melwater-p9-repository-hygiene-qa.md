# Melwater P9 Repository Hygiene QA

Date: 2026-06-12

## Scope

P9 organizes the P0-P8 prototype and documentation outputs into a commit-ready repository shape.

Goals:

- Keep source, deployment templates, and audit documents visible to git.
- Ignore heavy generated directories and mutable runtime state.
- Preserve the broad `*.json` safety policy for raw Meltwater exports while explicitly re-including lightweight prototype JSON required to build.
- Add a prototype README explaining source vs generated files.
- Make prototype `.npmrc` portable by using a relative `.npm-cache` path.

## Updated Ignore Policy

Added ignore rules for generated prototype artifacts:

- `outputs/prototypes/**/node_modules/`
- `outputs/prototypes/**/.npm-cache/`
- `outputs/prototypes/**/dist/`
- `outputs/prototypes/**/qa/`
- `outputs/prototypes/**/releases/`
- `outputs/prototypes/**/state/`

Added ignore rules for creative-production caches:

- `outputs/moodboards/**/.codex-exec/`
- `outputs/moodboards/**/generated/.codex-exec/`
- `outputs/moodboards/**/generated/mcp-thumbs/`

Added re-include rules for prototype build files blocked by broad JSON/data ignores:

- `outputs/prototypes/**/package.json`
- `outputs/prototypes/**/package-lock.json`
- `outputs/prototypes/**/.env.example`
- `outputs/prototypes/**/src/data/`
- `outputs/prototypes/**/src/data/*.json`

## Commit Candidate Groups

Recommended to commit:

- `.gitignore`
- `docs/audits/2026-06-12-*.md`
- `scripts/build_frontend_snapshot.py`
- `outputs/prototypes/playbook-pain-radar-lab/README.md`
- `outputs/prototypes/playbook-pain-radar-lab/AGENTS.md`
- `outputs/prototypes/playbook-pain-radar-lab/design-qa.md`
- `outputs/prototypes/playbook-pain-radar-lab/.env.example`
- `outputs/prototypes/playbook-pain-radar-lab/.npmrc`
- `outputs/prototypes/playbook-pain-radar-lab/package.json`
- `outputs/prototypes/playbook-pain-radar-lab/package-lock.json`
- `outputs/prototypes/playbook-pain-radar-lab/index.html`
- `outputs/prototypes/playbook-pain-radar-lab/vite.config.mjs`
- `outputs/prototypes/playbook-pain-radar-lab/src/`
- `outputs/prototypes/playbook-pain-radar-lab/server/`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/`
- `outputs/moodboards/playbook-analyst-lab-warm-neutral/run/` visual reference files, excluding execution caches and thumbnails
- `outputs/site-audit/mkt-live-home.png`

Do not commit:

- `outputs/prototypes/playbook-pain-radar-lab/node_modules/`
- `outputs/prototypes/playbook-pain-radar-lab/.npm-cache/`
- `outputs/prototypes/playbook-pain-radar-lab/dist/`
- `outputs/prototypes/playbook-pain-radar-lab/qa/`
- `outputs/prototypes/playbook-pain-radar-lab/state/`
- `outputs/prototypes/playbook-pain-radar-lab/releases/`
- `outputs/moodboards/**/.codex-exec/`
- `outputs/moodboards/**/generated/mcp-thumbs/`

## QA Results

Repository size before ignore cleanup:

```text
2.8G repo total
445M outputs
431M prototype directory
241M prototype node_modules
166M prototype .npm-cache
17M prototype QA screenshots
5.2M prototype releases
```

Git ignore probes passed:

- `node_modules/react/package.json` ignored.
- `.npm-cache/_update-notifier-last-checked` ignored.
- `dist/index.html` ignored.
- `qa/p4-audit-log.png` ignored.
- `state/review-state.json` ignored.
- `releases/*/release-index.json` ignored.
- `src/data/vocData.json` visible.
- `package.json` visible.
- `.env.example` visible.

Prototype `.npmrc`:

```ini
cache=.npm-cache
fund=false
audit=false
```

Build/verification:

- `node ./node_modules/vite/bin/vite.js build` passed.
- `npm run review:replay` passed.
- `node server/verifyReleasePackage.mjs` passed.
- Existing Recharts chunk-size warning remains non-blocking.

## Acceptance

P9 is accepted when:

- Heavy generated directories are ignored.
- Lightweight prototype source files remain visible to git.
- The prototype README documents generated vs source boundaries.
- Commit candidate groups are documented.
- No tracked user changes were reverted.
