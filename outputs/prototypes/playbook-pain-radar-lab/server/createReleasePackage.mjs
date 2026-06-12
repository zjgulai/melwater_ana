import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewStateStore } from "./reviewStateStore.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const releasesDir = path.join(rootDir, "releases");
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const releaseVersion = process.env.RELEASE_VERSION || packageJson.version || "0.0.0";
const releaseStamp = new Date().toISOString().replace(/[:.]/g, "-");
const gitSha = readGitSha();
const releaseId = process.env.RELEASE_ID || `${packageJson.name}-${releaseVersion}-${releaseStamp}`;
const releaseDir = path.join(releasesDir, releaseId);
const appDir = path.join(releaseDir, "app");
const rollbackDir = path.join(releaseDir, "rollback");

const releaseIncludes = [
  "dist",
  "server",
  "deploy",
  "package.json",
  "package-lock.json",
  ".env.example",
  "vite.config.mjs",
];

const rollbackIncludes = ["dist", "state", ".env.example"];

function readGitSha() {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function mkdirp(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath, { skip = () => false } = {}) {
  if (skip(sourcePath)) return;
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    mkdirp(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry), { skip });
    }
    return;
  }
  mkdirp(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFiles(baseDir) {
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile()) {
        files.push(path.relative(baseDir, entryPath).replaceAll(path.sep, "/"));
      }
    }
  }
  walk(baseDir);
  return files.sort();
}

function writeManifest(baseDir, manifestPath, extra = {}) {
  const files = listFiles(baseDir).filter((file) => file !== path.basename(manifestPath));
  const manifest = {
    releaseId,
    packageName: packageJson.name,
    packageVersion: releaseVersion,
    createdAt: new Date().toISOString(),
    gitSha,
    fileCount: files.length,
    files: files.map((file) => ({
      path: file,
      bytes: fs.statSync(path.join(baseDir, file)).size,
      sha256: sha256File(path.join(baseDir, file)),
    })),
    ...extra,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function createTarball(sourceDir, targetPath) {
  const result = spawnSync("tar", ["-czf", targetPath, "-C", path.dirname(sourceDir), path.basename(sourceDir)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`tar failed: ${result.stderr || result.stdout}`);
  }
}

function artifactInfo(filePath) {
  return {
    path: filePath,
    bytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
  };
}

function assertExists(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`required release input missing: ${relativePath}`);
  }
}

for (const relativePath of releaseIncludes) {
  assertExists(relativePath);
}

const store = createReviewStateStore({ stateDir: process.env.REVIEW_STATE_DIR || path.join(rootDir, "state") });
const backup = store.createBackup({ label: `release-${releaseStamp}` });

rmrf(releaseDir);
mkdirp(appDir);
mkdirp(rollbackDir);

for (const relativePath of releaseIncludes) {
  copyRecursive(path.join(rootDir, relativePath), path.join(appDir, relativePath));
}

for (const relativePath of rollbackIncludes) {
  const sourcePath = path.join(rootDir, relativePath);
  if (fs.existsSync(sourcePath)) {
    copyRecursive(sourcePath, path.join(rollbackDir, relativePath), {
      skip: (candidate) => candidate.includes(`${path.sep}state${path.sep}backups${path.sep}`),
    });
  }
}

const appManifest = writeManifest(appDir, path.join(appDir, "RELEASE_MANIFEST.json"), {
  artifactType: "app-release",
  releaseInputs: releaseIncludes,
  rollbackBackupDir: backup.backupDir,
});
const rollbackManifest = writeManifest(rollbackDir, path.join(rollbackDir, "ROLLBACK_MANIFEST.json"), {
  artifactType: "rollback-snapshot",
  releaseInputs: rollbackIncludes,
  sourceBackupDir: backup.backupDir,
});

const appTarball = path.join(releaseDir, `${releaseId}.tar.gz`);
const rollbackTarball = path.join(releaseDir, `${releaseId}-rollback.tar.gz`);
createTarball(appDir, appTarball);
createTarball(rollbackDir, rollbackTarball);

const index = {
  ok: true,
  releaseId,
  releaseDir,
  appDir,
  rollbackDir,
  appTarball: artifactInfo(appTarball),
  rollbackTarball: artifactInfo(rollbackTarball),
  appManifestPath: path.join(appDir, "RELEASE_MANIFEST.json"),
  rollbackManifestPath: path.join(rollbackDir, "ROLLBACK_MANIFEST.json"),
  appFileCount: appManifest.fileCount,
  rollbackFileCount: rollbackManifest.fileCount,
  backupDir: backup.backupDir,
  createdAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(releaseDir, "release-index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(JSON.stringify(index, null, 2));
