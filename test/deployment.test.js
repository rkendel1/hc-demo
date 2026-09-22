import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Fly routes health checks to the server port", async () => {
  const config = await readFile(new URL("../fly.toml", import.meta.url), "utf8");

  assert.match(config, /^\s*internal_port\s*=\s*8000\s*$/m);
});
