import path from "node:path";
import { fileURLToPath } from "node:url";
import { createReviewStateStore } from "./reviewStateStore.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = process.env.REVIEW_STATE_DIR || path.join(rootDir, "state");
const store = createReviewStateStore({ stateDir });
const verification = store.verifyReplay();

console.log(
  JSON.stringify(
    {
      ok: verification.ok,
      stateDir,
      baselineCreatedAt: verification.baselineCreatedAt,
      eventCount: verification.eventCount,
      replayedEventCount: verification.replayedEventCount,
      currentNamespaces: Object.keys(verification.current),
      replayedNamespaces: Object.keys(verification.replayed),
    },
    null,
    2,
  ),
);

process.exit(verification.ok ? 0 : 1);
