import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionRequest } from "../public/app/catalog.js";
import { evaluateDecisionRequest, safeDecisionFallback, validateDecisionResult } from "../public/app/decision-engine.js";

test("scenario A coverage is covered with prior auth next action", () => {
  const request = buildDecisionRequest({
    perspectiveId: "provider",
    questionId: "provider-coverage",
    scenarioId: "scenario-a",
  });

  const result = evaluateDecisionRequest(request, { model: "test-model" });

  assert.equal(result.decision, "covered");
  assert.equal(result.status, "determined");
  assert.equal(result.nextAction, "Submit prior authorization");
  assert.ok(result.evidence.length >= 3);
});

test("scenario B coverage returns insufficient evidence for missing treatment duration", () => {
  const request = buildDecisionRequest({
    perspectiveId: "provider",
    questionId: "provider-coverage",
    scenarioId: "scenario-b",
  });

  const result = evaluateDecisionRequest(request, { model: "test-model" });

  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.decision, "covered");
  assert.match(result.explanation, /how long/i);
  assert.equal(result.unmetCriteria[0].criterion, "Conservative treatment for at least 6 weeks");
});

test("scenario C coverage is not covered for excluded service", () => {
  const request = buildDecisionRequest({
    perspectiveId: "member",
    questionId: "member-coverage",
    scenarioId: "scenario-c",
  });

  const result = evaluateDecisionRequest(request, { model: "test-model" });

  assert.equal(result.decision, "not_covered");
  assert.equal(result.status, "determined");
});

test("scenario D eligibility is not eligible when enrollment ended", () => {
  const request = buildDecisionRequest({
    perspectiveId: "enrollment",
    questionId: "enrollment-eligible",
    scenarioId: "scenario-d",
  });

  const result = evaluateDecisionRequest(request, { model: "test-model" });

  assert.equal(result.decision, "not_eligible");
  assert.equal(result.status, "determined");
});

test("scenario E routes uncertain coverage to human review", () => {
  const request = buildDecisionRequest({
    perspectiveId: "customer-service",
    questionId: "cs-coverage",
    scenarioId: "scenario-e",
  });

  const result = evaluateDecisionRequest(request, { model: "test-model" });

  assert.equal(result.decision, "human_review");
  assert.equal(result.status, "uncertain");
});

test("validation rejects unknown evidence references", () => {
  const request = buildDecisionRequest({
    perspectiveId: "provider",
    questionId: "provider-coverage",
    scenarioId: "scenario-a",
  });

  assert.throws(
    () =>
      validateDecisionResult(
        request,
        {
          decision: "covered",
          status: "determined",
          findings: [
            {
              id: "C1",
              criterion: "Eligible member",
              result: "satisfied",
              evidence: ["missing-evidence-id"],
            },
          ],
          unmetCriteria: [{ id: "C2", criterion: "Qualifying diagnosis", missingEvidence: [] }],
          evidence: [],
          explanation: "Bad evidence reference",
        },
        { model: "test-model" },
      ),
    /unknown evidence/i,
  );
});

test("fallback returns safe human review routing for invalid remote output", () => {
  const request = buildDecisionRequest({
    perspectiveId: "prior-auth",
    questionId: "pa-human-review",
    scenarioId: "scenario-e",
  });

  const result = safeDecisionFallback(request, new Error("malformed JSON"), { provider: "ollama", model: "local-model" });

  assert.equal(result.decision, "review_required");
  assert.equal(result.status, "uncertain");
  assert.equal(result.provider, "ollama");
});
