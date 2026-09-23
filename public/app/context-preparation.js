const decisionForms = {
  coverage: { form: "noul", trueValue: "covered", falseValue: "not_covered", options: ["yes", "no", "uncertain"] },
  human_review: { form: "noul", trueValue: "review_required", falseValue: "review_not_required", options: ["yes", "no", "uncertain"] },
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

function planEnrollmentState(request) {
  const eligibilityEvidence = request.evidence?.find((item) => item.kind === "eligibility");
  const evidenceDates = eligibilityEvidence?.detail?.match(/\d{4}-\d{2}-\d{2}/g) || [];
  const evidenceStatus = eligibilityEvidence?.detail?.split(/\s+/)[0];
  const enrollment = request.context.enrollmentRecord || request.context.eligibilityEvidence || {
    status: evidenceStatus,
    effectiveFrom: evidenceDates[0],
    effectiveTo: evidenceDates[1],
  };
  const serviceDate = request.context.serviceDate;
  const datesComplete = Boolean(serviceDate && enrollment.effectiveFrom && enrollment.effectiveTo);
  return {
    enrollment,
    serviceDate,
    datesComplete,
    activeOnServiceDate:
      datesComplete && serviceDate >= enrollment.effectiveFrom && serviceDate <= enrollment.effectiveTo,
  };
}

function compactState(request, assessment, constrainToAssessment) {
  const policy = request.rules?.policy || {};
  const kinds = new Set(relevantEvidenceKinds[request.decision.type] || []);
  const facts = Object.fromEntries(
    (request.evidence || [])
      .filter((item) => kinds.has(item.kind) && item.kind !== "policy")
      .map(({ kind, detail }) => [kind, detail]),
  );
  const state = { facts };
  if (assessment && constrainToAssessment) {
    state.decision_constraint = {
      source: "healthcare_rules_and_evidence",
      status: assessment.status,
      admissible_outcome: assessment.decision,
      explanation: assessment.explanation,
    };
  }
  if (["eligibility", "enrollment_completion", "plan_selection"].includes(request.decision.type)) {
    const { enrollment, serviceDate, activeOnServiceDate } = planEnrollmentState(request);
    state.service_date = serviceDate;
    state.enrollment = {
      status: enrollment.status,
      effective_from: enrollment.effectiveFrom,
      effective_to: enrollment.effectiveTo,
      active_on_service_date: activeOnServiceDate,
    };
    state.eligible_on_service_date = activeOnServiceDate;
  }
  if (request.decision.type === "plan_selection") {
    const { activeOnServiceDate } = planEnrollmentState(request);
    if (state.facts.plan) {
      state.facts.plan_on_record = state.facts.plan;
      delete state.facts.plan;
    }
    state.plan_on_record = {
      id: request.context.plan?.id || request.rules.plan?.id,
      name: request.context.plan?.name || request.rules.plan?.name,
    };
    state.active_plan = activeOnServiceDate ? state.plan_on_record.name : "none";
  }
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

function choiceOptions(request, assessment, constrainToAssessment) {
  let labels = request.rules?.allowedDecisions || [];
  if (assessment && constrainToAssessment) {
    const fallback = labels.find((label) => label === "human_review" && label !== assessment.decision)
      || labels.find((label) => label !== assessment.decision);
    labels = [assessment.decision, fallback].filter(Boolean);
  } else if (request.decision.type === "plan_selection") {
    const { datesComplete, activeOnServiceDate } = planEnrollmentState(request);
    const planName = request.context.plan?.name || request.rules.plan?.name || "";
    const planDecision = planName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (datesComplete) {
      labels = labels.filter((label) =>
        activeOnServiceDate
          ? [planDecision, "no_applicable_plan", "human_review"].includes(label)
          : ["no_applicable_plan", "human_review"].includes(label),
      );
    }
  }
  return labels.map((label) => ({
    label,
    description:
      assessment && constrainToAssessment
        ? label === assessment.decision
          ? `${label.replaceAll("_", " ")} is the outcome admitted by the supplied rules and evidence.`
          : `${label.replaceAll("_", " ")} is excluded by the supplied rules and evidence; do not select it.`
        : request.decision.type !== "plan_selection"
        ? label.replaceAll("_", " ")
        : label === "no_applicable_plan"
          ? "Select when enrollment is inactive or does not include the service date."
          : label === "human_review"
            ? "Select only when the enrollment dates or plan record are missing or conflicting."
            : `Select ${label.replaceAll("_", " ")} only when it is the plan on record and enrollment includes the service date.`,
  }));
}

function decisionInstructions(request, assessment, constrainToAssessment, definition) {
  if (assessment && constrainToAssessment) {
    if (definition.form === "noul") {
      const requiredValue = assessment.decision === definition.trueValue;
      return `${request.decision.question} The healthcare rules and evidence require the ${assessment.decision} outcome. Return ${requiredValue}.`;
    }
    if (definition.form === "score") {
      const requiredScore = assessment.decision === "insufficient" ? 0 : assessment.decision === "sufficient" ? 2 : 1;
      return `${request.decision.question} The healthcare rules and evidence require the ${assessment.decision} outcome. Return score ${requiredScore}.`;
    }
    return `${request.decision.question} The healthcare rules and evidence have already constrained this request to state.decision_constraint.admissible_outcome. Select that admissible outcome.`;
  }
  if (request.decision.type === "eligibility") {
    return `${request.decision.question} Return true when eligible_on_service_date is true. Return false when it is false.`;
  }
  if (request.decision.type === "enrollment_completion") {
    return `${request.decision.question} Return true when eligible_on_service_date is true and the enrollment dates are complete. Return false when enrollment does not include the service date.`;
  }
  if (request.decision.type === "plan_selection") {
    return `${request.decision.question} A plan on the member record is active only when the service date is within the enrollment effective dates. If enrollment is terminated before the service date, choose no_applicable_plan.`;
  }
  return request.decision.question;
}

export function prepareLayaRequest(request, { assessment, constrainToAssessment = false } = {}) {
  const decisionType = request.decision.type;
  const definition = decisionForms[decisionType] || { form: "choice", options: request.rules?.allowedDecisions || [] };
  const state = compactState(request, assessment, constrainToAssessment);
  let kind;

  if (definition.form === "noul") {
    kind = {
      type: "noul",
      false_description:
        decisionType === "eligibility"
          ? "not eligible because enrollment does not include the service date"
          : definition.falseValue.replaceAll("_", " "),
      true_description:
        decisionType === "eligibility"
          ? "eligible because enrollment includes the service date"
          : definition.trueValue.replaceAll("_", " "),
    };
  } else if (definition.form === "score") {
    kind = { type: "score", levels: definition.levels };
  } else {
    kind = { type: "choice", options: choiceOptions(request, assessment, constrainToAssessment) };
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
      decisions: [{ name: decisionType, instructions: decisionInstructions(request, assessment, constrainToAssessment, definition), kind }],
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
    const probabilityIndex = Object.entries(typedDecision.probabilities || {})
      .filter(([label, probability]) => Number.isInteger(Number(label)) && typeof probability === "number")
      .sort((left, right) => right[1] - left[1])[0]?.[0];
    const selectedIndex = probabilityIndex === undefined ? Math.round(value.value) : Number(probabilityIndex);
    const level = prepared.levels[Math.max(0, Math.min(prepared.levels.length - 1, selectedIndex))];
    return level === "high" ? "sufficient" : level === "low" ? "insufficient" : "human_review";
  }
  throw new Error(`Laya returned ${value.type || "unknown"} for a ${prepared.form} request.`);
}
