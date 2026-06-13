#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
  webhookUrl: readArg("webhook-url") || "",
  webhookType: readArg("webhook-type") || "",
  send: args.includes("--send") && !args.includes("--no-send"),
  skipDrill: args.includes("--skip-drill"),
  recoveryAttempts: readArg("recovery-attempts") || process.env.MELWATER_ALERT_DRILL_RECOVERY_ATTEMPTS || "8",
  recoverySleep: readArg("recovery-sleep") || process.env.MELWATER_ALERT_DRILL_RECOVERY_SLEEP || "5",
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  melwater-alert-webhook-readiness.mjs [options]

Options:
  --send                    Send a real smoke alert, then run external webhook drill unless skipped.
  --no-send                 Check configuration only. Default.
  --skip-drill              Skip the external alert drill after smoke test.
  --webhook-url=URL         Override MELWATER_ALERT_WEBHOOK_URL without printing it.
  --webhook-type=TYPE       generic, feishu, or wecom.
  --melwater-env-file=PATH  Env file. Default: /opt/melwater-ana/secrets/melwater.env.
  --ops-root=PATH           Ops output root. Default: /opt/melwater-ana/backups.
  --recovery-attempts=N     External drill recovery attempts. Default: 8.
  --recovery-sleep=N        Seconds between external drill recovery attempts. Default: 5.
`);
  process.exit(0);
}

const env = readEnvFile(options.envFile);
const webhookUrl = options.webhookUrl || env.MELWATER_ALERT_WEBHOOK_URL || "";
const webhookType = options.webhookType || env.MELWATER_ALERT_WEBHOOK_TYPE || "generic";
const dryRun = env.MELWATER_ALERT_DRY_RUN || "";
const expectedStatus = env.MELWATER_ALERT_EXPECT_STATUS || "2xx";
const generatedAt = new Date().toISOString();

if (!["generic", "feishu", "wecom"].includes(webhookType)) {
  finish(
    {
      ok: false,
      ready: false,
      generatedAt,
      mode: "blocked",
      reason: `invalid MELWATER_ALERT_WEBHOOK_TYPE: ${webhookType}`,
      webhook: webhookSummary(Boolean(webhookUrl), webhookType, dryRun, expectedStatus),
      nextActions: ["Set MELWATER_ALERT_WEBHOOK_TYPE to generic, feishu, or wecom."],
    },
    2,
  );
}

if (!webhookUrl) {
  finish(
    {
      ok: false,
      ready: false,
      generatedAt,
      mode: "blocked",
      reason: "missing MELWATER_ALERT_WEBHOOK_URL",
      webhook: webhookSummary(false, webhookType, dryRun, expectedStatus),
      smokeTest: { skipped: true, reason: "missing webhook URL" },
      externalDrill: { skipped: true, reason: "missing webhook URL" },
      nextActions: [
        "Set MELWATER_ALERT_WEBHOOK_URL in the production env file.",
        "Set MELWATER_ALERT_WEBHOOK_TYPE to generic, feishu, or wecom.",
        "Run this command again with --send after confirming the target channel is ready.",
      ],
    },
    1,
  );
}

if (!options.send) {
  finish(
    {
      ok: true,
      ready: true,
      generatedAt,
      mode: "check-only",
      webhook: webhookSummary(true, webhookType, dryRun, expectedStatus),
      smokeTest: { skipped: true, reason: "run with --send to send a real smoke alert" },
      externalDrill: { skipped: true, reason: "run with --send to execute the external drill" },
      nextActions: ["Run with --send to verify real webhook delivery and execute the external drill."],
    },
    0,
  );
}

const smokeTest = runSmokeTest({ webhookUrl, webhookType });
let externalDrill = { skipped: true, reason: "smoke test failed" };

if (smokeTest.ok && !options.skipDrill) {
  externalDrill = runExternalDrill({ webhookUrl, webhookType });
} else if (smokeTest.ok) {
  externalDrill = { skipped: true, reason: "--skip-drill" };
}

const ok = Boolean(smokeTest.ok && (externalDrill.skipped || externalDrill.ok));
finish(
  {
    ok,
    ready: ok,
    generatedAt,
    mode: "send",
    webhook: webhookSummary(true, webhookType, dryRun, expectedStatus),
    smokeTest,
    externalDrill,
    nextActions: ok
      ? ["Confirm the target channel received the smoke alert and drill alerts."]
      : ["Check webhook URL, bot permissions, expected status, and target channel availability."],
  },
  ok ? 0 : 1,
);

function readArg(name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

function readEnvFile(filePath) {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => line.replace(/^export\s+/, ""))
        .filter((line) => line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), unquote(line.slice(index + 1))];
        }),
    );
  } catch {
    return {};
  }
}

function unquote(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function webhookSummary(configured, type, alertDryRun, alertExpectedStatus) {
  return {
    configured,
    type,
    dryRun: alertDryRun,
    expectedStatus: alertExpectedStatus,
  };
}

function runSmokeTest({ webhookUrl, webhookType }) {
  const result = spawnSync(
    "sh",
    [
      path.join(scriptDir, "melwater-alert-test.sh"),
      "--send",
      `--webhook-url=${webhookUrl}`,
      `--webhook-type=${webhookType}`,
      `--expect-status=${expectedStatus}`,
      "--event=alert_smoke_test",
      "--severity=info",
      "--message=Melwater real webhook readiness smoke test",
    ],
    {
      cwd: appDir,
      encoding: "utf8",
      env: { ...process.env, MELWATER_ENV_FILE: options.envFile },
    },
  );
  const output = safeJsonOrText(result.stdout);
  return {
    ok: result.status === 0 && Boolean(output?.ok),
    skipped: false,
    exitCode: result.status,
    webhookType,
    event: output?.event || "alert_smoke_test",
    severity: output?.severity || "info",
    expectedStatus: output?.expectedStatus || expectedStatus,
    httpStatus: output?.httpStatus || "",
    responseBody: output?.responseBody || "",
    stderr: result.stderr.trim(),
  };
}

function runExternalDrill({ webhookUrl, webhookType }) {
  const result = spawnSync(
    "node",
    [
      path.join(scriptDir, "melwater-alert-drill.mjs"),
      `--webhook-url=${webhookUrl}`,
      `--webhook-type=${webhookType}`,
      `--melwater-env-file=${options.envFile}`,
      `--ops-root=${options.opsRoot}`,
      `--recovery-attempts=${options.recoveryAttempts}`,
      `--recovery-sleep=${options.recoverySleep}`,
    ],
    {
      cwd: appDir,
      encoding: "utf8",
      env: { ...process.env, MELWATER_ENV_FILE: options.envFile },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const output = safeJsonOrText(result.stdout);
  return {
    ok: result.status === 0 && Boolean(output?.ok),
    skipped: false,
    exitCode: result.status,
    mode: output?.mode || "external-webhook",
    recoveryMode: output?.recoveryMode || "",
    releaseRef: output?.releaseRef || "",
    drillDir: output?.drillDir || "",
    latestJson: output?.files?.latestJson || "",
    latestMarkdown: output?.files?.latestMarkdown || "",
    observedWebhookEvents: output?.observedWebhookEvents || [],
    missingWebhookEvents: output?.missingWebhookEvents || [],
    recoveryAttempts: output?.stages?.recovery?.attempts?.length || 0,
    opsReportOk: output?.opsReport?.ok ?? null,
    stderr: result.stderr.trim(),
  };
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

function finish(payload, status) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(status);
}
