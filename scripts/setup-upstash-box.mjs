import { Box } from "@upstash/box";
import crypto from "node:crypto";

const apiKey = process.env.UPSTASH_BOX_API_KEY || "";
const boxId = process.env.UPSTASH_BOX_ID || "";
const boxName = process.env.UPSTASH_BOX_NAME || process.env.UACP_BOX_NAME || "uacp-pillar-council";
let internalApiKey = process.env.UACP_INTERNAL_API_KEY || "";
let internalApiKeySource = process.env.UACP_INTERNAL_API_KEY ? "local-env" : "unknown";
const port = Number(process.env.UACP_BOX_PORT || process.env.PORT || 3000);
const initCommand =
  process.env.UPSTASH_BOX_INIT_COMMAND ||
  "cd /workspace/home/uacpv3 && npm install && npm run build && npm run worker:pillar-council";
const setInitCommand = toBool(process.env.UPSTASH_BOX_SET_INIT_COMMAND, true);
const restartIfInitChanged = toBool(process.env.UPSTASH_BOX_RESTART_IF_INIT_CHANGED, true);
const resumeIfPaused = toBool(process.env.UPSTASH_BOX_RESUME_IF_PAUSED, true);
const writeDotEnv = toBool(process.env.UPSTASH_BOX_WRITE_DOTENV, true);
const waitAttempts = Number(process.env.UPSTASH_BOX_WAIT_ATTEMPTS || 24);
const waitMs = Number(process.env.UPSTASH_BOX_WAIT_MS || 5000);
const envFilePath = process.env.UPSTASH_BOX_ENV_FILE || "/workspace/home/uacpv3/.env";

if (!apiKey) {
  throw new Error("Missing UPSTASH_BOX_API_KEY.");
}

const box = boxId ? await Box.get(boxId, { apiKey }) : await Box.getByName(boxName, { apiKey });
const boxRecord = await findBoxRecord(box.id);
const runtime = String(boxRecord?.runtime || "");
const keepAlive = Boolean(boxRecord?.keep_alive);

const nodeTooling = await detectNodeTooling();

if (!nodeTooling.node || !nodeTooling.npm) {
  throw new Error(
    `Box ${box.id} does not have the required Node tooling. runtime="${runtime || "unknown"}" node=${nodeTooling.node ? "present" : "missing"} npm=${nodeTooling.npm ? "present" : "missing"}.`,
  );
}

const statusBefore = await box.getStatus();

let currentInitCommand = "";
let initCommandUpdated = false;

try {
  currentInitCommand = await box.getInitCommand();
} catch {
  currentInitCommand = "";
}

if (setInitCommand && normalize(currentInitCommand) !== normalize(initCommand)) {
  if (!keepAlive) {
    throw new Error(
      `Box ${box.id} is not keepAlive-enabled. Upstash only guarantees startup initCommand behavior for keep-alive boxes.`,
    );
  }
  await box.setInitCommand(initCommand);
  initCommandUpdated = true;
}

if (!internalApiKey) {
  internalApiKey = await readBoxEnv("UACP_INTERNAL_API_KEY");
  if (internalApiKey) {
    internalApiKeySource = "box-env";
  }
}

if (!internalApiKey) {
  internalApiKey = await readDotEnvValue("UACP_INTERNAL_API_KEY");
  if (internalApiKey) {
    internalApiKeySource = "box-dotenv";
  }
}

if (!internalApiKey) {
  internalApiKey = crypto.randomBytes(24).toString("hex");
  internalApiKeySource = "generated";
}

if (writeDotEnv) {
  await writeRuntimeDotEnv();
}

if (resumeIfPaused && statusBefore.status === "paused") {
  await box.resume();
}

const healthBeforeLaunch = await tryFetchJson("/api/health");
let manualLaunch = false;

if (!healthBeforeLaunch && restartIfInitChanged && keepAlive && statusBefore.status !== "paused") {
  await startKeepAliveProcess();
  manualLaunch = true;
}

const health = await waitForJson("/api/health");
const bootstrap = await waitForJson("/api/bootstrap");
const operators = await waitForJson("/api/v1/internal/operators", {
  "x-uacp-internal-key": internalApiKey,
});
const operatorRuns = await waitForJson("/api/v1/internal/operators/runs", {
  "x-uacp-internal-key": internalApiKey,
});
const statusAfter = await box.getStatus();

console.log(
  JSON.stringify(
    {
      ok: true,
      box: {
        id: box.id,
        name: boxName,
        runtime: runtime || null,
        keepAlive,
        statusBefore: statusBefore.status,
        statusAfter: statusAfter.status,
        nodeTooling,
      },
      initCommand: {
        updated: initCommandUpdated,
        current: currentInitCommand || null,
        target: initCommand,
        manualLaunch,
      },
      runtime: {
        port,
        healthOk: Boolean(health?.ok),
        boxName: health?.runtime?.boxName,
        mode: health?.runtime?.mode,
        workerGroup: health?.runtime?.workerGroup,
        internalApiKeySource,
      },
      bootstrap: {
        system: bootstrap?.system,
        status: bootstrap?.status,
      },
      operators: {
        count: arrayCount(operators),
        runCount: arrayCount(operatorRuns),
      },
    },
    null,
    2,
  ),
);

