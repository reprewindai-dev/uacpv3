import { Box } from "@upstash/box";

const apiKey = process.env.UPSTASH_BOX_API_KEY || "";
const boxId = process.env.UPSTASH_BOX_ID || "";
const boxName = process.env.UPSTASH_BOX_NAME || process.env.UACP_BOX_NAME || "uacp-pillar-council";
let internalApiKey = process.env.UACP_INTERNAL_API_KEY || "";
const port = Number(process.env.UACP_BOX_PORT || process.env.PORT || 3000);
const initCommand =
  process.env.UPSTASH_BOX_INIT_COMMAND ||
  "cd /workspace/home/uacpv3 && npm install && npm run build && npm run worker:pillar-council";
const setInitCommand = toBool(process.env.UPSTASH_BOX_SET_INIT_COMMAND, true);
const restartIfInitChanged = toBool(process.env.UPSTASH_BOX_RESTART_IF_INIT_CHANGED, true);
const resumeIfPaused = toBool(process.env.UPSTASH_BOX_RESUME_IF_PAUSED, true);
const waitAttempts = Number(process.env.UPSTASH_BOX_WAIT_ATTEMPTS || 24);
const waitMs = Number(process.env.UPSTASH_BOX_WAIT_MS || 5000);

if (!apiKey) {
  throw new Error("Missing UPSTASH_BOX_API_KEY.");
}

const box = boxId ? await Box.get(boxId, { apiKey }) : await Box.getByName(boxName, { apiKey });
const boxRecord = await findBoxRecord(box.id);
const runtime = String(boxRecord?.runtime || "");
const keepAlive = Boolean(boxRecord?.keep_alive);

if (runtime && !runtime.startsWith("node")) {
  throw new Error(
    `Box ${box.id} uses runtime "${runtime}". UACP V3 pillar-council requires a Node runtime because its init command uses npm and tsx.`,
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

if (resumeIfPaused && statusBefore.status === "paused") {
  await box.resume();
} else if (initCommandUpdated && restartIfInitChanged && statusBefore.status !== "paused") {
  await box.pause();
  await box.resume();
}

if (!internalApiKey) {
  internalApiKey = await readBoxEnv("UACP_INTERNAL_API_KEY");
}

if (!internalApiKey) {
  throw new Error("Missing UACP_INTERNAL_API_KEY locally and in the Box environment.");
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
      },
      initCommand: {
        updated: initCommandUpdated,
        current: currentInitCommand || null,
        target: initCommand,
      },
      runtime: {
        port,
        healthOk: Boolean(health?.ok),
        boxName: health?.runtime?.boxName,
        mode: health?.runtime?.mode,
        workerGroup: health?.runtime?.workerGroup,
        internalApiKeySource: process.env.UACP_INTERNAL_API_KEY ? "local-env" : "box-env",
      },
      bootstrap: {
        system: bootstrap?.system,
        status: bootstrap?.status,
      },
      operators: {
        count: Array.isArray(operators) ? operators.length : null,
        runCount: Array.isArray(operatorRuns) ? operatorRuns.length : null,
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

async function readBoxEnv(name) {
  const source = `
import os, sys
sys.stdout.write(os.environ.get(${JSON.stringify(name)}, ""))
`;
  const run = await box.exec.command(`python -c ${shellQuote(source)}`);
  return String(run.result || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findBoxRecord(id) {
  const boxes = await Box.list({ apiKey });
  return boxes.find((entry) => entry.id === id) || null;
}
