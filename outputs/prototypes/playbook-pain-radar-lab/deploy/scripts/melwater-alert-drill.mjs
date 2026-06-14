#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = process.env.MELWATER_APP_DIR || path.resolve(scriptDir, "../..");
const args = process.argv.slice(2);
const options = {
  envFile:
    readArg("melwater-env-file") ||
    readArg("env-file") ||
    process.env.MELWATER_ENV_FILE ||
    "/opt/melwater-ana/secrets/melwater.env",
  opsRoot: readArg("ops-root") || process.env.MELWATER_OPS_ROOT || "/opt/melwater-ana/backups",
  webhookUrl: readArg("webhook-url") || process.env.MELWATER_ALERT_WEBHOOK_URL || "",
  webhookType: readArg("webhook-type") || process.env.MELWATER_ALERT_WEBHOOK_TYPE || "generic",
  threshold: Number(readArg("threshold") || process.env.MELWATER_ALERT_DRILL_THRESHOLD || 2),
  recoveryMode: readArg("recovery-mode") || "actual",
  recoveryAttempts: Number(readArg("recovery-attempts") || process.env.MELWATER_ALERT_DRILL_RECOVERY_ATTEMPTS || 8),
  recoverySleepSeconds: Number(readArg("recovery-sleep") || process.env.MELWATER_ALERT_DRILL_RECOVERY_SLEEP || 5),
  skipOpsReport: args.includes("--skip-ops-report"),
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  melwater-alert-drill.mjs [options]

Options:
  --webhook-url=URL          Send drill alerts to a real webhook. Defaults to local mock webhook.
  --webhook-type=TYPE        generic, feishu, or wecom. Default: generic.
  --recovery-mode=actual     Run real healthcheck recovery. Default.
  --recovery-mode=skip       Skip recovery stage for local script checks.
  --recovery-attempts=N      Recovery healthcheck attempts. Default: 8.
  --recovery-sleep=N         Seconds between recovery attempts. Default: 5.
  --melwater-env-file=PATH   Production env file. Default: /opt/melwater-ana/secrets/melwater.env.
  --ops-root=PATH            Ops output root. Default: /opt/melwater-ana/backups.
  --threshold=N              Incident threshold for the drill. Default: 2.
  --skip-ops-report          Do not regenerate the Ops report after writing drill results.
`);
  process.exit(0);
}

if (!["generic", "feishu", "wecom"].includes(options.webhookType)) {
  failEarly(`invalid --webhook-type=${options.webhookType}`);
}
if (!["actual", "skip"].includes(options.recoveryMode)) {
  failEarly(`invalid --recovery-mode=${options.recoveryMode}`);
}
if (!Number.isFinite(options.threshold) || options.threshold < 2) {
  failEarly("--threshold must be a number >= 2");
}
if (!Number.isFinite(options.recoveryAttempts) || options.recoveryAttempts < 1) {
  failEarly("--recovery-attempts must be a number >= 1");
}
if (!Number.isFinite(options.recoverySleepSeconds) || options.recoverySleepSeconds < 0) {
  failEarly("--recovery-sleep must be a number >= 0");
}
if (options.recoveryMode === "actual" && !fs.existsSync(options.envFile)) {
  failEarly(`missing env file for actual recovery: ${options.envFile}`);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const drillRoot = process.env.MELWATER_ALERT_DRILL_ROOT || path.join(options.opsRoot, "alert-drills");
const drillDir = path.join(drillRoot, stamp);
const stateDir = path.join(drillDir, "state");
const latestJson = process.env.MELWATER_ALERT_DRILL_LATEST_JSON || path.join(options.opsRoot, "alert-drill-latest.json");
const latestMd = process.env.MELWATER_ALERT_DRILL_LATEST_MD || path.join(options.opsRoot, "alert-drill-latest.md");
const healthcheckPath = path.join(appDir, "deploy/scripts/melwater-healthcheck.sh");
const opsReportPath = path.join(appDir, "deploy/scripts/melwater-ops-report.sh");

fs.mkdirSync(stateDir, { recursive: true });
fs.mkdirSync(path.dirname(latestJson), { recursive: true });
fs.mkdirSync(path.dirname(latestMd), { recursive: true });

const receivedWebhookEvents = [];
const mockServer = options.webhookUrl ? null : await startMockWebhook(receivedWebhookEvents);
const webhookUrl = options.webhookUrl || `http://127.0.0.1:${mockServer.address().port}/melwater-alert-drill`;

const commonOverrides = {
  MELWATER_APP_DIR: appDir,
  MELWATER_HEALTH_STATE_DIR: stateDir,
  MELWATER_HEALTH_RESULT_FILE: path.join(stateDir, "last-health.json"),
  MELWATER_HEALTH_FAILURE_COUNT_FILE: path.join(stateDir, "health-failure-count.txt"),
  MELWATER_HEALTH_INCIDENT_FILE: path.join(stateDir, "health-incident.json"),
  MELWATER_HEALTH_ALERT_LOG: path.join(stateDir, "health-alerts.log"),
  MELWATER_HEALTH_INCIDENT_THRESHOLD: String(options.threshold),
  MELWATER_ALERT_WEBHOOK_URL: webhookUrl,
  MELWATER_ALERT_WEBHOOK_TYPE: options.webhookType,
  MELWATER_ALERT_DRY_RUN: "0",
};

const failEnvFile = path.join(drillDir, "failure.env");
const recoveryEnvFile = path.join(drillDir, "recovery.env");
writeEnvFile(failEnvFile, "", { ...commonOverrides, REVIEW_STATE_HEALTH_TOKEN: "" });
writeEnvFile(recoveryEnvFile, readIfExists(options.envFile), commonOverrides);

const stages = {
  failureOne: await runHealthcheck("failure-1", failEnvFile),
  failureTwo: await runHealthcheck("failure-2", failEnvFile),
  recovery:
    options.recoveryMode === "actual"
      ? await runRecovery(recoveryEnvFile)
      : { name: "recovery", skipped: true, ok: true, exitCode: null, durationMs: 0 },
};

if (mockServer) await closeServer(mockServer);

const incident = readJson(path.join(stateDir, "health-incident.json"));
const health = readJson(path.join(stateDir, "last-health.json"));
const alertLog = readJsonLines(path.join(stateDir, "health-alerts.log"));
const webhookEvents = receivedWebhookEvents.map((event) => ({
  method: event.method,
  url: event.url,
  event: event.body?.event || event.body?.text?.content?.match(/event=([^ |]+)/)?.[1] || event.body?.content?.text?.match(/event=([^ |]+)/)?.[1] || null,
  severity:
    event.body?.severity || event.body?.text?.content?.match(/severity=([^ |]+)/)?.[1] || event.body?.content?.text?.match(/severity=([^ |]+)/)?.[1] || null,
  body: event.body,
}));
const expectedWebhookEvents =
  options.recoveryMode === "actual"
    ? ["healthcheck_failed", "healthcheck_incident_open", "healthcheck_recovered"]
    : ["healthcheck_failed", "healthcheck_incident_open"];
const observedWebhookEvents = webhookEvents.map((event) => event.event).filter(Boolean);
const missingWebhookEvents = options.webhookUrl
  ? []
  : expectedWebhookEvents.filter((eventName) => !observedWebhookEvents.includes(eventName));
const ok =
  stages.failureOne.exitCode !== 0 &&
  stages.failureTwo.exitCode !== 0 &&
  stages.recovery.ok &&
  missingWebhookEvents.length === 0;

const report = {
  ok,
  generatedAt: new Date().toISOString(),
  mode: options.webhookUrl ? "external-webhook" : "mock-webhook",
  webhookType: options.webhookType,
  recoveryMode: options.recoveryMode,
  threshold: options.threshold,
  releaseRef: resolveReleaseRef(),
  appDir,
  drillDir,
  stateDir,
  stages,
  health,
  incident,
  alertLog,
  expectedWebhookEvents,
  observedWebhookEvents,
  missingWebhookEvents,
  webhookEventCount: webhookEvents.length,
  webhookEvents,
  files: {
    json: path.join(drillDir, "alert-drill.json"),
    markdown: path.join(drillDir, "alert-drill.md"),
    latestJson,
    latestMarkdown: latestMd,
  },
};

fs.writeFileSync(report.files.json, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(report.files.markdown, markdownReport(report));
fs.copyFileSync(report.files.json, latestJson);
fs.copyFileSync(report.files.markdown, latestMd);

let opsReport = { skipped: options.skipOpsReport };
if (!options.skipOpsReport && fs.existsSync(opsReportPath)) {
  const result = spawnSync("sh", [opsReportPath], {
    cwd: appDir,
    encoding: "utf8",
    env: {
      ...process.env,
      MELWATER_ENV_FILE: options.envFile,
      MELWATER_ALERT_DRILL_ROOT: drillRoot,
      MELWATER_ALERT_DRILL_LATEST_JSON: latestJson,
      MELWATER_ALERT_DRILL_LATEST_MD: latestMd,
    },
  });
  opsReport = {
    skipped: false,
    ok: result.status === 0,
    exitCode: result.status,
    stdout: safeJsonOrText(result.stdout),
    stderr: result.stderr.trim(),
  };
}

const output = { ...report, opsReport };
console.log(JSON.stringify(output, null, 2));
process.exit(ok && (opsReport.skipped || opsReport.ok) ? 0 : 1);

function readArg(name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

function failEarly(message) {
  console.error(message);
  process.exit(2);
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function writeEnvFile(filePath, baseText, overrides) {
  const lines = [baseText.trim(), "# Melwater alert drill overrides"];
  for (const [name, value] of Object.entries(overrides)) {
    lines.push(`${name}=${shellQuote(value)}`);
  }
  fs.writeFileSync(filePath, `${lines.filter(Boolean).join("\n")}\n`);
}

function runHealthcheck(name, envFile) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn("sh", [healthcheckPath], {
      cwd: appDir,
      env: {
        ...process.env,
        MELWATER_ENV_FILE: envFile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({
        name,
        ok: status === 0,
        exitCode: status,
        durationMs: Date.now() - startedAt,
        stdout: safeJsonOrText(stdout),
        stderr: stderr.trim(),
      });
    });
  });
}

async function runRecovery(envFile) {
  const attempts = [];
  const startedAt = Date.now();
  for (let index = 1; index <= options.recoveryAttempts; index += 1) {
    const attempt = await runHealthcheck(`recovery-${index}`, envFile);
    attempts.push(attempt);
    if (attempt.ok) {
      return {
        name: "recovery",
        ok: true,
        exitCode: 0,
        durationMs: Date.now() - startedAt,
        attempts,
        stdout: attempt.stdout,
        stderr: attempt.stderr,
      };
    }
    if (index < options.recoveryAttempts && options.recoverySleepSeconds > 0) {
      await sleep(options.recoverySleepSeconds * 1000);
    }
  }
  const last = attempts.at(-1);
  return {
    name: "recovery",
    ok: false,
    exitCode: last?.exitCode ?? 1,
    durationMs: Date.now() - startedAt,
    attempts,
    stdout: last?.stdout ?? "",
    stderr: last?.stderr ?? "",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonOrText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readJsonLines(filePath) {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line };
        }
      });
  } catch {
    return [];
  }
}

