import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionRequest, demoScenarios, getQuestionsByDecisionType, perspectives } from "../public/app/catalog.js";
import { formatDecisionLabel, getDecisionTone } from "../public/app/client-utils.js";
import { evaluateDecisionRequest, getDecisionTypeDefinition } from "../public/app/decision-engine.js";

function decide(perspectiveId, questionId, scenarioId) {
  return evaluateDecisionRequest(buildDecisionRequest({ perspectiveId, questionId, scenarioId }), { model: "matrix-test" });
}

test("the four audiences expose every supported decision family", () => {
  assert.deepEqual(perspectives.map((item) => item.label), ["Provider", "Member", "Broker", "Employer"]);
  const exposed = new Set(perspectives.flatMap((perspective) => perspective.questions.map((question) => question.decisionType)));
  assert.deepEqual([...exposed].sort(), Object.keys(getDecisionTypeDefinition()).sort());
});

test("perspective comparison only groups the same decision type", () => {
  assert.deepEqual(getQuestionsByDecisionType("plan_selection").map(({ perspective }) => perspective.id), ["broker", "employer"]);
  assert.deepEqual(getQuestionsByDecisionType("eligibility").map(({ perspective }) => perspective.id), ["provider", "member", "broker", "employer"]);
  assert.equal(getQuestionsByDecisionType("claim_explanation").length, 1);
});

test("every perspective, question, and scenario produces a valid, explainable decision", () => {
  let evaluated = 0;
  for (const perspective of perspectives) {
    for (const question of perspective.questions) {
      for (const scenario of demoScenarios) {
        const request = buildDecisionRequest({
          perspectiveId: perspective.id,
          questionId: question.id,
          scenarioId: scenario.id,
        });
        const result = evaluateDecisionRequest(request, { model: "matrix-test" });
        const allowed = getDecisionTypeDefinition()[question.decisionType].allowedDecisions;

        assert.ok(allowed.includes(result.decision), `${question.id}/${scenario.id}: invalid ${result.decision}`);
        assert.ok(result.explanation, `${question.id}/${scenario.id}: missing explanation`);
        assert.ok(result.nextAction, `${question.id}/${scenario.id}: missing next action`);
        assert.notEqual(getDecisionTone(result.decision, result.status), "neutral", `${question.id}/${scenario.id}: no semantic color`);
        evaluated += 1;
      }
    }
  }
  assert.equal(evaluated, perspectives.reduce((total, perspective) => total + perspective.questions.length, 0) * demoScenarios.length);
});

test("reported mismatch scenarios resolve to evidence-backed outcomes", () => {
  const covered = decide("member", "member-coverage", "scenario-a");
  const inactive = decide("provider", "provider-coverage", "scenario-d");
  const pending = decide("member", "member-claim-status", "scenario-a");
  assert.deepEqual([covered.decision, covered.status], ["covered", "determined"]);
  assert.deepEqual([inactive.decision, inactive.status], ["not_covered", "determined"]);
  assert.deepEqual([pending.decision, pending.status], ["claim_pending", "determined"]);
  assert.equal(decide("provider", "provider-claim-submit", "scenario-c").decision, "cannot_submit");
});

test("policy requirements stay separate from clinical evidence sufficiency", () => {
  const required = decide("provider", "provider-prior-auth", "scenario-b");
  const evidence = decide("provider", "provider-documentation", "scenario-b");
  assert.deepEqual([required.decision, required.status], ["required", "determined"]);
  assert.deepEqual([evidence.decision, evidence.status], ["insufficient", "insufficient_evidence"]);
});

test("employer enrollment questions return answers that match each question", () => {
  assert.equal(decide("employer", "employer-complete", "scenario-d").decision, "incomplete");
  assert.equal(decide("employer", "employer-plan", "scenario-a").decision, "northstar_gold_plus");
  assert.equal(decide("employer", "employer-plan", "scenario-d").decision, "no_applicable_plan");
  assert.equal(decide("employer", "employer-conflict", "scenario-e").decision, "conflict_found");
  assert.equal(decide("employer", "employer-review", "scenario-b").decision, "review_not_required");
  assert.equal(decide("employer", "employer-review", "scenario-e").decision, "review_required");
});

test("eligible and approved scenario exercises positive eligibility and claim outcomes", () => {
  assert.equal(decide("member", "member-eligibility", "scenario-f").decision, "eligible");
  assert.equal(decide("member", "member-claim-status", "scenario-f").decision, "claim_approved");
  assert.equal(decide("provider", "provider-claim-submit", "scenario-f").decision, "can_submit");
  assert.equal(decide("provider", "provider-prior-auth", "scenario-f").decision, "not_required");
  assert.equal(decide("member", "member-next-step", "scenario-f").decision, "proceed");
});

test("question-specific UI labels answer the selected question directly", () => {
  assert.equal(formatDecisionLabel("complete", "determined", "provider-missing-information"), "NO INFORMATION MISSING");
  assert.equal(formatDecisionLabel("criteria_met", "determined", "provider-criteria"), "CRITERIA MET");
  assert.equal(formatDecisionLabel("northstar_gold_plus", "determined", "employer-plan"), "NORTHSTAR GOLD PLUS");
  assert.equal(formatDecisionLabel("covered", "insufficient_evidence", "provider-coverage"), "INSUFFICIENT EVIDENCE");
});
