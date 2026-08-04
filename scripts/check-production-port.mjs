import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [dockerfile, envExample, packageJson, startWrapper] = await Promise.all([
  readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("./start-root.mjs", import.meta.url), "utf8"),
]);

assert.match(dockerfile, /ENV PORT=3010/);
assert.match(dockerfile, /EXPOSE 3010/);
assert.doesNotMatch(dockerfile, /(?:ENV PORT|EXPOSE)\s*=?(?:3000|8000)\b/);
assert.match(envExample, /^PORT="3010"$/m);
assert.match(envExample, /^UACP_PUBLIC_BASE_URL="https:\/\/gpc\.veklom\.com"$/m);
assert.doesNotMatch(envExample, /^PORT="(?:3000|8000)"$/m);
assert.match(packageJson, /scripts\/start-root\.mjs/);
assert.match(startWrapper, /process\.env\.PORT \|\|= "3010"/);
assert.doesNotMatch(startWrapper, /"(?:3000|8000)"/);

console.log("production root port contract: 3010");
