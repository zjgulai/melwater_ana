# Melwater Tencent Cloud Docker Deployment QA

Date: 2026-06-13

## Scope

Deploy the current Melwater Analyst Lab website to Tencent Cloud Lighthouse/CVM:

- Server: `101.34.52.232` (`VM-0-16-ubuntu`)
- User: `ubuntu`
- Domain: `melwater.lute-tlz-dddd.top`
- SSH key: local project root `ai_video.pem`

Requirement: create a new Docker environment and avoid polluting existing applications.

## Deployment Design

Created an isolated Compose project under:

```bash
/opt/melwater-ana
```

Runtime layout:

- App source: `/opt/melwater-ana/app`
- Runtime secrets: `/opt/melwater-ana/secrets`
- Edge config backups: `/opt/melwater-ana/backups`
- Compose project: `melwater_ana`
- Containers: `melwater_api`, `melwater_web`
- Private network: `melwater_internal`
- Persistent volume: `melwater_review_state`
- Shared edge network: `lighthouse_ai_video_net`

The app containers do not bind public host ports. Public traffic is routed through the existing `ai_video_nginx` edge container by a dedicated `melwater.lute-tlz-dddd.top` vhost.

## Added Repository Assets

- `.dockerignore`
- `deploy/docker/Dockerfile.api`
- `deploy/docker/Dockerfile.web`
- `deploy/docker/docker-compose.yml`
- `deploy/docker/melwater.env.example`
- `deploy/docker/web-nginx.conf`
- `deploy/nginx/melwater-docker-edge.conf`

Security guard:

- Root `.gitignore` now ignores `*.pem` to prevent accidental SSH key commits.

## Certificate

DNS was already pointed at the server:

```bash
melwater.lute-tlz-dddd.top -> 101.34.52.232
```

The existing Let's Encrypt certificate `lute-tlz-dddd.top` was expanded to include:

```bash
melwater.lute-tlz-dddd.top
```

Certificate expiry after expansion:

```bash
2026-09-11
```

## Edge Nginx

Existing edge container:

```bash
ai_video_nginx
```

Ports already occupied by the edge container:

- `80`
- `443`

Because those ports are already in use, a separate public Nginx/Caddy container was not created. Instead, a dedicated vhost was inserted into:

```bash
/opt/ai-video/deploy/lighthouse/nginx.conf
```

Backup:

```bash
/opt/melwater-ana/backups/ai-video-nginx-before-melwater-20260613T114818.conf
```

Important deployment note:

- The first reload did not pick up the new config because `nginx.conf` is a single-file Docker bind mount and the host file had been replaced by `cp`, changing the inode.
- Fix: force-recreated only the `nginx` service with Compose so the edge container remounted the updated file.

## Secret Handling

Production review-state tokens were generated on the server and stored only at:

```bash
/opt/melwater-ana/secrets/melwater.env
/opt/melwater-ana/secrets/access-tokens.txt
```

Both files are permissioned `600`.

The token values were not printed into this QA document and are not committed to git.

## Validation Results

### Compose Config

Command:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml config
```

Result:

- Pass.
- Project name: `melwater_ana`.
- Containers: `melwater_api`, `melwater_web`.
- Networks: `melwater_internal`, `lighthouse_ai_video_net`.
- Volume: `melwater_review_state`.

### Container Build And Start

Command:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

Result:

- Pass after two fixed build-gate issues:
  - `.dockerignore` initially excluded `.env.example`.
  - `Dockerfile.web` initially missed `server/`, required by `vite.config.mjs`.

Current container health:

```bash
melwater_api   Up (healthy)
melwater_web   Up (healthy)
```

### Internal Routing

From `ai_video_nginx`:

- `http://melwater_web/` returns the Melwater static app.
- `http://melwater_api:4174/api/review-state/health` returns `401` without auth.

From `melwater_api` with token:

```json
{"ok":true,"authRequired":true,"role":"admin","stateDir":"/data/review-state","schemaVersion":2}
```

### Public HTTPS

URL:

```bash
https://melwater.lute-tlz-dddd.top
```

Result:

- `HTTP/2 200`
- Title: `Melwater Analyst Lab - Pain Radar`
- Static assets served from `/assets/*`

### Public API

Unauthenticated:

```bash
GET /api/review-state/health
```

Result:

```bash
401
{"error":"unauthorized"}
```

Authenticated public API verification:

```bash
node server/verifyDeployment.mjs --require-auth
```

Result:

- Pass.
- `health.status = 200`
- `replay.status = 200`
- `metrics.status = 200`
- `melwater_review_state_replay_ok 1`
- `melwater_review_state_auth_required 1`

### Existing App Smoke Checks

After force-recreating the edge Nginx container:

- `https://mkt.lute-tlz-dddd.top` -> `HTTP 200`
- `https://video.lute-tlz-dddd.top` -> `HTTP 200`

## Known Follow-Up Debt

- `npm ci` reports 3 high severity dependency audit findings. The deployment did not run `npm audit fix --force` because that could introduce breaking dependency changes during production rollout.
- Production review-state starts with an empty persistent Docker volume. This is acceptable for a fresh production writeback state; seed/import can be added if prior local QA state should be preserved.
- Edge Nginx is still a shared container for multiple applications. Melwater runtime is isolated, but public TLS routing necessarily passes through the shared edge.

### Upstream IP Staleness Debt (Observed)

During rollout, public API path `/api/review-state/*` briefly returned `502 Bad Gateway` while root `/` stayed healthy. Root cause was an upstream IP cache in `ai_video_nginx` after `melwater_api` container restart (old container IP remained cached).

Mitigation applied in this round:

- Restarted `ai_video_nginx` after redeploy so DNS name resolution repoints to current container IPs.

Recommendation for future rounds:

1. Add a fixed post-deploy edge refresh step:

```bash
docker restart ai_video_nginx
```

2. Keep a post-deploy API health assertion for both
   - `/api/review-state/health`
   - `/api/review-state/metrics`

to detect upstream refresh regressions immediately.

## Operational Commands

Check containers:

```bash
cd /opt/melwater-ana/app
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml ps
```

Restart Melwater only:

```bash
cd /opt/melwater-ana/app
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

View production tokens on the server:

```bash
cat /opt/melwater-ana/secrets/access-tokens.txt
```

After Melwater deploy/rebuild, refresh shared edge DNS cache by restarting the edge proxy:

```bash
docker restart ai_video_nginx
```

Browser token setup for shared writeback sync:

```js
localStorage.setItem("melwater:apiToken", "<editor-or-admin-token>")
```
