# Melwater P3 Writeback QA

Date: 2026-06-12

## Scope

P3 turns previously frontend-only review states into a local writeback loop:

- Search sample verdicts
- Quote review status
- Concept candidate decisions
- Crisis triage status
- Action register status

The implementation uses a Vite dev-server API and writes both JSON and CSV artifacts for downstream automation.

## API

Endpoint:

```text
GET  /api/review-state
POST /api/review-state
```

POST payload:

```json
{
  "namespace": "quoteReview",
  "key": "quote-id",
  "value": "approved",
  "meta": {
    "category": "吸奶器",
    "topic": "Battery / power"
  }
}
```

Deletion is supported for QA cleanup:

```json
{
  "namespace": "quoteReview",
  "key": "quote-id",
  "value": null,
  "delete": true
}
```

## Writeback Files

Generated under `outputs/prototypes/playbook-pain-radar-lab/state/`:

- `review-state.json`
- `review-state.csv`
- `action-status.csv`
- `concept-decision.csv`
- `crisis-triage.csv`
- `quote-review.csv`
- `search-verdict.csv`

Current persisted QA records after cleanup:

- `actionStatus`: 1
- `quoteReview`: 1
- `conceptDecision`: 1
- `crisisTriage`: 1
- `searchVerdict`: 1

## UI Integration

Updated pages:

- `Search Quality Lab`: verdict buttons write `searchVerdict`.
- `Action Closed Loop`: status select writes `actionStatus`.
- `User Voice Quote Library`: approve/legal buttons write `quoteReview`.
- `Concept Candidate Lab`: test/hold/reject writes `conceptDecision`.
- `Crisis Response Watchtower`: triage button writes `crisisTriage`.

Each updated page shows a sync badge:

- `api writeback`: Vite API is available and writes are persisted.
- `local fallback`: API unavailable, state remains in `localStorage`.

## Automated QA

Build:

```bash
npm run build
```

Result: passed.

API smoke test:

```json
{
  "actionStatus": 1,
  "quoteReview": 1,
  "conceptDecision": 1,
  "crisisTriage": 1,
  "searchVerdict": 1
}
```

Refresh/restore browser regression:

```json
{
  "actionRestored": "Accepted",
  "quoteApprovedActive": true,
  "conceptHoldActive": true,
  "crisisEscalated": "escalated",
  "searchNoiseActive": true
}
```

## Screenshots

- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-action.png`
- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-quote.png`
- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-concept.png`
- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-crisis.png`
- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-search.png`
- `outputs/prototypes/playbook-pain-radar-lab/qa/p3-writeback-restored-search.png`

## Remaining Gaps

- The writeback API is local dev middleware, not a production backend service.
- No authentication, authorization, audit user identity, or conflict handling yet.
- CSV export is append-overwrite snapshot style, not event-sourced history.
- Next production step should move the writeback contract to a backend route or serverless function and attach user/session identity.

## Acceptance

P3 passed local build, API writeback, CSV generation, browser interaction, and refresh/restore regression.
