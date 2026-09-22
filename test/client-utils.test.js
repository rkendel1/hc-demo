import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatDecisionLabel, getDecisionTone, parseDecisionPayload } from "../public/app/client-utils.js";

test("escapeHtml neutralizes markup from inference output", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("decision tones consistently reflect outcome semantics", () => {
  assert.equal(getDecisionTone("covered", "determined"), "positive");
  assert.equal(getDecisionTone("not_covered", "determined"), "negative");
  assert.equal(getDecisionTone("not_eligible", "determined"), "negative");
  assert.equal(getDecisionTone("claim_pending", "determined"), "warning");
  assert.equal(getDecisionTone("human_review", "uncertain"), "review");
  assert.equal(getDecisionTone("not_eligible", "insufficient_evidence"), "warning");
});

test("decision labels can directly answer question-specific wording", () => {
  assert.equal(formatDecisionLabel("complete", "determined", "provider-missing-information"), "NO INFORMATION MISSING");
  assert.equal(formatDecisionLabel("conflict_found", "determined", "employer-conflict"), "CONFLICT FOUND");
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
