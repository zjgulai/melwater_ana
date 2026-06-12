import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = process.env.REVIEW_STATE_DIR || path.join(rootDir, "state");
const backupsDir = path.join(stateDir, "backups");
const keepArg = process.argv.find((arg) => arg.startsWith("--keep="));
const keep = Number(keepArg ? keepArg.slice("--keep=".length) : process.env.REVIEW_STATE_BACKUP_KEEP || 14);
const apply = process.argv.includes("--apply");

function listBackups() {
  try {
    return fs
      .readdirSync(backupsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const backupDir = path.join(backupsDir, entry.name);
        const stat = fs.statSync(backupDir);
        return {
          name: entry.name,
          backupDir,
          mtimeMs: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.name.localeCompare(a.name) || b.mtimeMs - a.mtimeMs);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const backups = listBackups();
const retained = backups.slice(0, keep);
const pruned = backups.slice(keep);

if (apply) {
  for (const backup of pruned) {
    fs.rmSync(backup.backupDir, { recursive: true, force: true });
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      stateDir,
      backupsDir,
      keep,
      total: backups.length,
      retained: retained.map((backup) => backup.name),
      pruned: pruned.map((backup) => backup.name),
    },
    null,
    2,
  ),
);
