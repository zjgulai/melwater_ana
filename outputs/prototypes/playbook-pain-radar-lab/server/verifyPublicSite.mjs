const args = process.argv.slice(2);
const url = readArg("url") || process.env.PUBLIC_SITE_URL || process.env.MELWATER_PUBLIC_SITE_URL || "https://mkt.lute-tlz-dddd.top";
const expectedText = readArg("expect") || process.env.PUBLIC_SITE_EXPECT_TEXT || "";
const timeoutMs = Number(readArg("timeout-ms") || process.env.PUBLIC_SITE_TIMEOUT_MS || 10000);

const startedAt = Date.now();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, {
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "User-Agent": "melwater-public-site-verifier/1.0",
    },
  });
  const body = await response.text();
  const title = body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, " ").trim() || "";
  const failures = [];
  if (!response.ok) failures.push("status");
  if (expectedText && !body.includes(expectedText)) failures.push("expected-text");

  const result = {
    ok: failures.length === 0,
    url,
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: Buffer.byteLength(body),
    title,
    expectedTextProvided: Boolean(expectedText),
    durationMs: Date.now() - startedAt,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        url,
        durationMs: Date.now() - startedAt,
        error: error.name === "AbortError" ? `request timed out after ${timeoutMs}ms` : error.message,
      },
      null,
      2,
    ),
  );
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

function readArg(name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}
