# Melwater Capability, Debt, and Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the current truth of the Melwater project, convert the audit into a prioritized execution roadmap, and close the remaining gaps between data collection, ETL, insight generation, product UX, production operations, and business action feedback.

**Architecture:** The system is a three-layer product: raw Meltwater exports and staged Excel/SQLite data marts, a VOC insight model that turns evidence into playbook outputs and action registers, and a React/Vite analyst product deployed on Tencent Cloud with Docker, cron, backup, health, and alerting scripts.

**Tech Stack:** Python 3.12, `uv`, `openpyxl`, `ijson`, SQLite marts, pytest, Ruff, mypy, Bandit, React 19, Vite 8, Recharts, Node.js, Docker Compose, Nginx, Tencent Cloud Lighthouse, shell/Node release automation.

---

## 1. Evidence Snapshot

Audit evidence was collected from the local repository, generated manifests, production server, test commands, and git history.

Current verified gates:

- [x] `make quality` passed: 35 pytest tests, Excel validation PASS, checksum verification, Ruff, mypy, and Bandit.
- [x] Frontend `npm run test:webhook-readiness` passed: 3 webhook readiness tests.
- [x] Frontend `npm run build` passed with Vite production bundle generation.
- [x] Production containers are running and healthy: `melwater_web` and `melwater_api`.
- [x] Production `/health` reports `ok: true` for release `playbook-pain-radar-lab-0.0.0-2026-06-13T10-12-36-766Z`.
- [x] Data mart manifest reports `status: PASS`.

Current data asset truth:

- Raw document occurrences: 347,138.
- Unique document ids: 336,435.
- Category unique documents: 吸奶器 129,569, 暖奶器 195,984, 消毒器 16,789.
- Relation rows: 6,871,226.
- Known source gaps in the latest inventory: none.
- Formula-like risky text count: 165,668, with generated workbooks reporting zero formulas.
- Invalid XML strings: 0.
- Documents without id: 0.

Current mart/product truth:

- Generated marts include search quality, pain radar, weekly category health, weekly deltas, competitor battlecards, content opportunity, platform opportunity, quote library, crisis watch, region/language priority, concept candidates, executive monthly, query rewrite recommendations, insight register, evidence samples, sample reviews, action register, action feedback overlay, and action status summaries.
- Product JSON currently exposes 21 pain cards, 57 proposed actions, 18 competitor battlecards, 30 content opportunities, 21 concept candidates, 30 crisis watch rows, 30 region priority rows, 14 executive monthly rows, 120 quotes, and 2 blocked search-quality gates.

## 2. Current Capabilities

The project already provides more than a static dashboard. It is an operational VOC analytics pipeline with deployment automation.

Data and ETL capabilities:

- [x] Inventory raw Meltwater JSON exports and produce source manifests.
- [x] Stage raw documents with deduplication and category attribution.
- [x] Build complete Excel packages with workbook validation and checksum verification.
- [x] Build SQLite and CSV/Markdown marts from staged data.
- [x] Generate sample review queues for human QA.
- [x] Generate query rewrite recommendations when search quality falls below threshold.
- [x] Generate action registers and action feedback overlays.

Insight capabilities:

- [x] Product pain radar: severity, evidence depth, sentiment, category and representative issue grouping.
- [x] Weekly category health and delta detection.
- [x] Competitor battlecards.
- [x] Content opportunity and platform content opportunity.
- [x] Crisis watch.
- [x] Region and language priority analysis.
- [x] Concept candidates.
- [x] Executive monthly brief.
- [x] User voice quote library.
- [x] Evidence-backed insight register.

Product capabilities:

- [x] Analyst-facing React UI for Melwater VOC review and decision workflows.
- [x] Static product data bundle generated from marts.
- [x] Review-state API and local state persistence.
- [x] Meeting snapshot and review workflow support.
- [x] Production build and Docker deployment scripts.
- [x] Health, ops report, backup, rollback, alert test, alert drill, and webhook readiness scripts.

Production capabilities:

- [x] Tencent Cloud deployment under `melwater.lute-tlz-dddd.top`.
- [x] Docker Compose isolation for Melwater app services.
- [x] Production healthcheck and ops reporting.
- [x] Backup scripts and backup files present on server.
- [x] Release packaging, remote deploy, rollback, checklist, and orchestration scripts.

## 3. Business Problems Solved

The current system can already answer these concrete business questions:

- Which product pain points are most severe, most frequent, and best supported by evidence?
- Which issues should be handled by Product, CX, Content, Marketing, or PR?
- Which search queries are too noisy to trust, and how should they be rewritten?
- Which competitor claims, feature gaps, and customer complaints should enter battlecards?
- Which user quotes can support product decisions, landing pages, ad briefs, or CX training?
- Which region/language combinations deserve priority because demand or pain is concentrated there?
- Which content topics should be created next, by platform and issue family?
- Which concepts or feature ideas are backed by recurring VOC evidence?
- Which crisis signals are emerging and need review?
- What executive summary can be produced monthly from the evidence base?

