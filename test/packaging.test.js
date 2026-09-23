import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");

test("production install keeps runtime optional native bindings", async () => {
  const packageManifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const lockfile = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
  const dockerfile = await readFile(resolve(root, "Dockerfile"), "utf8");
  const workflow = await readFile(resolve(root, ".github/workflows/native-compatibility.yml"), "utf8");

  assert.deepEqual(packageManifest.dependencies, { "@rust-ml-runtime/node": "0.2.0" });
  assert.deepEqual(lockfile.packages[""].dependencies, { "@rust-ml-runtime/node": "0.2.0" });
  assert.match(dockerfile, /npm ci --include=optional/);
  assert.match(dockerfile, /npm run validate:native/);
  assert.match(workflow, /node:22-bookworm-slim/);
  assert.match(workflow, /npm ci --include=optional/);
  assert.match(workflow, /npm run validate:native/);
});
