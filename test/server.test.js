import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 18_000 + Math.floor(Math.random() * 1_000);
test("fails startup when the configured native model is unavailable", async () => {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), ML_RUNTIME_MODEL_DIR: join(tmpdir(), "hc-demo-test-models-not-installed") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stderr = [];
  server.stderr.on("data", (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolveExit) => server.once("exit", resolveExit));

  assert.equal(exitCode, 1);
  assert.match(Buffer.concat(stderr).toString("utf8"), /Local inference unavailable/);
});