## 4. Business Value

The value is strongest when the project is treated as a closed-loop operating system, not a report generator.

High-confidence value:

- Product prioritization: converts noisy social/customer voice into issue cards with evidence depth.
- CX and operations: gives recurring pain clusters and quotes that can become scripts, macros, and service actions.
- Content and growth: turns questions, confusion, and competitor gaps into content briefs.
- Competitive intelligence: compiles battlecards from user voice rather than only internal assumptions.
- Executive reporting: gives monthly evidence-backed summaries instead of anecdotal updates.
- Data governance: makes source counts, deduplication, validation, checksum, and formula-safety visible.

Conditional value:

- Revenue attribution and retention impact require external data such as orders, returns, tickets, CRM, reviews, or SKU-level performance.
- Action ROI requires real owner assignment and feedback after actions ship.
- Search-quality confidence requires actually rewriting blocked queries and re-collecting affected Meltwater searches.

## 5. Scalability Assessment

The current architecture is fit for prototype-to-internal-product use. It is not yet a high-concurrency or multi-tenant analytics platform.

Strengths:

- Python ETL is reproducible through CLI commands and Makefile gates.
- Data package validation is strong for local artifact integrity.
- SQLite marts and static JSON keep deployment simple.
- Docker deployment is isolated from other server apps.
- Release, backup, rollback, and alerting scripts reduce operator dependency.

Scalability limits:

- Local workspace contains large ignored artifacts: repo working directory is about 2.8 GB, with `data/`, `exports_20260520/`, and prototype runtime assets as the dominant size.
- Excel remains useful for delivery, but large relationship tables and repeated regeneration should move toward Parquet, DuckDB, or warehouse-backed marts for scale.
- Frontend currently consumes a static JSON bundle, which is simple but limits incremental refresh, access control, and multi-user personalization.
- Review-state storage is acceptable for an internal prototype, but should move to a managed database before concurrent business users depend on it.
- CI cannot reliably run full data validation unless data fixtures and full-artifact jobs are separated.

## 6. Fragility and Debt Register

| ID | Area | Diagnosis | Impact | Priority |
| --- | --- | --- | --- | --- |
| B-01 | Branching | `origin/codex/fix-playbook-deploy-checklist` is not merged into `origin/main`. | Production operations work can be lost or deployed from a non-main branch. | P0 |
| B-02 | Branching | Local `main` is ahead of `origin/main` by one commit, while current branch has five additional commits beyond local main. | Release truth is split across local main, remote main, and feature branch. | P0 |
| O-01 | Production ops | Real alert webhook is not configured; readiness correctly fails with missing `MELWATER_ALERT_WEBHOOK_URL`. | Incident notification proof is incomplete until Feishu or another real webhook exists. | P0 |
| O-02 | Production ops | Latest alert drill evidence points to an older release than current production health release. | Observability evidence is not fully release-aligned. | P0 |
| O-03 | Production inventory | `config/production.example.json` still contains placeholder owner/resource/SLO fields. | Handoff and incident ownership remain weak. | P0 |
| D-01 | Documentation | `TODO.md` still claims the pump secondary backfill is blocked, while current README/manifests indicate latest data is complete. | Operators can follow stale backlog instructions. | P0 |
| D-02 | Documentation | Older GAP/audit docs are partially stale after later implementation rounds. | Readers can misjudge current maturity and duplicate completed work. | P1 |
| DATA-01 | Artifact management | Large raw data, output, node modules, release, and state artifacts live inside the workspace, mostly ignored by git. | Backup, search, onboarding, and CI become slow and error-prone. | P1 |
| DATA-02 | Business data | Playbook branches that require orders, returns, tickets, CRM, review platforms, or SKU data are not fully actionable. | Cannot close revenue, retention, defect, or ROI analysis loops. | P1 |
| DATA-03 | Action loop | `measuredActions` is 0 and `action_feedback_applied` is 0. | The system recommends actions but does not yet prove action impact. | P0 |
| FE-01 | Frontend architecture | Product surface has grown beyond the original pain radar into many workflows; component/data boundaries need hardening. | Future features become harder to test and modify safely. | P1 |
| ENG-01 | CI/CD | Local gates pass, but a durable CI matrix is not yet documented as source of truth. | Regression detection depends on local discipline. | P1 |
| SEC-01 | Secret hygiene | `ai_video.pem` exists in the project root and is ignored. | Accidental disclosure risk remains higher than necessary. | P0 |
| QA-01 | Product QA | Some post-deploy browser/manual validation notes are recommended but not yet durable acceptance evidence. | UI regressions can pass backend/build gates. | P1 |

