import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(scriptDir, "melwater-alert-webhook-readiness.mjs");

test("blocks real webhook readiness when webhook URL is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "melwater-webhook-readiness-"));
  const envFile = path.join(tempDir, "melwater.env");
  fs.writeFileSync(envFile, "MELWATER_ALERT_WEBHOOK_TYPE=feishu\nMELWATER_ALERT_DRY_RUN=0\n");

  const result = spawnSync("node", [scriptPath, `--melwater-env-file=${envFile}`, "--no-send", "--skip-drill"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, false);
  assert.equal(output.ready, false);
  assert.equal(output.reason, "missing MELWATER_ALERT_WEBHOOK_URL");
  assert.deepEqual(output.nextActions, [
    "Set MELWATER_ALERT_WEBHOOK_URL in the production env file.",
    "Set MELWATER_ALERT_WEBHOOK_TYPE to generic, feishu, or wecom.",
    "Run this command again with --send after confirming the target channel is ready.",
  ]);
});

test("reports check-only readiness without sending when webhook URL is configured", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "melwater-webhook-readiness-"));
  const envFile = path.join(tempDir, "melwater.env");
  fs.writeFileSync(
    envFile,
    [
      "MELWATER_ALERT_WEBHOOK_URL=https://example.invalid/webhook",
      "MELWATER_ALERT_WEBHOOK_TYPE=wecom",
      "MELWATER_ALERT_EXPECT_STATUS=2xx",
      "MELWATER_ALERT_DRY_RUN=0",
      "",
    ].join("\n"),
  );

  const result = spawnSync("node", [scriptPath, `--melwater-env-file=${envFile}`, "--no-send", "--skip-drill"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.equal(output.ready, true);
  assert.equal(output.mode, "check-only");
  assert.deepEqual(output.webhook, {
    configured: true,
    type: "wecom",
    dryRun: "0",
    expectedStatus: "2xx",
  });
  assert.equal(output.smokeTest.skipped, true);
  assert.equal(output.externalDrill.skipped, true);
});

test("sends a smoke alert to a configured webhook when requested", async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      received.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "melwater-webhook-readiness-"));
    const envFile = path.join(tempDir, "melwater.env");
    fs.writeFileSync(
      envFile,
      [
        `MELWATER_ALERT_WEBHOOK_URL=http://127.0.0.1:${server.address().port}/webhook`,
        "MELWATER_ALERT_WEBHOOK_TYPE=generic",
        "MELWATER_ALERT_EXPECT_STATUS=2xx",
        "MELWATER_ALERT_DRY_RUN=0",
        "",
      ].join("\n"),
    );

    const result = await runNode([scriptPath, `--melwater-env-file=${envFile}`, "--send", "--skip-drill"]);

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.mode, "send");
    assert.equal(output.smokeTest.ok, true);
    assert.equal(output.smokeTest.httpStatus, "200");
    assert.equal(output.externalDrill.skipped, true);
    assert.equal(received.length, 1);
    assert.equal(received[0].event, "alert_smoke_test");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn("node", args, { encoding: "utf8" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}
