import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const mode = readArg("mode") || (args.includes("--preflight") ? "preflight" : args.includes("--rollback") ? "rollback" : "deploy");
const execute = args.includes("--execute");
const checkSsh = args.includes("--check-ssh") || (execute && mode === "preflight");
const releaseDir = path.resolve(readArg("release-dir") || latestReleaseDir());

const allowedModes = new Set(["preflight", "deploy", "rollback"]);
if (!allowedModes.has(mode)) {
  failEarly(`invalid --mode=${mode}; expected preflight, deploy, or rollback`);
}

const config = {
  host: process.env.MELWATER_DEPLOY_HOST || "",
  user: process.env.MELWATER_DEPLOY_USER || "",
  port: process.env.MELWATER_DEPLOY_PORT || "22",
  sshKeyPath: process.env.MELWATER_SSH_KEY_PATH || "",
  deployPath: process.env.MELWATER_DEPLOY_PATH || "/opt/melwater/playbook-pain-radar-lab",
  deployMode: (process.env.MELWATER_DEPLOY_MODE || "systemd").toLowerCase(),
  remoteStateDir: process.env.MELWATER_REMOTE_STATE_DIR || "/var/lib/melwater/review-state",
  remoteStageRoot: process.env.MELWATER_REMOTE_STAGE_ROOT || "/tmp/melwater-deploy/releases",
  serviceName: process.env.MELWATER_SERVICE_NAME || "melwater-review-state-api",
  dockerComposeFile: process.env.MELWATER_DOCKER_COMPOSE_FILE || "",
  dockerComposeProject: process.env.MELWATER_DOCKER_COMPOSE_PROJECT || "melwater_ana",
  dockerComposeEnvFile: process.env.MELWATER_DOCKER_COMPOSE_ENV_FILE || "",
  appUser: process.env.MELWATER_REMOTE_APP_USER || "melwater",
  remoteOwner: process.env.MELWATER_REMOTE_OWNER || "",
  useSudo: process.env.MELWATER_REMOTE_USE_SUDO !== "0",
  apiBase: (process.env.REVIEW_STATE_API_BASE || "").replace(/\/$/, ""),
  verifyToken: process.env.REVIEW_STATE_VERIFY_TOKEN || process.env.REVIEW_STATE_TOKEN || process.env.REVIEW_STATE_ADMIN_TOKEN || "",
  edgeContainer: process.env.MELWATER_EDGE_CONTAINER || "ai_video_nginx",
  edgeRefreshEnabled: isTruthyEnv(process.env.MELWATER_EDGE_RESTART_ENABLED || process.env.MELWATER_EDGE_REFRESH_ENABLED),
  edgeRefreshCommand: process.env.MELWATER_EDGE_REFRESH_CMD || "",
};

if (!config.remoteOwner && config.appUser && config.useSudo) config.remoteOwner = `${config.appUser}:${config.appUser}`;

const failures = [];
const warnings = [];
const release = loadRelease(releaseDir);
const requiredEnv = ["MELWATER_DEPLOY_HOST", "MELWATER_DEPLOY_USER", "REVIEW_STATE_API_BASE", "REVIEW_STATE_VERIFY_TOKEN"];

for (const name of requiredEnv) {
  if (!process.env[name]) failures.push({ scope: "env", name, error: "missing-required-env" });
}
if (config.sshKeyPath && !fs.existsSync(config.sshKeyPath)) {
  failures.push({ scope: "env", name: "MELWATER_SSH_KEY_PATH", path: config.sshKeyPath, error: "file-not-found" });
}
if (!["systemd", "docker"].includes(config.deployMode)) {
  failures.push({ scope: "env", name: "MELWATER_DEPLOY_MODE", error: "invalid-deploy-mode" });
}
if (config.apiBase && !/\/api\/review-state(?:\/)?$/.test(config.apiBase)) {
  warnings.push(
    "REVIEW_STATE_API_BASE should end with '/api/review-state' for review-state verification; otherwise health/replay/metrics checks may return frontend HTML.",
  );
}
if (!release.ok) failures.push(...release.failures);

const plan = failures.length ? [] : buildPlan();
const executions = [];

if (!failures.length && execute) {
  const runnable = mode === "preflight" ? plan.filter((step) => step.executeForPreflight) : plan;
  for (const step of runnable) {
    const execution = runStep(step);
    executions.push(execution);
    if (!execution.ok) {
      if (step.optional) {
        warnings.push(`optional step failed but ignored: ${step.label}`);
      } else {
        failures.push({ scope: "remote-command", label: step.label, status: execution.status, error: "command-failed" });
        break;
      }
    }
  }
}

