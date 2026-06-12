const defaultBase = "http://127.0.0.1:4174/api/review-state";
const apiBase = (process.env.REVIEW_STATE_API_BASE || process.env.VITE_REVIEW_STATE_API_BASE || defaultBase).replace(/\/$/, "");
const token = process.env.REVIEW_STATE_VERIFY_TOKEN || process.env.REVIEW_STATE_TOKEN || process.env.REVIEW_STATE_ADMIN_TOKEN || "";
const timeoutMs = Number(process.env.REVIEW_STATE_VERIFY_TIMEOUT_MS || 8000);
const requireAuth = process.argv.includes("--require-auth");
const checkBackup = process.argv.includes("--backup");

function authHeaders(extra = {}) {
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: authHeaders(options.headers || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Metrics are plain text.
    }
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timeout);
  }
}

const results = {
  apiBase,
  tokenProvided: Boolean(token),
  checks: {},
};

try {
  results.checks.health = await request("/health");
  results.checks.replay = await request("/replay");
  results.checks.metrics = await request("/metrics");

  if (checkBackup) {
    results.checks.backup = await request("/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "verify-deployment" }),
    });
  }

  const metricsText = typeof results.checks.metrics.body === "string" ? results.checks.metrics.body : "";
  const failures = [];
  if (!results.checks.health.ok || !results.checks.health.body?.ok) failures.push("health");
  if (!results.checks.replay.ok || !results.checks.replay.body?.ok) failures.push("replay");
  if (!results.checks.metrics.ok || !metricsText.includes("melwater_review_state_replay_ok 1")) failures.push("metrics");
  if (requireAuth && !results.checks.health.body?.authRequired) failures.push("auth-required");
  if (checkBackup && (!results.checks.backup?.ok || !results.checks.backup?.body?.ok)) failures.push("backup");

  results.ok = failures.length === 0;
  results.failures = failures;
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.ok ? 0 : 1);
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ...results,
        ok: false,
        error: error.name === "AbortError" ? `request timed out after ${timeoutMs}ms` : error.message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
