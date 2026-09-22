import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionRequest } from "../public/app/catalog.js";
import { interpretLayaDecision, prepareLayaRequest } from "../public/app/context-preparation.js";

test("coverage context becomes a compact Laya Noul request", () => {
  const healthcare = buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-coverage", scenarioId: "scenario-a" });
  const prepared = prepareLayaRequest(healthcare);

  assert.equal(prepared.form, "noul");
  assert.equal(prepared.runtimeRequest.decisions[0].kind.type, "noul");
  assert.equal(prepared.runtimeRequest.state.policy.covered, true);
  assert.equal(prepared.runtimeRequest.state.policy.criteria.length, 4);
  assert.ok(Object.keys(prepared.runtimeRequest.state.facts).length >= 3);
  assert.equal("history" in prepared.runtimeRequest.state, false);
});

test("healthcare questions cover Noul, Choice, and Score decision forms", () => {
  const choice = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-claim-submit", scenarioId: "scenario-a" }));
  const score = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-documentation", scenarioId: "scenario-a" }));

  assert.equal(choice.runtimeRequest.decisions[0].kind.type, "choice");
  assert.deepEqual(choice.runtimeRequest.decisions[0].kind.options.map((item) => item.label), ["can_submit", "cannot_submit", "pending_information"]);
  assert.equal(score.runtimeRequest.decisions[0].kind.type, "score");
  assert.deepEqual(score.runtimeRequest.decisions[0].kind.levels, ["low", "medium", "high"]);
});

test("typed Laya values map back to bounded healthcare decisions", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "member", questionId: "member-coverage", scenarioId: "scenario-c" }));
  assert.equal(interpretLayaDecision(prepared, { value: { type: "noul", value: false } }), "not_covered");
});

test("member next step is a Choice with concrete actions", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "member", questionId: "member-next-step", scenarioId: "scenario-c" }));
  assert.equal(prepared.form, "choice");
  assert.equal(prepared.runtimeRequest.decisions[0].kind.type, "choice");
  assert.ok(prepared.runtimeRequest.decisions[0].kind.options.some((item) => item.label === "discuss_alternatives"));
});

test("plan selection sends the active plan and omits unrelated coverage policy", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "broker", questionId: "broker-plan", scenarioId: "scenario-c" }));
  assert.match(prepared.runtimeRequest.state.facts.plan, /Northstar Bronze Saver/);
  assert.equal("policy" in prepared.runtimeRequest.state, false);
  assert.equal(prepared.runtimeRequest.state.facts.eligibility, "active 2026-01-01 → 2026-12-31");
});