if (!execute && mode !== "preflight") {
  warnings.push("dry-run only; add --execute after reviewing the command plan");
}
if (mode === "preflight" && !checkSsh) {
  warnings.push("local preflight only; add --check-ssh or --execute to run read-only SSH checks");
}

const result = {
  ok: failures.length === 0,
  mode,
  execute,
  checkSsh,
  releaseDir,
  releaseId: release.index?.releaseId || null,
  artifactSha256: release.ok
    ? {
        app: release.appSha256,
        rollback: release.rollbackSha256,
      }
    : null,
  target: {
    deployMode: config.deployMode,
    host: config.host || null,
    user: config.user || null,
    port: config.port,
    deployPath: config.deployPath,
    remoteStateDir: config.remoteStateDir,
    remoteStageRoot: config.remoteStageRoot,
    dockerComposeFile: resolveComposeFilePath(),
    dockerComposeEnvFile: resolveComposeEnvFile() || null,
    dockerComposeProject: config.dockerComposeProject,
    serviceName: config.serviceName,
    appUser: config.appUser || null,
    remoteOwner: config.remoteOwner || null,
    useSudo: config.useSudo,
    apiBase: config.apiBase || null,
    verifyTokenProvided: Boolean(config.verifyToken),
    edgeRefreshEnabled: config.edgeRefreshEnabled,
    edgeContainer: config.edgeContainer || null,
    edgeRefreshCommand: resolveEdgeRefreshCommand() || null,
  },
  commands: plan.map(({ label, text }) => ({ label, text })),
  executions,
  warnings,
  failures,
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function readArg(name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || "";
}

function failEarly(message) {
  console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

function latestReleaseDir() {
  const releasesDir = path.join(rootDir, "releases");
  const entries = fs.existsSync(releasesDir)
    ? fs
        .readdirSync(releasesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a))
    : [];
  if (!entries.length) failEarly(`no release directories found in ${releasesDir}`);
  return path.join(releasesDir, entries[0]);
}

function loadRelease(candidateDir) {
  const releaseFailures = [];
  const indexPath = path.join(candidateDir, "release-index.json");
  if (!fs.existsSync(indexPath)) {
    return { ok: false, failures: [{ scope: "release", path: indexPath, error: "release-index-missing" }] };
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const appTarball = resolveArtifactPath(candidateDir, index.appTarball);
  const rollbackTarball = resolveArtifactPath(candidateDir, index.rollbackTarball);

  for (const [scope, artifactPath, expected] of [
    ["app-tarball", appTarball, index.appTarball],
    ["rollback-tarball", rollbackTarball, index.rollbackTarball],
  ]) {
    if (!artifactPath || !fs.existsSync(artifactPath)) {
      releaseFailures.push({ scope: "release", path: artifactPath || scope, error: "tarball-missing" });
      continue;
    }
    const expectedSha = expected?.sha256 || "";
    const expectedBytes = expected?.bytes || 0;
    const actualSha = sha256File(artifactPath);
    const actualBytes = fs.statSync(artifactPath).size;
    if (expectedSha && actualSha !== expectedSha) releaseFailures.push({ scope, path: artifactPath, error: "sha256-mismatch" });
    if (expectedBytes && actualBytes !== expectedBytes) releaseFailures.push({ scope, path: artifactPath, error: "size-mismatch" });
  }

  return {
    ok: releaseFailures.length === 0,
    failures: releaseFailures,
    index,
    indexPath,
    appTarball,
    rollbackTarball,
    appSha256: appTarball && fs.existsSync(appTarball) ? sha256File(appTarball) : null,
    rollbackSha256: rollbackTarball && fs.existsSync(rollbackTarball) ? sha256File(rollbackTarball) : null,
  };
}

function resolveArtifactPath(baseDir, artifact) {
  const rawPath = typeof artifact === "string" ? artifact : artifact?.path;
  if (!rawPath) return "";
  const direct = path.isAbsolute(rawPath) ? rawPath : path.resolve(baseDir, rawPath);
  if (fs.existsSync(direct)) return direct;
  return path.join(baseDir, path.basename(rawPath));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildPlan() {
  const target = `${config.user}@${config.host}`;
  const releaseStageDir = path.posix.join(config.remoteStageRoot, release.index.releaseId);
  const appName = path.basename(release.appTarball);
  const rollbackName = path.basename(release.rollbackTarball);
  const indexName = path.basename(release.indexPath);
  const uploadFiles = [release.appTarball, release.rollbackTarball, release.indexPath];

  const steps = [];
  steps.push(sshStep("remote tool preflight", remotePreflightScript(), { executeForPreflight: true }));

  if (mode === "preflight") return checkSsh ? steps : [];

  steps.push(sshStep("create remote stage directory", `mkdir -p ${q(releaseStageDir)}`));
  steps.push(rsyncStep("upload release artifacts", uploadFiles, target, releaseStageDir));
  steps.push(
    sshStep(
      "verify remote artifact checksums",
      [
        "set -e",
        `cd ${q(releaseStageDir)}`,
        `test "$(sha256sum ${q(appName)} | awk '{print $1}')" = ${q(release.appSha256)}`,
        `test "$(sha256sum ${q(rollbackName)} | awk '{print $1}')" = ${q(release.rollbackSha256)}`,
        `test -s ${q(indexName)}`,
      ].join("\n"),
    ),
  );

  if (mode === "deploy") {
    steps.push(sshStep("deploy release and restart service", remoteDeployScript(releaseStageDir, appName)));
    if (shouldRefreshEdge()) {
      steps.push(sshStep("refresh shared edge proxy", remoteEdgeRefreshScript(), { optional: true }));
    }
    steps.push(sshStep("verify deployed application", remoteVerifyScript()));
  } else if (mode === "rollback") {
    steps.push(sshStep("restore rollback snapshot and restart service", remoteRollbackScript(releaseStageDir, rollbackName)));
    if (shouldRefreshEdge()) {
      steps.push(sshStep("refresh shared edge proxy", remoteEdgeRefreshScript(), { optional: true }));
    }
    steps.push(sshStep("verify restored application", remoteVerifyScript()));
  }

  return steps;
}

function sshStep(label, remoteScript, extra = {}) {
  const sshArgs = [
    "-p",
    config.port,
    "-o",
    "BatchMode=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=10",
  ];
  if (config.sshKeyPath) sshArgs.push("-i", config.sshKeyPath);
  sshArgs.push(`${config.user}@${config.host}`, remoteScript);
  return {
    label,
    command: "ssh",
    args: sshArgs,
    text: redactSecrets(commandText("ssh", sshArgs)),
    ...extra,
  };
}

function rsyncStep(label, files, target, remoteDir) {
  const transport = ["ssh", "-p", config.port, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"]
    .concat(config.sshKeyPath ? ["-i", config.sshKeyPath] : [])
    .map((part) => (/[\s'"]/u.test(part) ? q(part) : part))
    .join(" ");
  const rsyncArgs = ["-az", "-e", transport, ...files, `${target}:${q(`${remoteDir}/`)}`];
  return {
    label,
    command: "rsync",
    args: rsyncArgs,
    text: redactSecrets(commandText("rsync", rsyncArgs)),
  };
}

function remotePreflightScript() {
  const composeFile = resolveComposeFilePath();
  const composeEnvFile = resolveComposeEnvFile();
  const lines = [
    "set -e",
    isDockerMode() ? "command -v docker >/dev/null" : "command -v node >/dev/null",
    isDockerMode() ? "docker compose version >/dev/null" : "command -v npm >/dev/null",
    "command -v tar >/dev/null",
    "command -v rsync >/dev/null",
    "command -v sha256sum >/dev/null",
    ...(isDockerMode() ? [] : ["command -v systemctl >/dev/null"]),
  ];
  if (isDockerMode()) {
    lines.push(`test -f ${q(composeFile)}`);
    if (composeEnvFile) lines.push(`test -f ${q(composeEnvFile)}`);
  }
  if (shouldRefreshEdge() && edgeRefreshUsesDocker()) lines.push("command -v docker >/dev/null");
  if (config.useSudo) lines.push("sudo -n true");
  lines.push(`test -d ${q(path.posix.dirname(config.remoteStageRoot))} || mkdir -p ${q(path.posix.dirname(config.remoteStageRoot))}`);
  lines.push("printf 'melwater-preflight-ok\\n'");
  return lines.join("\n");
}

function remoteDeployScript(releaseStageDir, appName) {
  const deployPath = q(config.deployPath);
  const stateDir = q(config.remoteStateDir);
  const backupLabel = q(`pre-remote-deploy-${release.index.releaseId}`);
  const lines = [
    "set -e",
    "umask 022",
    sudo(`mkdir -p ${deployPath} ${stateDir}`),
    `cd ${q(releaseStageDir)}`,
    "rm -rf app",
    `tar -xzf ${q(appName)}`,
    "test -d app",
    ...(isDockerMode()
      ? []
      : [`if [ -f ${deployPath}/package.json ]; then cd ${deployPath} && ${asApp(`env REVIEW_STATE_DIR=${stateDir} npm run review:backup -- --label=${backupLabel}`)} || true; fi`]),
    sudo(`rsync -a --delete ${q(`${releaseStageDir}/app/`)} ${deployPath}/`),
    maybeChown(),
    ...(isDockerMode()
      ? [composeCommand("up -d --build")]
      : [
          `cd ${deployPath}`,
          asApp("npm ci --omit=dev"),
          asApp(`env REVIEW_STATE_DIR=${stateDir} npm run review:migrate`),
          sudo(`systemctl restart ${config.serviceName}`),
        ]),
  ].filter(Boolean);
  return lines.join("\n");
}

function remoteRollbackScript(releaseStageDir, rollbackName) {
  const deployPath = q(config.deployPath);
  const stateDir = q(config.remoteStateDir);
  const lines = [
    "set -e",
    "umask 022",
    sudo(`mkdir -p ${deployPath} ${stateDir}`),
    `cd ${q(releaseStageDir)}`,
    "rm -rf rollback",
    `tar -xzf ${q(rollbackName)}`,
    "test -d rollback",
    ...(isDockerMode() ? [] : [sudo(`systemctl stop ${config.serviceName} || true`)]),
    sudo(`rsync -a --delete ${q(`${releaseStageDir}/rollback/dist/`)} ${deployPath}/dist/`),
    `if [ -d ${q(`${releaseStageDir}/rollback/state`)} ]; then ${sudo(`rsync -a ${q(`${releaseStageDir}/rollback/state/`)} ${stateDir}/`)}; fi`,
    maybeChown(),
    `cd ${deployPath}`,
    ...(isDockerMode()
      ? [composeCommand("up -d --build")]
      : [asApp(`env REVIEW_STATE_DIR=${stateDir} npm run review:replay`), sudo(`systemctl start ${config.serviceName}`)]),
  ].filter(Boolean);
  return lines.join("\n");
}

function remoteVerifyScript() {
  const verifyCommand = `cd ${q(config.deployPath)} && env REVIEW_STATE_API_BASE=${q(config.apiBase)} REVIEW_STATE_VERIFY_TOKEN=${q(config.verifyToken)} npm run review:verify-deploy -- --require-auth`;
  return asApp(`sh -lc ${q(verifyCommand)}`);
}

function remoteEdgeRefreshScript() {
  const edgeRefreshCommand = resolveEdgeRefreshCommand();
  if (!edgeRefreshCommand) return "";

  const lines = [
    "set -e",
    "echo \"Refreshing shared edge proxy\"",
    edgeRefreshCommand,
    "echo \"Shared edge proxy refresh completed\"",
  ];
  return lines.join("\n");
}

function isDockerMode() {
  return config.deployMode === "docker";
}

function resolveComposeFilePath() {
  if (config.dockerComposeFile) return config.dockerComposeFile;
  return path.posix.join(config.deployPath, "deploy/docker/docker-compose.yml");
}

function resolveComposeEnvFile() {
  if (config.dockerComposeEnvFile) return config.dockerComposeEnvFile;
  return path.posix.join(path.posix.dirname(config.deployPath), "secrets", "melwater.env");
}

function composeCommand(args) {
  const composeEnvFile = resolveComposeEnvFile();
  const optionParts = [
    "-f",
    q(resolveComposeFilePath()),
    "-p",
    q(config.dockerComposeProject),
    ...(composeEnvFile ? ["--env-file", q(composeEnvFile)] : []),
  ];
  return `cd ${q(config.deployPath)} && docker compose ${optionParts.join(" ")} ${args}`;
}

function sudo(command) {
  return config.useSudo ? `sudo -n ${command}` : command;
}

function asApp(command) {
  return config.useSudo && config.appUser ? `sudo -n -u ${q(config.appUser)} ${command}` : command;
}

function maybeChown() {
  return config.remoteOwner ? sudo(`chown -R ${q(config.remoteOwner)} ${q(config.deployPath)} ${q(config.remoteStateDir)}`) : "";
}

function runStep(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    label: step.label,
    ok: result.status === 0,
    status: result.status,
    durationMs: Date.now() - startedAt,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error?.message || null,
  };
}

function commandText(command, commandArgs) {
  return [command, ...commandArgs].map((part) => q(part)).join(" ");
}

function redactSecrets(value) {
  let output = value;
  for (const secret of [config.verifyToken, config.sshKeyPath]) {
    if (secret) output = output.replaceAll(secret, "<redacted>");
  }
  return output;
}

function q(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function isTruthyEnv(value = "") {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).trim().toLowerCase());
}

function shouldRefreshEdge() {
  return config.edgeRefreshEnabled && Boolean(resolveEdgeRefreshCommand());
}

function edgeRefreshUsesDocker() {
  const command = (resolveEdgeRefreshCommand() || "").trim();
  return /^docker(\s+.*)?$/u.test(command);
}

function resolveEdgeRefreshCommand() {
  if (config.edgeRefreshCommand) return config.edgeRefreshCommand;
  if (!config.edgeRefreshEnabled) return "";
  return `docker restart ${q(config.edgeContainer)}`;
}
