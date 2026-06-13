import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewStateStore, schemaVersion } from "./reviewStateStore.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function createReviewStateApi({
  stateDir = process.env.REVIEW_STATE_DIR || path.join(rootDir, "state"),
  authToken = process.env.REVIEW_STATE_TOKEN || "",
  tokenConfig = process.env.REVIEW_STATE_TOKENS || "",
  allowedOrigin = process.env.REVIEW_STATE_CORS_ORIGIN || "*",
  releaseRefFile = process.env.MELWATER_RELEASE_REF_FILE || path.join(rootDir, "REVISION"),
  opsBackupRoot = process.env.MELWATER_OPS_BACKUP_ROOT || path.join(stateDir, "backups"),
  opsLastHealthFile = process.env.MELWATER_OPS_LAST_HEALTH_FILE || "",
} = {}) {
  const store = createReviewStateStore({ stateDir });
  store.migrate();
  const roleRank = { viewer: 1, editor: 2, admin: 3 };
  const tokens = parseTokenConfig();

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Melwater-User,X-Melwater-Token");
    res.end(JSON.stringify(payload));
  }

  function sendText(res, statusCode, payload, contentType = "text/plain; charset=utf-8") {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Melwater-User,X-Melwater-Token");
    res.end(payload);
  }

  function parseTokenConfig() {
    const records = new Map();
    if (authToken) {
      records.set(authToken, { role: "admin", actor: "Token Admin" });
    }
    if (!tokenConfig.trim()) return records;

    const parsed = JSON.parse(tokenConfig);
    for (const [token, record] of Object.entries(parsed || {})) {
      if (!token) continue;
      if (typeof record === "string") {
        records.set(token, { role: normalizeRole(record), actor: normalizeRole(record) });
      } else {
        records.set(token, {
          role: normalizeRole(record?.role),
          actor: record?.actor || normalizeRole(record?.role),
        });
      }
    }
    return records;
  }

  function normalizeRole(role) {
    return roleRank[role] ? role : "viewer";
  }

  function tokenFrom(req) {
    const authorization = String(req.headers.authorization || "");
    return authorization.startsWith("Bearer ") ? authorization.slice(7) : req.headers["x-melwater-token"];
  }

  function authContext(req) {
    if (!tokens.size) {
      return {
        authorized: true,
        role: "admin",
        actor: req.headers["x-melwater-user"] || "Analyst",
        authRequired: false,
      };
    }
    const token = tokenFrom(req);
    const record = tokens.get(token);
    return {
      authorized: Boolean(record),
      role: record?.role || null,
      actor: record?.actor || null,
      authRequired: true,
    };
  }

  function hasRole(auth, role) {
    return roleRank[auth.role] >= roleRank[role];
  }

  function actorFrom(req, payload = {}, auth) {
    return auth.actor || payload.actor || req.headers["x-melwater-user"] || "Analyst";
  }

  function escapeLabel(value) {
    return String(value ?? "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
  }

  function metricLine(name, value, labels = {}) {
    const labelEntries = Object.entries(labels).filter(([, labelValue]) => labelValue !== null && labelValue !== undefined);
    const labelText = labelEntries.length
      ? `{${labelEntries.map(([key, labelValue]) => `${key}="${escapeLabel(labelValue)}"`).join(",")}}`
      : "";
    return `${name}${labelText} ${Number(value)}`;
  }

  function metricsText(metrics, auth) {
    const lines = [
      "# HELP melwater_review_state_schema_version Current review-state schema version.",
      "# TYPE melwater_review_state_schema_version gauge",
      metricLine("melwater_review_state_schema_version", metrics.schemaVersion),
      "# HELP melwater_review_state_entries_total Current review-state entries.",
      "# TYPE melwater_review_state_entries_total gauge",
      metricLine("melwater_review_state_entries_total", metrics.totalEntries),
    ];
    for (const [namespace, value] of Object.entries(metrics.entriesByNamespace)) {
      lines.push(metricLine("melwater_review_state_entries", value, { namespace }));
    }
    lines.push(
      "# HELP melwater_review_state_events_total Review-state append-only event count.",
      "# TYPE melwater_review_state_events_total counter",
      metricLine("melwater_review_state_events_total", metrics.eventCount),
      "# HELP melwater_review_state_replay_ok Replay verification status, 1 means ok.",
      "# TYPE melwater_review_state_replay_ok gauge",
      metricLine("melwater_review_state_replay_ok", metrics.replayOk ? 1 : 0),
      "# HELP melwater_review_state_replayed_events_total Events replayed after migration baseline.",
      "# TYPE melwater_review_state_replayed_events_total gauge",
      metricLine("melwater_review_state_replayed_events_total", metrics.replayedEventCount),
      "# HELP melwater_review_state_auth_required Whether API token auth is enabled.",
      "# TYPE melwater_review_state_auth_required gauge",
      metricLine("melwater_review_state_auth_required", auth.authRequired ? 1 : 0),
      metricLine("melwater_review_state_last_event_info", metrics.lastEventAt ? 1 : 0, {
        actor: metrics.lastEventActor,
        operation: metrics.lastEventOperation,
        namespace: metrics.lastEventNamespace,
        timestamp: metrics.lastEventAt,
      }),
    );
    return `${lines.join("\n")}\n`;
  }

  function readTextFile(filePath) {
    if (!filePath) return null;
    try {
      return fs.readFileSync(filePath, "utf8").trim() || null;
    } catch {
      return null;
    }
  }

  function readJsonFile(filePath) {
    if (!filePath) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      return null;
    }
  }

  function fileStat(filePath) {
    try {
      const stat = fs.statSync(filePath);
      return {
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  function latestBackupManifest() {
    try {
      const manifests = fs
        .readdirSync(opsBackupRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tar.gz.json"))
        .map((entry) => {
          const manifestPath = path.join(opsBackupRoot, entry.name);
          const manifest = readJsonFile(manifestPath) || {};
          const backupFileName = path.basename(manifest.backupFile || entry.name.replace(/\.json$/, ""));
          const backupPath = path.join(opsBackupRoot, backupFileName);
          const stat = fileStat(backupPath) || fileStat(manifestPath);
          return {
            ok: Boolean(manifest.ok),
            createdAt: manifest.createdAt || stat?.modifiedAt || null,
            label: manifest.label || null,
            backupFile: backupFileName,
            bytes: Number(manifest.bytes || stat?.bytes || 0),
            sha256: manifest.sha256 || null,
            manifestFile: entry.name,
          };
        })
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return manifests[0] || null;
    } catch {
      return null;
    }
  }

  function buildOpsStatus(auth) {
    const metrics = store.buildMetrics();
    const lastHealth = readJsonFile(opsLastHealthFile);
    const latestBackup = latestBackupManifest();
    const releaseRef = process.env.MELWATER_RELEASE_REF || readTextFile(releaseRefFile) || "unknown";
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      release: {
        ref: releaseRef,
      },
      auth: {
        authRequired: auth.authRequired,
        role: auth.role,
        actor: auth.actor,
      },
      reviewState: {
        schemaVersion: metrics.schemaVersion,
        totalEntries: metrics.totalEntries,
        entriesByNamespace: metrics.entriesByNamespace,
        eventCount: metrics.eventCount,
        replayOk: metrics.replayOk,
        replayedEventCount: metrics.replayedEventCount,
        baselineCreatedAt: metrics.baselineCreatedAt,
        lastEventAt: metrics.lastEventAt,
        lastEventActor: metrics.lastEventActor,
        lastEventOperation: metrics.lastEventOperation,
        lastEventNamespace: metrics.lastEventNamespace,
      },
      healthcheck: lastHealth
        ? {
            ok: Boolean(lastHealth.ok),
            checkedAt: lastHealth.checkedAt || null,
            publicUrl: lastHealth.publicUrl || null,
            homepageStatus: lastHealth.homepageStatus || null,
            apiBase: lastHealth.apiBase || null,
            releaseRef: lastHealth.releaseRef || null,
            error: lastHealth.error || null,
          }
        : null,
      backup: {
        latest: latestBackup,
      },
    };
  }

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname.replace(/^\/api\/review-state/, "") || "/";

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const auth = authContext(req);
    if (!auth.authorized) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        authRequired: auth.authRequired,
        role: auth.role,
        stateDir,
        schemaVersion,
      });
      return;
    }

    if (req.method === "GET" && pathname === "/metrics") {
      if (!hasRole(auth, "viewer")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "viewer" });
        return;
      }
      sendText(res, 200, metricsText(store.buildMetrics(), auth));
      return;
    }

    if (req.method === "GET" && pathname === "/ops") {
      if (!hasRole(auth, "viewer")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "viewer" });
        return;
      }
      sendJson(res, 200, buildOpsStatus(auth));
      return;
    }

    if (req.method === "GET" && pathname === "/") {
      if (!hasRole(auth, "viewer")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "viewer" });
        return;
      }
      sendJson(res, 200, store.load());
      return;
    }

    if (req.method === "GET" && pathname === "/events") {
      if (!hasRole(auth, "viewer")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "viewer" });
        return;
      }
      const limit = Number(url.searchParams.get("limit") || 200);
      sendJson(res, 200, store.loadEvents().slice(-limit).reverse());
      return;
    }

    if (req.method === "GET" && pathname === "/replay") {
      if (!hasRole(auth, "viewer")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "viewer" });
        return;
      }
      const verification = store.verifyReplay();
      sendJson(res, verification.ok ? 200 : 409, {
        ok: verification.ok,
        eventCount: verification.eventCount,
        replayedEventCount: verification.replayedEventCount,
        baselineCreatedAt: verification.baselineCreatedAt,
        currentNamespaces: Object.keys(verification.current),
      });
      return;
    }

    if (req.method === "POST" && pathname === "/backup") {
      if (!hasRole(auth, "admin")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "admin" });
        return;
      }
      const payload = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, store.createBackup({ label: payload.label || url.searchParams.get("label") || "api" }));
      return;
    }

    if (req.method === "POST" && pathname === "/") {
      if (!hasRole(auth, "editor")) {
        sendJson(res, 403, { error: "forbidden", requiredRole: "editor" });
        return;
      }
      try {
        const payload = JSON.parse((await readBody(req)) || "{}");
        const result = store.applyMutation({
          ...payload,
          actor: actorFrom(req, payload, auth),
        });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 500, {
          error: error.message,
          details: error.details || null,
          state: store.load(),
        });
      }
      return;
    }

    sendJson(res, 405, { error: "method not allowed" });
  }

  return {
    handle,
    store,
  };
}

export function reviewStateVitePlugin(options = {}) {
  return {
    name: "melwater-review-state-api",
    configureServer(server) {
      const api = createReviewStateApi(options);
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/review-state")) {
          api.handle(req, res);
          return;
        }
        next();
      });
    },
  };
}
