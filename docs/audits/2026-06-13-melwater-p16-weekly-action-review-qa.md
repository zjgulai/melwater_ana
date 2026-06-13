# Melwater P16 Weekly Action Review QA

Date: 2026-06-13

## Scope

P16 turns the P15 action closed-loop table into a weekly meeting queue:

- Rank action items by priority, owner resolution, due window, and evidence strength.
- Show a weekly decision agenda for the action review meeting.
- Surface owner load and unresolved owner risk.
- Keep action status writeback available from the weekly queue.
- Preserve the existing Action Register for detailed filtering, editing, and CSV export.

## Implementation

Frontend:

- Added weekly action review derivation helpers:
  - `actionDueInfo`
  - `actionEvidenceStrength`
  - `actionDecisionLane`
  - `buildWeeklyActionReview`
- Added `WeeklyActionReview` UI on the Action Closed Loop page.
- Weekly queue shows:
  - queue rank
  - P0/P1/P2/P3 priority
  - decision lane
  - owner domain
  - category/topic
  - business impact
  - due date window
  - evidence strength
  - quick status buttons: `Accepted`, `In Progress`, `Measured`
- Owner panel shows top owner domains by action load and P0/P1 count.
- Meeting rule clarifies that P0/P1 items require owner, status, and acceptance metric in the meeting.

Decision lanes:

- `Approve data fix`
- `Confirm owner`
- `Commit this cycle`
- `Request evidence`
- `Track next`

## Local Validation

Commands:

```bash
npm run build
npm run review:replay
npm audit --json
git diff --check
```

Results:

- Build passed.
- `review:replay` returned `ok: true`.
- `npm audit`: 0 total vulnerabilities.
- `git diff --check`: no whitespace errors.

Date-window fix:

- Browser smoke initially showed `15d left` and `0 due ≤14d`.
- Root cause: `due_dateT23:59:59` plus `Math.ceil` over-counted the date-only gap.
- Fix: parse `YYYY-MM-DD` as a local date-only midnight value.
- Verified browser output after fix:
  - first queue row: `14d left`
  - weekly badge: `57 due ≤14d`

## Production Deployment

Application commit deployed:

```bash
54c237e5
```

Synced app source to:

```bash
/opt/melwater-ana/app
```

Updated:

```bash
/opt/melwater-ana/app/REVISION
MELWATER_RELEASE_REF=54c237e5
```

Rebuilt:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f /opt/melwater-ana/app/deploy/docker/docker-compose.yml up -d --build
```

Containers after deployment:

- `melwater_api`: healthy
- `melwater_web`: healthy

## Production Smoke

Public site verification:

```json
{
  "ok": true,
  "url": "https://melwater.lute-tlz-dddd.top",
  "status": 200,
  "title": "Melwater Analyst Lab - Pain Radar",
  "expectedTextProvided": true,
  "failures": []
}
```

Healthcheck:

```json
{
  "ok": true,
  "checkedAt": "2026-06-13T05:35:01Z",
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "releaseRef": "54c237e5",
  "failureCount": 0,
  "incidentThreshold": 3,
  "incidentOpen": false
}
```

Review-state replay inside production container:

```json
{
  "ok": true,
  "stateDir": "/data/review-state",
  "eventCount": 0,
  "replayedEventCount": 0
}
```

Browser smoke, cache-busted URL:

- URL: `https://melwater.lute-tlz-dddd.top/?v=54c237e5`
- Loaded JS asset: `index-BhD4YiGG.js`
- Opened `Action Closed Loop`.
- Rendered:
  - `Weekly Action Review`
  - `57 in queue`
  - `57 due ≤14d`
  - 10 visible weekly queue rows
  - 7 owner-load rows
  - 24 visible Action Register cards
- First queue row:
  - `P0`
  - `Approve data fix`
  - `14d left`
  - `QA required`
- Browser console:
  - no errors
  - no warnings

Cache note:

- A non-cache-busted browser tab briefly loaded the previous JS asset because static assets/index references can be cached for up to 300 seconds.
- Using a query-string cache bust loaded the correct release immediately.

## Acceptance

Pass.

The Action Closed Loop page now starts with a weekly decision board that ranks action items, exposes owner risk, clarifies data-fix actions, and keeps the detailed editable register below.

## Remaining Debt

- The weekly queue is still frontend-derived; a future API endpoint can generate signed weekly snapshots for meeting archives.
- Owner assignment is still manual until real Feishu/WeCom identity integration is available.
- The quick status buttons write only action status; a future version can capture meeting notes and decision rationale per action.
