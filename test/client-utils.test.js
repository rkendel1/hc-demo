import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, parseDecisionPayload } from "../public/app/client-utils.js";

test("escapeHtml neutralizes markup from inference output", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("parseDecisionPayload returns valid decision responses", () => {
  const payload = parseDecisionPayload(
    { ok: true, status: 200 },
    { decision: "covered", status: "determined", explanation: "ok" },
  );

  assert.equal(payload.decision, "covered");
});

test("parseDecisionPayload throws for api errors", () => {
  assert.throws(
    () => parseDecisionPayload({ ok: false, status: 500 }, { error: "boom" }),
    /boom/,
  );
});

test("parseDecisionPayload throws for malformed success payloads", () => {
  assert.throws(
    () => parseDecisionPayload({ ok: true, status: 200 }, { error: "not a decision" }),
    /invalid response/i,
  );
});
