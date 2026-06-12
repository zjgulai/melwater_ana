import fs from "node:fs";
import path from "node:path";

export const schemaVersion = 2;

export const namespaces = {
  actionStatus: "action-status.csv",
  conceptDecision: "concept-decision.csv",
  crisisTriage: "crisis-triage.csv",
  quoteReview: "quote-review.csv",
  searchVerdict: "search-verdict.csv",
};

export function createReviewStateStore({ stateDir }) {
  const statePath = path.join(stateDir, "review-state.json");
  const eventsPath = path.join(stateDir, "review-events.jsonl");
  const baselinePath = path.join(stateDir, "review-state-baseline.json");
  const manifestPath = path.join(stateDir, "review-state-manifest.json");
  const backupsDir = path.join(stateDir, "backups");

  function emptyState() {
    return Object.fromEntries(Object.keys(namespaces).map((namespace) => [namespace, {}]));
  }

  function normalizeEntry(entry, fallbackUpdatedAt) {
    if (!entry || typeof entry !== "object" || !Object.hasOwn(entry, "value")) {
      return {
        value: entry,
        meta: {},
        version: 1,
        createdAt: fallbackUpdatedAt,
        updatedAt: fallbackUpdatedAt,
        updatedBy: "legacy",
      };
    }
    return {
      value: entry.value,
      meta: entry.meta || {},
      version: Number(entry.version || 1),
      createdAt: entry.createdAt || entry.updatedAt || fallbackUpdatedAt,
      updatedAt: entry.updatedAt || fallbackUpdatedAt,
      updatedBy: entry.updatedBy || "legacy",
    };
  }

  function normalizeStateObject(parsed = {}, fallbackUpdatedAt = new Date().toISOString()) {
    const state = emptyState();
    for (const [namespace, entries] of Object.entries(parsed || {})) {
      state[namespace] = state[namespace] || {};
      for (const [key, entry] of Object.entries(entries || {})) {
        state[namespace][key] = normalizeEntry(entry, fallbackUpdatedAt);
      }
    }
    return state;
  }

  function load() {
    try {
      return normalizeStateObject(JSON.parse(fs.readFileSync(statePath, "utf8")));
    } catch {
      return emptyState();
    }
  }

  function csvCell(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function writeTextFileAtomic(filePath, text) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmpPath, text);
    fs.renameSync(tmpPath, filePath);
  }

  function copyIfExists(sourcePath, targetPath) {
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  function writeCsvFiles(state) {
    const allRows = [["namespace", "key", "value", "version", "createdAt", "updatedAt", "updatedBy", "meta"]];
    for (const [namespace, entries] of Object.entries(state)) {
      const rows = [["key", "value", "version", "createdAt", "updatedAt", "updatedBy", "meta"]];
      for (const [key, entry] of Object.entries(entries || {})) {
        const row = [key, entry.value, entry.version, entry.createdAt, entry.updatedAt, entry.updatedBy, entry.meta || {}];
        rows.push(row);
        allRows.push([namespace, ...row]);
      }
      const filename = namespaces[namespace] || `${namespace}.csv`;
      writeTextFileAtomic(path.join(stateDir, filename), rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
    }
    writeTextFileAtomic(path.join(stateDir, "review-state.csv"), allRows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
  }

  function loadEvents() {
    try {
      return fs
        .readFileSync(eventsPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  function loadBaseline() {
    try {
      const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      return {
        schemaVersion: Number(parsed.schemaVersion || 1),
        createdAt: parsed.createdAt || null,
        state: normalizeStateObject(parsed.state || {}, parsed.createdAt || new Date().toISOString()),
      };
    } catch {
      return null;
    }
  }

  function writeBaseline(state) {
    const baseline = {
      schemaVersion,
      createdAt: new Date().toISOString(),
      state,
    };
    fs.mkdirSync(stateDir, { recursive: true });
    writeTextFileAtomic(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    return baseline;
  }

  function ensureBaseline(state) {
    return loadBaseline() || writeBaseline(state);
  }

  function writeEventsCsv(events) {
    const rows = [["eventId", "timestamp", "actor", "operation", "namespace", "key", "previousValue", "nextValue", "previousVersion", "nextVersion", "meta"]];
    for (const event of events) {
      rows.push([
        event.eventId,
        event.timestamp,
        event.actor,
        event.operation,
        event.namespace,
        event.key,
        event.previous?.value ?? "",
        event.next?.value ?? "",
        event.previous?.version ?? "",
        event.next?.version ?? "",
        event.meta || {},
      ]);
    }
    writeTextFileAtomic(path.join(stateDir, "review-events.csv"), rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
  }

  function writeManifest(state, events) {
    const baseline = loadBaseline();
    const entriesByNamespace = Object.fromEntries(
      Object.entries(state).map(([namespace, entries]) => [namespace, Object.keys(entries || {}).length]),
    );
    writeTextFileAtomic(
      manifestPath,
      JSON.stringify(
        {
          schemaVersion,
          generatedAt: new Date().toISOString(),
          statePath,
          eventsPath,
          baselinePath,
          baselineCreatedAt: baseline?.createdAt || null,
          entriesByNamespace,
          eventCount: events.length,
          csvFiles: {
            state: path.join(stateDir, "review-state.csv"),
            events: path.join(stateDir, "review-events.csv"),
            ...Object.fromEntries(Object.entries(namespaces).map(([namespace, filename]) => [namespace, path.join(stateDir, filename)])),
          },
        },
        null,
        2,
      ) + "\n",
    );
  }

  function save(state) {
    fs.mkdirSync(stateDir, { recursive: true });
    writeTextFileAtomic(statePath, JSON.stringify(state, null, 2) + "\n");
    writeCsvFiles(state);
    const events = loadEvents();
    writeEventsCsv(events);
    writeManifest(state, events);
  }

  function appendEvent(event) {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.appendFileSync(eventsPath, JSON.stringify(event) + "\n");
    const events = loadEvents();
    writeEventsCsv(events);
    writeManifest(load(), events);
  }

  function replayEvents(events = loadEvents(), baseState = emptyState()) {
    const state = JSON.parse(JSON.stringify(baseState));
    for (const event of events) {
      state[event.namespace] = state[event.namespace] || {};
      if (event.operation === "delete") {
        delete state[event.namespace][event.key];
      } else if (event.next) {
        state[event.namespace][event.key] = normalizeEntry(event.next, event.timestamp);
      }
    }
    return state;
  }

  function stateFingerprint(state) {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(state)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([namespace, entries]) => [
            namespace,
            Object.fromEntries(
              Object.entries(entries || {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [
                  key,
                  {
                    value: entry.value,
                    meta: entry.meta || {},
                    version: entry.version,
                    createdAt: entry.createdAt,
                    updatedAt: entry.updatedAt,
                    updatedBy: entry.updatedBy,
                  },
                ]),
            ),
          ]),
      ),
    );
  }

  function verifyReplay() {
    const current = load();
    const events = loadEvents();
    const baseline = loadBaseline();
    const replayableEvents = baseline?.createdAt
      ? events.filter((event) => !event.timestamp || event.timestamp > baseline.createdAt)
      : events;
    const replayed = replayEvents(replayableEvents, baseline?.state || emptyState());
    return {
      ok: stateFingerprint(current) === stateFingerprint(replayed),
      current,
      replayed,
      eventCount: events.length,
      replayedEventCount: replayableEvents.length,
      baselineCreatedAt: baseline?.createdAt || null,
    };
  }

  function migrate() {
    const state = load();
    const baseline = ensureBaseline(state);
    save(state);
    return {
      schemaVersion,
      state,
      events: loadEvents(),
      baselinePath,
      baselineCreatedAt: baseline.createdAt,
      manifestPath,
    };
  }

  function createBackup({ label = "manual" } = {}) {
    const state = load();
    ensureBaseline(state);
    save(state);

    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/[:.]/g, "-");
    const safeLabel = String(label || "manual").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "manual";
    const backupDir = path.join(backupsDir, `${safeTimestamp}-${safeLabel}`);
    const files = [
      ["review-state.json", statePath],
      ["review-events.jsonl", eventsPath],
      ["review-state-baseline.json", baselinePath],
      ["review-state-manifest.json", manifestPath],
      ["review-state.csv", path.join(stateDir, "review-state.csv")],
      ["review-events.csv", path.join(stateDir, "review-events.csv")],
      ...Object.values(namespaces).map((filename) => [filename, path.join(stateDir, filename)]),
    ];
    const copiedFiles = [];
    for (const [filename, sourcePath] of files) {
      if (copyIfExists(sourcePath, path.join(backupDir, filename))) {
        copiedFiles.push(filename);
      }
    }
    const backupManifest = {
      schemaVersion,
      createdAt: timestamp,
      label: safeLabel,
      sourceStateDir: stateDir,
      fileCount: copiedFiles.length,
      files: copiedFiles,
    };
    writeTextFileAtomic(path.join(backupDir, "backup-manifest.json"), JSON.stringify(backupManifest, null, 2) + "\n");
    return {
      ok: true,
      backupDir,
      ...backupManifest,
    };
  }

  function buildMetrics() {
    const state = load();
    const events = loadEvents();
    const verification = verifyReplay();
    const entriesByNamespace = Object.fromEntries(
      Object.entries(state).map(([namespace, entries]) => [namespace, Object.keys(entries || {}).length]),
    );
    const lastEvent = events.at(-1) || null;
    return {
      schemaVersion,
      stateDir,
      entriesByNamespace,
      totalEntries: Object.values(entriesByNamespace).reduce((sum, value) => sum + value, 0),
      eventCount: events.length,
      replayOk: verification.ok,
      replayedEventCount: verification.replayedEventCount,
      baselineCreatedAt: verification.baselineCreatedAt,
      lastEventAt: lastEvent?.timestamp || null,
      lastEventActor: lastEvent?.actor || null,
      lastEventOperation: lastEvent?.operation || null,
      lastEventNamespace: lastEvent?.namespace || null,
    };
  }

  function applyMutation({ namespace, key, value, meta = {}, actor = "Analyst", expectedVersion, delete: deleteRequested = false }) {
    if (!namespace || !key) {
      const error = new Error("namespace and key are required");
      error.statusCode = 400;
      throw error;
    }
    const state = load();
    state[namespace] = state[namespace] || {};
    const previous = state[namespace][key] || null;

    if (expectedVersion !== undefined && expectedVersion !== null) {
      const currentVersion = previous?.version ?? 0;
      if (Number(expectedVersion) !== currentVersion) {
        const error = new Error("write conflict: expectedVersion does not match current version");
        error.statusCode = 409;
        error.details = { currentVersion, expectedVersion: Number(expectedVersion), current: previous };
        throw error;
      }
    }

    const timestamp = new Date().toISOString();
    let next = null;
    const operation = deleteRequested || value === null ? "delete" : previous ? "update" : "create";
    if (operation === "delete") {
      delete state[namespace][key];
    } else {
      next = {
        value,
        meta,
        version: (previous?.version || 0) + 1,
        createdAt: previous?.createdAt || timestamp,
        updatedAt: timestamp,
        updatedBy: actor,
      };
      state[namespace][key] = next;
    }

    save(state);
    appendEvent({
      eventId: `${timestamp}-${namespace}-${Buffer.from(key).toString("hex").slice(0, 16)}`,
      timestamp,
      actor,
      operation,
      namespace,
      key,
      previous,
      next,
      meta,
    });

    return { ok: true, state, event: { operation, namespace, key, previous, next } };
  }

  return {
    statePath,
    eventsPath,
    baselinePath,
    backupsDir,
    manifestPath,
    load,
    loadEvents,
    save,
    migrate,
    createBackup,
    buildMetrics,
    replayEvents,
    verifyReplay,
    applyMutation,
  };
}
