import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewStateStore, schemaVersion } from "./reviewStateStore.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = process.env.REVIEW_STATE_DIR || path.join(rootDir, "state");
const store = createReviewStateStore({ stateDir });
const migration = store.migrate();
const verification = store.verifyReplay();

console.log(
  JSON.stringify(
    {
      ok: verification.ok,
      schemaVersion,
      stateDir,
      statePath: store.statePath,
      eventsPath: store.eventsPath,
      baselinePath: store.baselinePath,
      baselineCreatedAt: migration.baselineCreatedAt,
      manifestPath: migration.manifestPath,
      eventCount: verification.eventCount,
      replayedEventCount: verification.replayedEventCount,
      namespaces: Object.keys(migration.state),
    },
    null,
    2,
  ),
);

process.exit(verification.ok ? 0 : 1);
