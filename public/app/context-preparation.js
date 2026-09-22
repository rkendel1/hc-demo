const decisionForms = {
  coverage: { form: "noul", trueValue: "covered", falseValue: "not_covered", options: ["yes", "no", "uncertain"] },
  prior_authorization_required: { form: "noul", trueValue: "required", falseValue: "not_required", options: ["yes", "no", "uncertain"] },
  eligibility: { form: "noul", trueValue: "eligible", falseValue: "not_eligible", options: ["yes", "no", "uncertain"] },
  enrollment_completion: { form: "noul", trueValue: "complete", falseValue: "incomplete", options: ["yes", "no", "uncertain"] },
  conflict_check: { form: "noul", trueValue: "conflict_found", falseValue: "no_conflict", options: ["yes", "no", "uncertain"] },
  human_review: { form: "noul", trueValue: "review_required", falseValue: "review_not_required", options: ["yes", "no", "uncertain"] },
  enrollment_review: { form: "noul", trueValue: "review_required", falseValue: "review_not_required", options: ["yes", "no", "uncertain"] },
  documentation_sufficiency: { form: "score", levels: ["low", "medium", "high"], options: ["low", "medium", "high"] },
};

function compactEvidence(evidence) {
  return evidence.map(({ id, kind, label, detail }) => ({ id, kind, label, detail }));
}

const relevantEvidenceKinds = {
  coverage: ["eligibility", "policy", "service", "diagnosis", "provider", "clinical_note", "conflict"],
  prior_authorization_required: ["policy", "service", "benefit"],
  prior_authorization_criteria: ["eligibility", "policy", "diagnosis", "provider", "clinical_note", "conflict"],
  documentation_sufficiency: ["policy", "diagnosis", "clinical_note", "conflict"],
  claim_completeness: ["eligibility", "service", "diagnosis", "provider", "clinical_note", "claim"],
  claim_submission: ["eligibility", "policy", "clinical_note", "claim", "benefit"],
  claim_explanation: ["eligibility", "policy", "claim", "conflict"],
  eligibility: ["eligibility"],
  enrollment_completion: ["eligibility"],
  plan_selection: ["eligibility", "plan"],
  conflict_check: ["conflict"],
  enrollment_review: ["eligibility", "conflict"],
  human_review: ["policy", "clinical_note", "claim", "conflict"],
  next_action: ["eligibility", "policy", "benefit", "clinical_note", "claim", "conflict"],
};

function compactState(request) {
  const policy = request.rules?.policy || {};
  const kinds = new Set(relevantEvidenceKinds[request.decision.type] || []);
  const facts = Object.fromEntries(
    (request.evidence || [])
      .filter((item) => kinds.has(item.kind) && item.kind !== "policy")
      .map(({ kind, detail }) => [kind, detail]),
  );
  const state = { facts };
  const policyDecisionTypes = new Set([
    "coverage",
    "prior_authorization_required",
    "prior_authorization_criteria",
    "documentation_sufficiency",
    "claim_completeness",
    "claim_submission",
    "claim_explanation",
    "human_review",
    "next_action",
  ]);
  if (policyDecisionTypes.has(request.decision.type)) {
    state.policy = {
      covered: policy.covered,
      prior_authorization_required: policy.priorAuthorization,
      exclusion: policy.exclusionReason || undefined,
    };
  }
  if (["coverage", "prior_authorization_criteria", "documentation_sufficiency"].includes(request.decision.type)) {
    state.policy.criteria = (policy.criteria || []).map(({ description }) => description);
  }
  return state;
}

function choiceOptions(request) {
  return (request.rules?.allowedDecisions || []).map((label) => ({
    label,
    description: label.replaceAll("_", " "),
  }));
}

export function prepareLayaRequest(request) {
  const decisionType = request.decision.type;
  const definition = decisionForms[decisionType] || { form: "choice", options: request.rules?.allowedDecisions || [] };
  const state = compactState(request);
  let kind;

  if (definition.form === "noul") {
    kind = {
      type: "noul",
      false_description: definition.falseValue.replaceAll("_", " "),
      true_description: definition.trueValue.replaceAll("_", " "),
    };
  } else if (definition.form === "score") {
    kind = { type: "score", levels: definition.levels };
  } else {
    kind = { type: "choice", options: choiceOptions(request) };
  }

  return {
    decisionType,
    form: definition.form,
    trueValue: definition.trueValue,
    falseValue: definition.falseValue,
    levels: definition.levels,
    evidence: compactEvidence(request.evidence || []),
    runtimeRequest: {
      state,
      decisions: [{ name: decisionType, instructions: request.decision.question, kind }],
    },
    inspector: {
      decision: decisionType,
      form: definition.form,
      question: request.decision.question,
      state,
      options: definition.options,
      evidence: compactEvidence(request.evidence || []),
    },
  };
}

export function interpretLayaDecision(prepared, typedDecision) {
  const value = typedDecision?.value;
  if (!value || typeof value !== "object") throw new Error("Laya returned an invalid typed decision value.");

  if (prepared.form === "noul" && value.type === "noul") {
    return value.value ? prepared.trueValue : prepared.falseValue;
  }
  if (prepared.form === "choice" && value.type === "choice") return value.value;
  if (prepared.form === "score" && value.type === "score") {
    const level = prepared.levels[Math.max(0, Math.min(prepared.levels.length - 1, Math.round(value.value)))];
    return level === "high" ? "sufficient" : level === "low" ? "insufficient" : "human_review";
  }
  throw new Error(`Laya returned ${value.type || "unknown"} for a ${prepared.form} request.`);
}