## 7. Unfinished Work and Gaps

Closed or mostly closed:

- [x] Git repository exists and remote is configured.
- [x] Core ETL, Excel validation, checksums, lint, type, tests, and security gates pass.
- [x] Main playbook branches are represented by marts and frontend data.
- [x] Tencent Cloud deployment exists and containers are healthy.
- [x] Release, backup, health, ops, rollback, and alert-drill scripts exist.

Still open:

- [ ] Merge or intentionally retire the unmerged production-ops branch.
- [ ] Align remote `main`, local `main`, current branch, and production release reference.
- [ ] Configure a real alert webhook and rerun readiness against production.
- [ ] Rerun alert drill against the current production release reference.
- [ ] Replace production placeholder inventory with real owner, resource, domain, SLO, backup, and alert channel data.
- [ ] Update stale TODO and mark old audit docs as historical when superseded.
- [ ] Move secrets out of the project root into SSH agent or a secrets directory outside the repo.
- [ ] Create fixture-based CI for pull requests and full-data validation for scheduled/release jobs.
- [ ] Add browser-level product acceptance tests for the main analyst workflows.
- [ ] Fill real action owners and apply action feedback after actions ship.
- [ ] Re-run blocked query families after query rewrite and new Meltwater collection.
- [ ] Integrate CS tickets, returns, reviews, orders, or CRM data before claiming ROI/retention playbook completion.

## 8. Git Branch and Merge Status

Current branch:

- `codex/fix-playbook-deploy-checklist`
- HEAD: `fda8d752 chore: add external webhook readiness gate`
- Tracking: `origin/codex/fix-playbook-deploy-checklist`

Remote state:

- `origin/main`: `b777ef69`
- `origin/codex/fix-playbook-deploy-checklist`: `fda8d752`

Local main state:

- `main`: `d9a755b7 chore: add melwater docker release checklist runbook`
- Local `main` is ahead of `origin/main` by one commit.

Unmerged work relative to `origin/main`:

- `d9a755b7 chore: add melwater docker release checklist runbook`
- `8838005d chore: harden melwater deploy orchestrate and token verification flow`
- `439e48ef chore: close production observability loop`
- `db9d4459 chore: prepare external alert webhook smoke tests`
- `a0734bce chore: add production alert drill loop`
- `fda8d752 chore: add external webhook readiness gate`

Recommendation:

- Treat `codex/fix-playbook-deploy-checklist` as the current release-hardening branch.
- Open or merge it into `main` after rerunning local quality gates and production release-alignment checks.
- Push `main` only after confirming whether `origin/main` should receive all six commits or whether a PR review step is required.

## 9. Optimization Roadmap

### Phase 0: Source-of-Truth Alignment

Target: same day.

- [ ] Decide whether current release-hardening branch should merge directly to `main` or go through PR.
- [ ] Run `git log origin/main..HEAD --oneline` and attach the six unmerged commits to the release note.
- [ ] Run local gates again before merge: `make quality`, `npm run test:webhook-readiness`, `npm run build`.
- [ ] Merge or PR `codex/fix-playbook-deploy-checklist`.
- [ ] Tag the aligned release after merge.
- [ ] Update deployment notes so production release reference maps to a git commit, not only a package timestamp.

Acceptance:

- [ ] `origin/main` or an open PR contains the production ops work.
- [ ] Production release reference maps to an auditable git commit.
- [ ] No operator needs to infer release truth from local branches.

### Phase 1: Production Operations Closure

Target: 1-2 days after alert channel is available.

- [ ] Configure `MELWATER_ALERT_WEBHOOK_URL` on Tencent Cloud.
- [ ] Run webhook readiness with the real webhook.
- [ ] Rerun alert drill after the latest release is deployed.
- [ ] Confirm ops report references the current release.
- [ ] Confirm backup script writes usable restore artifacts.
- [ ] Fill production inventory with owner, Tencent resources, public domains, health URLs, SLO, backup cadence, and alert channel.

Acceptance:

- [ ] Webhook readiness returns `ok: true`.
- [ ] Latest alert drill release reference equals current production release reference.
- [ ] Production inventory has no placeholder owner/resource/SLO fields.
- [ ] Backup restore drill has dated evidence.

### Phase 2: Documentation Truth Cleanup

Target: 1 day.

- [ ] Update `TODO.md` to reflect the current data state and remove stale backfill blocker wording.
- [ ] Add a documentation index that separates current runbooks from historical audits.
- [ ] Mark superseded GAP analysis docs as historical and link to the latest capability/debt roadmap.
- [ ] Add a release-readiness checklist that references the exact commands and expected outputs.

