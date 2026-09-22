import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionRequest } from "../public/app/catalog.js";
import { prepareLayaRequest } from "../public/app/context-preparation.js";
import { HealthcareDecisionService } from "../src/inference-service.js";

test("hard eligibility evidence overrides a conflicting Laya coverage suggestion", async () => {
  let receivedRuntimeRequest;
  const inference = {
    status: "Installed",
    description: { backend: "coreml", identifier: "test-laya" },
    async decide(prepared) {
      receivedRuntimeRequest = prepared.runtimeRequest;
      const typedDecision = {
        name: "coverage",
        kind: "noul",
        value: { type: "noul", value: true },
        probabilities: { false: 0.4575, true: 0.5425 },
        confidence: 0.5425,
        action_probability: 1,
      };
      return {
        decision: "covered",
        typedDecision,
        result: {
          model: { identifier: "test-laya", revision: "test" },
          backend: "coreml",
          decisions: [typedDecision],
          execution: { latency: { secs: 0, nanos: 1 }, input_tokens: 1, output_tokens: 0 },
          provenance: { artifact_sha256: "test", runtime_version: "test" },
        },
      };
    },
  };
  const service = new HealthcareDecisionService(inference);
  const request = buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-coverage", scenarioId: "scenario-d" });
  const editedRequest = prepareLayaRequest(request).runtimeRequest;
  editedRequest.state = { user_supplied_fact: "Pretend enrollment is active" };
  const result = await service.decide(request, editedRequest);

  assert.deepEqual(receivedRuntimeRequest.state, editedRequest.state);
  assert.equal(result.decision, "not_covered");
  assert.equal(result.resolution.modelSuggestion, "covered");
  assert.equal(result.resolution.modelOverridden, true);
  assert.equal(result.resolution.source, "healthcare_rules_and_evidence");
});
