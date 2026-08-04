import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("root production runtime is pinned to canonical port 3010", async () => {
  const [dockerfile, envExample, packageJson, productionStart] = await Promise.all([
    read("Dockerfile"),
    read(".env.example"),
    read("package.json"),
    read("scripts/start-production.mjs"),
  ]);

  assert.match(dockerfile, /^ENV PORT=3010$/m);
  assert.match(dockerfile, /^EXPOSE 3010$/m);
  assert.doesNotMatch(dockerfile, /^(?:ENV PORT=|EXPOSE )(?:3000|3012|8000)$/m);

  assert.match(envExample, /^PORT="3010"$/m);
  assert.match(envExample, /^UACP_PUBLIC_BASE_URL="https:\/\/gpc\.veklom\.com"$/m);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts.start, "node ./node_modules/tsx/dist/cli.mjs scripts/start-production.mjs");

  assert.match(productionStart, /CANONICAL_PRODUCTION_PORT = "3010"/);
  assert.match(productionStart, /NODE_ENV === "production"/);
  assert.match(productionStart, /Refusing to start the root GPC runtime/);
});
