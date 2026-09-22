import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 18_000 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
});

test.after(() => {
  server.kill();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await fetch(`${baseUrl}/healthz`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  const [exitCode] = await once(server, "exit");
  throw new Error(`Server did not start (exit code ${exitCode}).`);
}

test("serves the portal and health check", async () => {
  const healthResponse = await waitForServer();
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true });

  const pageResponse = await fetch(`${baseUrl}/`);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /Jev Healthcare Decision Portal/);
});