function toBool(value, fallback) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function normalize(value) {
  return String(value || "").trim().replace(/\r\n/g, "\n");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function shellLine(value) {
  return String(value || "").replace(/\r/g, "").replace(/\n/g, "");
}

async function waitForJson(path, headers = {}) {
  let lastError = "";

  for (let attempt = 1; attempt <= waitAttempts; attempt += 1) {
    try {
      return await fetchJson(path, headers);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < waitAttempts) {
        await sleep(waitMs);
      }
    }
  }

  throw new Error(`Failed to fetch ${path} after ${waitAttempts} attempts. ${lastError}`);
}

async function fetchJson(path, headers = {}) {
  const source = `
const url = ${JSON.stringify(`http://127.0.0.1:${port}${path}`)};
const headers = ${JSON.stringify(headers)};
const response = await fetch(url, { headers });
const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(response.status || 1);
}
process.stdout.write(text);
`;

  const run = await box.exec.command(`node --input-type=module -e ${shellQuote(source)}`);
  return JSON.parse(String(run.result || "").trim());
}

async function tryFetchJson(path, headers = {}) {
  try {
    return await fetchJson(path, headers);
  } catch {
    return null;
  }
}

async function readBoxEnv(name) {
  const source = `
import os, sys
sys.stdout.write(os.environ.get(${JSON.stringify(name)}, ""))
`;
  const run = await box.exec.command(`python -c ${shellQuote(source)}`);
  return String(run.result || "").trim();
}

async function readDotEnvValue(name) {
  const source = `
import fs from "node:fs";
const file = ${JSON.stringify(envFilePath)};
const key = ${JSON.stringify(name)};
if (!fs.existsSync(file)) process.exit(0);
const line = fs.readFileSync(file, "utf8").split(/\\r?\\n/).find((entry) => entry.startsWith(key + "="));
if (!line) process.exit(0);
const raw = line.slice(key.length + 1);
try {
  process.stdout.write(JSON.parse(raw));
} catch {
  process.stdout.write(raw.replace(/^"|"$/g, ""));
}
`;
  const run = await box.exec.command(`node --input-type=module -e ${shellQuote(source)}`);
  return String(run.result || "").trim();
}

async function detectNodeTooling() {
  const source = `
const { execSync } = await import("node:child_process");
const read = (command) => {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};
const nodePath = read("which node");
const npmPath = read("which npm");
process.stdout.write(JSON.stringify({
  node: Boolean(nodePath),
  npm: Boolean(npmPath),
  nodePath: nodePath || null,
  npmPath: npmPath || null,
}));
`;
  const run = await box.exec.command(`node --input-type=module -e ${shellQuote(source)}`);
  return JSON.parse(String(run.result || "").trim());
}

async function writeRuntimeDotEnv() {
  const runtimeEnv = {
    PORT: String(port),
    USER_EMAIL: process.env.USER_EMAIL || "founder@uacp.local",
    CONTACT_EMAIL: process.env.CONTACT_EMAIL || process.env.USER_EMAIL || "founder@uacp.local",
    UACP_INTERNAL_API_KEY: internalApiKey,
    UACP_BOX_NAME: boxName,
    UACP_RUNTIME_MODE: process.env.UACP_RUNTIME_MODE || "pillar_council",
    UACP_WORKER_GROUP: process.env.UACP_WORKER_GROUP || "pillar_council",
    UACP_ARCHIVE_WRITE_REQUIRED: process.env.UACP_ARCHIVE_WRITE_REQUIRED || "true",
  };

  if (process.env.GEMINI_API_KEY) runtimeEnv.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (process.env.UACP_ADMIN_KEY) runtimeEnv.UACP_ADMIN_KEY = process.env.UACP_ADMIN_KEY;
  if (process.env.DEFAULT_RESEARCH_QUERY) runtimeEnv.DEFAULT_RESEARCH_QUERY = process.env.DEFAULT_RESEARCH_QUERY;
  if (process.env.DATA_DIR) runtimeEnv.DATA_DIR = process.env.DATA_DIR;

  const content = Object.entries(runtimeEnv)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")
    .concat("\n");

  await box.files.write({ path: envFilePath, content });
}

async function startKeepAliveProcess() {
  const script = [
    "cd /workspace/home/uacpv3",
    "mkdir -p /workspace/home/uacpv3",
    "nohup npm run worker:pillar-council >/workspace/home/uacpv3/pillar-council.log 2>&1 </dev/null &",
    "echo started",
  ].join("; ");

  await box.exec.command(`sh -lc ${shellQuote(shellLine(script))}`);
}

function arrayCount(value) {
  return Array.isArray(value) ? value.length : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findBoxRecord(id) {
  const boxes = await Box.list({ apiKey });
  return boxes.find((entry) => entry.id === id) || null;
}
