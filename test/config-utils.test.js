import test from "node:test";
import assert from "node:assert/strict";
import { parseConfigPayload } from "../public/app/client-utils.js";

test("parseConfigPayload returns valid config responses", () => {
  const payload = parseConfigPayload(
    { ok: true, status: 200 },
    { provider: "demo", modelName: "northstar-demo-logic" },
  );

  assert.equal(payload.provider, "demo");
});

test("parseConfigPayload throws for config fetch failures", () => {
  assert.throws(
    () => parseConfigPayload({ ok: false, status: 503 }, { error: "down" }),
    /Configuration request failed/i,
  );
});

test("parseConfigPayload throws for malformed config payloads", () => {
  assert.throws(
    () => parseConfigPayload({ ok: true, status: 200 }, { provider: "demo" }),
    /Configuration response is invalid/i,
  );
});
