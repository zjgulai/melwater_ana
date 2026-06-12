import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const releaseArg = process.argv.find((arg) => arg.startsWith("--release-dir="));
const releaseDir = releaseArg ? path.resolve(releaseArg.slice("--release-dir=".length)) : latestReleaseDir();
const appDir = path.join(releaseDir, "app");
const rollbackDir = path.join(releaseDir, "rollback");
const appManifestPath = path.join(appDir, "RELEASE_MANIFEST.json");
const rollbackManifestPath = path.join(rollbackDir, "ROLLBACK_MANIFEST.json");

function latestReleaseDir() {
  const releasesDir = path.join(rootDir, "releases");
  const entries = fs
    .readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  if (!entries.length) {
    throw new Error(`no release directories found in ${releasesDir}`);
  }
  return path.join(releasesDir, entries[0]);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function verifyManifest(manifestPath, baseDir) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const failures = [];
  for (const file of manifest.files || []) {
    const filePath = path.join(baseDir, file.path);
    if (!fs.existsSync(filePath)) {
      failures.push({ path: file.path, error: "missing" });
      continue;
    }
    const bytes = fs.statSync(filePath).size;
    const sha256 = sha256File(filePath);
    if (bytes !== file.bytes || sha256 !== file.sha256) {
      failures.push({ path: file.path, error: "checksum-mismatch" });
    }
  }
  return { manifest, failures };
}

const requiredAppPaths = [
  "dist/index.html",
  "server/reviewStateServer.mjs",
  "server/reviewStateApi.mjs",
  "server/reviewStateStore.mjs",
  "deploy/nginx/melwater.conf",
  "deploy/systemd/melwater-review-state-api.service",
  "package.json",
  "package-lock.json",
];

const requiredRollbackPaths = [
  "dist/index.html",
  "state/review-state.json",
  "state/review-state-manifest.json",
  "state/review-state-baseline.json",
];

const app = verifyManifest(appManifestPath, appDir);
const rollback = verifyManifest(rollbackManifestPath, rollbackDir);
const failures = [...app.failures.map((failure) => ({ scope: "app", ...failure })), ...rollback.failures.map((failure) => ({ scope: "rollback", ...failure }))];

for (const requiredPath of requiredAppPaths) {
  if (!fs.existsSync(path.join(appDir, requiredPath))) failures.push({ scope: "app", path: requiredPath, error: "required-missing" });
}
for (const requiredPath of requiredRollbackPaths) {
  if (!fs.existsSync(path.join(rollbackDir, requiredPath))) failures.push({ scope: "rollback", path: requiredPath, error: "required-missing" });
}

const indexPath = path.join(releaseDir, "release-index.json");
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : null;
if (!index) failures.push({ scope: "release", path: "release-index.json", error: "required-missing" });
for (const [scope, artifact] of [
  ["app-tarball", index?.appTarball],
  ["rollback-tarball", index?.rollbackTarball],
]) {
  const artifactPath = typeof artifact === "string" ? artifact : artifact?.path;
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    failures.push({ scope: "release", path: artifactPath || scope, error: "tarball-missing" });
    continue;
  }
  if (artifact?.sha256 && sha256File(artifactPath) !== artifact.sha256) {
    failures.push({ scope: "release", path: artifactPath, error: "tarball-checksum-mismatch" });
  }
  if (artifact?.bytes && fs.statSync(artifactPath).size !== artifact.bytes) {
    failures.push({ scope: "release", path: artifactPath, error: "tarball-size-mismatch" });
  }
}

const result = {
  ok: failures.length === 0,
  releaseDir,
  releaseId: app.manifest.releaseId,
  appFileCount: app.manifest.fileCount,
  rollbackFileCount: rollback.manifest.fileCount,
  failures,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