Acceptance:

- [ ] New maintainers can identify the current source of truth in under 5 minutes.
- [ ] No current document says a completed backfill is still blocked.
- [ ] Historical docs remain available but are not mistaken for current state.

### Phase 3: Closed-Loop Business Operations

Target: 1-2 weeks.

- [ ] Replace example action owner config with real owner routing for Product, CX, Content, Marketing, PR, and Data.
- [ ] Select a first batch of 10-15 high-priority actions from `action_register.csv`.
- [ ] Track action state: proposed, owner accepted, shipped, measured, closed, rejected.
- [ ] Apply action feedback to the mart pipeline.
- [ ] Create a weekly business review ritual using executive monthly, pain radar, action status, and evidence samples.

Acceptance:

- [ ] `action_feedback_applied` is greater than 0.
- [ ] `measuredActions` is greater than 0.
- [ ] At least one issue family has shipped action evidence and post-action measurement.

### Phase 4: Search Quality Improvement Loop

Target: 1 week for first iteration.

- [ ] Review the 2 blocked search-quality gates.
- [ ] Apply query rewrite recommendations to Meltwater search definitions.
- [ ] Recollect affected query windows.
- [ ] Rebuild stage, marts, and frontend data.
- [ ] Compare precision, sample review verdicts, and issue distribution before/after.

Acceptance:

- [ ] Previously blocked query families pass configured precision threshold or remain blocked with explicit business exception.
- [ ] Query rewrite decisions are documented with before/after sample evidence.

### Phase 5: Engineering and CI Hardening

Target: 1-2 weeks.

- [ ] Create a pull-request CI path using small fixtures for Python tests, lint, type, security, and frontend build.
- [ ] Create a scheduled or manually triggered full-data validation job.
- [ ] Add browser-level acceptance tests for overview, pain radar, battlecards, content briefs, action register, and meeting snapshot.
- [ ] Split frontend into route-level modules and data access helpers.
- [ ] Add bundle-size tracking and route-level lazy loading where appropriate.

Acceptance:

- [ ] PR checks catch frontend, ETL, and security regressions without requiring full private data.
- [ ] Full-data validation still runs before releases.
- [ ] Main analyst workflows have browser-level test coverage.

### Phase 6: Data Platform and Artifact Hygiene

Target: 2-4 weeks.

- [ ] Move raw exports, generated data packages, releases, backups, and runtime state out of the repository workspace into a documented artifact store.
- [ ] Keep only manifests, schemas, samples, and reproducible scripts in git.
- [ ] Introduce Parquet or DuckDB-backed intermediate marts for large relation tables.
- [ ] Define retention policy for raw exports, generated Excel packages, releases, backups, and screenshots.
- [ ] Move `ai_video.pem` out of the repo root and use SSH agent or external secret storage.

Acceptance:

- [ ] Fresh clone is lightweight and runnable with sample fixtures.
- [ ] Full data can be restored from artifact storage using documented commands.
- [ ] No private key sits inside the repository directory.

### Phase 7: External Data Expansion

Target: after closed-loop action feedback is working.

- [ ] Add CS tickets for issue-resolution and complaint taxonomy validation.
- [ ] Add returns/refunds and review data for defect and quality signal validation.
- [ ] Add SKU/order data for revenue, conversion, and retention linkage.
- [ ] Add CRM or campaign data for content and marketing action measurement.
- [ ] Extend marts to distinguish VOC signal, operational impact, and commercial impact.

Acceptance:

- [ ] Playbook branches that claim ROI, retention, defect reduction, or revenue impact use external business data, not only Meltwater VOC.
- [ ] Executive monthly output separates observed VOC trends from measured business outcomes.

## 10. Immediate Next Execution Recommendation

The next execution should be Phase 0 plus the low-risk part of Phase 2:

- [x] Re-run the current local gates.
- [x] Produce a merge/PR decision packet for `codex/fix-playbook-deploy-checklist`.
- [x] Update stale `TODO.md`.
- [x] Add a documentation index pointing to current runbooks and historical audits.
- [x] Leave real webhook readiness for the moment Feishu or another alert channel becomes available.

This sequence reduces the highest ambiguity first: branch truth, stale docs, and release traceability.

Execution note, 2026-06-14:

- Branch/release decision packet added at `docs/runbooks/melwater-branch-release-decision.md`.
- Documentation index added at `docs/README.md`.
- `TODO.md` updated to mark the 2026-06-04 pump-secondary quota blocker as historical and closed by the 2026-06-11 backfill.
- `docs/production/tencent-cloud-inventory.md` updated with known non-secret production facts and remaining gaps.
- Verification passed: `git diff --check`, `make quality`, `npm run test:webhook-readiness`, and `npm run build`.
