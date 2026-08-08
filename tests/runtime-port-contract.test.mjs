import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const launcher = new URL("../scripts/start-production.mjs", import.meta.url);

function runGuard(port) {
  const env = { ...process.env, UACP_PORT_GUARD_ONLY: "true" };
  if (port === undefined) delete env.PORT;
  else env.PORT = port;
  return spawnSync(process.execPath, [launcher.pathname], { env, encoding: "utf8" });
}

test("root production source contract is pinned to canonical port 3010", async () => {
  const [dockerfile, envExample, packageJson, renderYaml, boxSetup, boxFleet] = await Promise.all([
    read("Dockerfile"),
    read(".env.example"),
    read("package.json"),
    read("render.yaml"),
    read("scripts/setup-upstash-box.mjs"),
    read("scripts/upstash-box-fleet.config.mjs"),
  ]);

  assert.match(dockerfile, /^ENV PORT=3010$/m);
  assert.match(dockerfile, /^EXPOSE 3010$/m);
  assert.doesNotMatch(dockerfile, /^(?:ENV PORT=|EXPOSE )(?:3000|3012|8000)$/m);
  assert.match(envExample, /^PORT="3010"$/m);
  assert.match(envExample, /^UACP_BOX_PORT="3010"$/m);
  assert.doesNotMatch(envExample, /^(?:PORT|UACP_BOX_PORT)="(?:3000|3012|8000)"$/m);
  assert.match(envExample, /^UACP_PUBLIC_BASE_URL="https:\/\/gpc\.veklom\.com"$/m);
  assert.match(renderYaml, /- key: PORT\n\s+value: "3010"/m);
  assert.match(renderYaml, /- key: UACP_PUBLIC_BASE_URL\n\s+value: https:\/\/gpc\.veklom\.com/m);
  assert.match(boxSetup, /process\.env\.UACP_BOX_PORT \|\| process\.env\.PORT \|\| 3010/);
  assert.doesNotMatch(boxSetup, /process\.env\.UACP_BOX_PORT \|\| process\.env\.PORT \|\| (?:3000|3012|8000)/);
  assert.match(boxFleet, /^export const DEFAULT_BOX_PORT = 3010;$/m);
  assert.doesNotMatch(boxFleet, /^export const DEFAULT_BOX_PORT = (?:3000|3012|8000);$/m);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts.start, "node ./node_modules/tsx/dist/cli.mjs scripts/start-production.mjs");
});

test("production launcher defaults an unset PORT to 3010", () => {
  const result = runGuard(undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("production launcher accepts only 3010", () => {
  assert.equal(runGuard("3010").status, 0);
  for (const port of ["3000", "3012", "8000", "9999"]) {
    const result = runGuard(port);
    assert.notEqual(result.status, 0, `port ${port} must be rejected`);
    assert.match(result.stderr, /production requires 3010/);
  }
});