function resolveReleaseRef() {
  const envText = readIfExists(options.envFile);
  const match = envText.match(/^MELWATER_RELEASE_REF=(.*)$/m);
  if (match?.[1]) return match[1].replace(/^['"]|['"]$/g, "");
  try {
    return fs.readFileSync(path.join(appDir, "REVISION"), "utf8").trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function markdownReport(report) {
  const eventNames = report.webhookEvents.map((event) => event.event || "unknown").join(", ") || "none";
  const missingEvents = report.missingWebhookEvents.join(", ") || "none";
  return `# Melwater Alert Drill

- Generated at: ${report.generatedAt}
- OK: ${report.ok}
- Mode: ${report.mode}
- Webhook type: ${report.webhookType}
- Recovery mode: ${report.recoveryMode}
- Release: ${report.releaseRef}
- Threshold: ${report.threshold}

## Stages

- Failure 1 exit: ${report.stages.failureOne.exitCode}
- Failure 2 exit: ${report.stages.failureTwo.exitCode}
- Recovery exit: ${report.stages.recovery.exitCode ?? "skipped"}

## Incident

- Status: ${report.incident?.status || "none"}
- Failure count: ${report.incident?.failureCount ?? "unknown"}
- Resolved at: ${report.incident?.resolvedAt || "none"}

## Webhook Events

- Count: ${report.webhookEventCount}
- Events: ${eventNames}
- Missing expected events: ${missingEvents}

## Files

- JSON: ${report.files.json}
- Markdown: ${report.files.markdown}
`;
}

function startMockWebhook(events) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = { raw: body };
      }
      events.push({ method: req.method, url: req.url, body: parsed });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
