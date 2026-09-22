import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Fly routes health checks to the server port", async () => {
  const config = await readFile(new URL("../fly.toml", import.meta.url), "utf8");

  assert.match(config, /^\s*internal_port\s*=\s*8080\s*$/m);
});

test("the server listens on Fly's externally reachable interface", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

  assert.match(server, /server\.listen\(port, ["']0\.0\.0\.0["']/);
});
