import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewStateStore } from "./reviewStateStore.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = process.env.REVIEW_STATE_DIR || path.join(rootDir, "state");
const labelArg = process.argv.find((arg) => arg.startsWith("--label="));
const label = labelArg ? labelArg.slice("--label=".length) : process.argv[2] || "manual";

const store = createReviewStateStore({ stateDir });
const backup = store.createBackup({ label });

console.log(
  JSON.stringify(
    {
      ok: backup.ok,
      stateDir,
      backupDir: backup.backupDir,
      label: backup.label,
      createdAt: backup.createdAt,
      fileCount: backup.fileCount,
      files: backup.files,
    },
    null,
    2,
  ),
);
