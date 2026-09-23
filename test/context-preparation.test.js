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

test("score decisions use the highest-probability class instead of rounding the continuous value", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({
    perspectiveId: "provider",
    questionId: "provider-documentation",
    scenarioId: "scenario-b",
  }));
  const decision = interpretLayaDecision(prepared, {
    value: { type: "score", value: 0.56 },
    probabilities: { 0: 0.565, 1: 0.352, 2: 0.083 },
  });

  assert.equal(decision, "insufficient");
});

test("eligibility requests receive the service date and computed enrollment fact for every perspective", () => {
  for (const [perspectiveId, questionId] of [
    ["provider", "provider-eligibility"],
    ["member", "member-eligibility"],
    ["broker", "broker-eligibility"],
    ["employer", "employer-eligibility"],
  ]) {
    const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId, questionId, scenarioId: "scenario-a" }));
    const decision = prepared.runtimeRequest.decisions[0];

    assert.equal(prepared.runtimeRequest.state.service_date, "2026-09-22");
    assert.equal(prepared.runtimeRequest.state.enrollment.active_on_service_date, true);
    assert.equal(prepared.runtimeRequest.state.eligible_on_service_date, true);
    assert.match(decision.instructions, /eligible_on_service_date is true/i);
    assert.equal(decision.kind.type, "choice");
  }
});

test("eligibility requests explicitly encode inactive enrollment", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({
    perspectiveId: "member",
    questionId: "member-eligibility",
    scenarioId: "scenario-d",
  }));

  assert.equal(prepared.runtimeRequest.state.service_date, "2026-07-15");
  assert.equal(prepared.runtimeRequest.state.enrollment.active_on_service_date, false);
  assert.equal(prepared.runtimeRequest.state.eligible_on_service_date, false);
});

test("authoritative assessments identify the admissible outcome while retaining a TopK-safe fallback", () => {
  const request = buildDecisionRequest({ perspectiveId: "member", questionId: "member-eligibility", scenarioId: "scenario-a" });
  const assessment = {
    decision: "eligible",
    status: "determined",
    explanation: "Enrollment includes the service date.",
  };
  const prepared = prepareLayaRequest(request, { assessment, constrainToAssessment: true });

  assert.equal(prepared.runtimeRequest.state.decision_constraint.admissible_outcome, "eligible");
  assert.deepEqual(prepared.runtimeRequest.decisions[0].kind.options.map((option) => option.label), ["eligible", "human_review"]);
  assert.match(prepared.runtimeRequest.decisions[0].kind.options[1].description, /excluded.*do not select/i);
  assert.match(prepared.runtimeRequest.decisions[0].instructions, /already constrained/i);
});

test("binary authoritative decisions retain two candidates for the runtime TopK operator", () => {
  const request = buildDecisionRequest({ perspectiveId: "employer", questionId: "employer-conflict", scenarioId: "scenario-a" });
  const prepared = prepareLayaRequest(request, {
    assessment: { decision: "no_conflict", status: "determined", explanation: "No conflicts were supplied." },
    constrainToAssessment: true,
  });

  assert.deepEqual(prepared.runtimeRequest.decisions[0].kind.options.map((option) => option.label), ["no_conflict", "conflict_found"]);
});

test("constrained score decisions retain their form and receive an explicit required score", () => {
  const request = buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-documentation", scenarioId: "scenario-b" });
  const prepared = prepareLayaRequest(request, {
    assessment: { decision: "insufficient", status: "insufficient_evidence", explanation: "Required duration is missing." },
    constrainToAssessment: true,
  });

  assert.equal(prepared.form, "score");
  assert.deepEqual(prepared.runtimeRequest.decisions[0].kind.levels, ["low", "medium", "high"]);
  assert.match(prepared.runtimeRequest.decisions[0].instructions, /require the insufficient outcome.*score 0/i);
});

test("member next step is a Choice with concrete actions", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "member", questionId: "member-next-step", scenarioId: "scenario-c" }));
  assert.equal(prepared.form, "choice");
  assert.equal(prepared.runtimeRequest.decisions[0].kind.type, "choice");
  assert.ok(prepared.runtimeRequest.decisions[0].kind.options.some((item) => item.label === "discuss_alternatives"));
});

test("plan selection sends the active plan and omits unrelated coverage policy", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "broker", questionId: "broker-plan", scenarioId: "scenario-c" }));
  assert.match(prepared.runtimeRequest.state.facts.plan_on_record, /Northstar Bronze Saver/);
  assert.equal(prepared.runtimeRequest.state.active_plan, "Northstar Bronze Saver");
  assert.equal("policy" in prepared.runtimeRequest.state, false);
  assert.equal(prepared.runtimeRequest.state.facts.eligibility, "active 2026-01-01 → 2026-12-31");
  assert.deepEqual(prepared.runtimeRequest.decisions[0].kind.options.map((option) => option.label), [
    "northstar_bronze_saver",
    "no_applicable_plan",
    "human_review",
  ]);
});

test("plan selection tells Laya to distinguish a plan on record from an active plan", () => {
  const prepared = prepareLayaRequest(buildDecisionRequest({ perspectiveId: "employer", questionId: "employer-plan", scenarioId: "scenario-d" }));
  const decision = prepared.runtimeRequest.decisions[0];

  assert.deepEqual(prepared.runtimeRequest.state.enrollment, {
    status: "terminated",
    effective_from: "2026-01-01",
    effective_to: "2026-06-30",
    active_on_service_date: false,
  });
  assert.equal(prepared.runtimeRequest.state.service_date, "2026-07-15");
  assert.equal(prepared.runtimeRequest.state.plan_on_record.name, "Northstar Gold Plus");
  assert.equal(prepared.runtimeRequest.state.active_plan, "none");
  assert.deepEqual(decision.kind.options.map((option) => option.label), ["no_applicable_plan", "human_review"]);
  assert.match(decision.instructions, /terminated before the service date.*no_applicable_plan/i);
  assert.match(decision.kind.options.find((option) => option.label === "no_applicable_plan").description, /enrollment is inactive/i);
});
