const decisionTypeDefinition = {
  coverage: { allowedDecisions: ["covered", "not_covered", "human_review"] },
  prior_authorization_required: { allowedDecisions: ["required", "not_required", "human_review"] },
  prior_authorization_criteria: { allowedDecisions: ["criteria_met", "criteria_unmet", "human_review"] },
  claim_completeness: { allowedDecisions: ["complete", "incomplete", "human_review"] },
  claim_submission: { allowedDecisions: ["can_submit", "cannot_submit", "pending_information"] },
  claim_explanation: { allowedDecisions: ["claim_approved", "claim_denied", "claim_pending", "human_review"] },
  eligibility: { allowedDecisions: ["eligible", "not_eligible", "human_review"] },
  enrollment_validation: { allowedDecisions: ["valid", "invalid", "human_review"] },
  documentation_sufficiency: { allowedDecisions: ["sufficient", "insufficient", "human_review"] },
  human_review: { allowedDecisions: ["review_required", "review_not_required"] },
};

export function getDecisionTypeDefinition() {
  return decisionTypeDefinition;
}

export function validateDecisionRequest(request) {
  if (!request?.decision?.type || !request?.decision?.question || !request?.decision?.outputSchema) {
    const error = new Error("Decision request must include decision type, question, and output schema.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  if (!decisionTypeDefinition[request.decision.type]) {
    const error = new Error(`Unsupported decision type: ${request.decision.type}`);
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }

  if (!Array.isArray(request.evidence) || !request.evidence.length) {
    const error = new Error("Decision request must include evidence.");
    error.statusCode = 400;
    error.expose = true;
    throw error;
  }
}

function toIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function evidenceIds(request) {
  return new Set(request.evidence.map((item) => item.id));
}

function finding(id, criterion, result, evidence = [], detail = undefined) {
  return { id, criterion, result, evidence, detail };
}

function unmet(id, criterion, missingEvidence = []) {
  return { id, criterion, missingEvidence };
}

function baseResult(decision, status, explanation) {
  return {
    decision,
    status,
    confidence: status === "determined" ? 0.96 : status === "uncertain" ? 0.62 : 0.35,
    findings: [],
    unmetCriteria: [],
    evidence: [],
    nextAction: "",
    explanation,
  };
}

function memberEligible(request) {
  const evidence = evidenceIds(request);
  const eligibility = request.evidence.find((item) => item.kind === "eligibility");
  const serviceDate = request.context.serviceDate || request.context?.claim?.serviceDate || request.context?.enrollmentRecord?.serviceDate;
  const start = request.context.eligibilityEvidence?.effectiveFrom || request.context.enrollmentRecord?.effectiveFrom || eligibility?.detail?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const end = request.context.eligibilityEvidence?.effectiveTo || request.context.enrollmentRecord?.effectiveTo || eligibility?.detail?.match(/\d{4}-\d{2}-\d{2}$/)?.[0];

  if (!start || !end || !serviceDate) {
    return {
      decision: "not_eligible",
      status: "insufficient_evidence",
      unmet: unmet("eligibility-dates", "Active enrollment on date of service", ["member eligibility dates"]),
      nextAction: "Request eligibility record",
      explanation: "Eligibility dates are missing from the supplied request.",
    };
  }

  const active = toIsoDate(serviceDate) >= toIsoDate(start) && toIsoDate(serviceDate) <= toIsoDate(end);

  return active
    ? {
        decision: "eligible",
        status: "determined",
        finding: finding("eligibility-active", "Member eligible", "satisfied", [...evidence].filter((item) => item.includes("eligibility"))),
        nextAction: "Proceed with benefit review",
        explanation: "Enrollment is active on the service date supplied in the request.",
      }
    : {
        decision: "not_eligible",
        status: "determined",
        finding: finding("eligibility-inactive", "Member eligible", "not_satisfied", [...evidence].filter((item) => item.includes("eligibility"))),
        nextAction: "Advise member to contact enrollment support",
        explanation: "Enrollment ended before the date of service.",
      };
}

function coverageAssessment(request) {
  const result = baseResult("covered", "determined", "Coverage requirements are satisfied with the supplied evidence.");
  const policy = request.rules.policy;
  const eligibility = memberEligible(request);
  const allEvidence = evidenceIds(request);
  const providerEvidence = request.evidence.find((item) => item.kind === "provider");
  const clinicalEvidence = request.evidence.find((item) => item.kind === "clinical_note");
  const diagnosisCriterion =
    policy.criteria?.find((criterion) => {
      const description = String(criterion.description || "").toLowerCase();
      return (
        !description.includes("eligible member") &&
        !description.includes("conservative treatment") &&
        !description.includes("in-network")
      );
    }) || null;
  const networkCriterion = policy.criteria?.find((criterion) =>
    String(criterion.description || "").toLowerCase().includes("in-network"),
  );
  const conservativeCriterion = policy.criteria?.find((criterion) =>
    String(criterion.description || "").toLowerCase().includes("conservative treatment"),
  );

  result.findings.push(
    eligibility.finding ||
      finding("eligibility-missing", "Member eligible", eligibility.status === "insufficient_evidence" ? "missing_information" : "not_satisfied"),
  );

  if (eligibility.decision !== "eligible") {
    result.decision = eligibility.decision === "human_review" ? "human_review" : "not_covered";
    result.status = eligibility.status;
    result.nextAction = eligibility.nextAction;
    result.explanation = eligibility.explanation;
    if (eligibility.unmet) {
      result.unmetCriteria.push(eligibility.unmet);
    }
    result.evidence.push(...(result.findings[0].evidence || []));
    return result;
  }

  result.findings.push(
    finding("service-covered", "Service covered by policy", policy.covered ? "satisfied" : "not_satisfied", [
      `${policy.policyId}-policy`,
    ]),
  );

  if (!policy.covered) {
    result.decision = "not_covered";
    result.status = "determined";
    result.nextAction = "Discuss non-covered alternatives with the member";
    result.explanation = policy.exclusionReason || "The supplied policy excludes this service.";
    result.evidence = [`${policy.policyId}-policy`, result.findings[0].evidence?.[0]].filter(Boolean);
    return result;
  }

  const diagnosisSatisfied = Boolean(request.context.diagnosis?.code || request.context.service?.code);
  result.findings.push(
    finding(
      diagnosisCriterion?.id || "qualifying-diagnosis",
      diagnosisCriterion?.description || "Qualifying diagnosis",
      diagnosisSatisfied ? "satisfied" : "missing_information",
      [request.evidence.find((item) => item.kind === "diagnosis")?.id].filter(Boolean),
    ),
  );

  const providerInNetwork = !providerEvidence?.detail?.includes("out_of_network");
  result.findings.push(
    finding(
      networkCriterion?.id || "provider-network",
      networkCriterion?.description || "Provider eligible",
      providerInNetwork ? "satisfied" : "not_satisfied",
      [request.evidence.find((item) => item.kind === "provider")?.id].filter(Boolean),
    ),
  );

  if (request.context.conflicts?.length) {
    result.decision = "human_review";
    result.status = "uncertain";
    result.findings.push(
      finding("conflict-check", "Conflicting evidence", "inconclusive", [...allEvidence].filter((item) => item.includes("conflict"))),
    );
    result.nextAction = "Route to manual review";
    result.explanation = "The supplied request contains conflicting evidence, so coverage should be reviewed by a human.";
    result.evidence = [...new Set(result.findings.flatMap((item) => item.evidence || []))];
    return result;
  }

  const duration = request.context.clinicalDocumentation?.conservativeTreatmentWeeks ?? request.context.clinicalEvidence?.conservativeTreatmentWeeks;
  const durationEvidenceId = clinicalEvidence?.id;
  if (policy.policyId === "MRI-KNEE-2026") {
    if (duration == null) {
      result.decision = "covered";
      result.status = "insufficient_evidence";
      result.findings.push(
        finding(
          conservativeCriterion?.id || "conservative-treatment",
          conservativeCriterion?.description || "Conservative treatment documented",
          "partially_satisfied",
          durationEvidenceId ? [durationEvidenceId] : [],
        ),
      );
      result.unmetCriteria.push(
        unmet(
          conservativeCriterion?.id || "c3",
          conservativeCriterion?.description || "Conservative treatment for at least 6 weeks",
          ["Treatment duration in the clinical note"],
        ),
      );
      result.nextAction = "Request documentation that shows the duration of conservative treatment";
      result.explanation = "Coverage may apply, but the supplied evidence does not show how long conservative treatment was attempted.";
    } else {
      result.findings.push(
        finding(
          conservativeCriterion?.id || "conservative-treatment",
          conservativeCriterion?.description || "Conservative treatment documented",
          duration >= 6 ? "satisfied" : "not_satisfied",
          durationEvidenceId ? [durationEvidenceId] : [],
          `${duration} weeks documented`,
        ),
      );

      if (duration < 6) {
        result.decision = "not_covered";
        result.status = "determined";
        result.unmetCriteria.push(
          unmet(conservativeCriterion?.id || "c3", conservativeCriterion?.description || "Conservative treatment for at least 6 weeks", []),
        );
        result.nextAction = "Continue conservative therapy before resubmission";
        result.explanation = "The MRI policy requires at least six weeks of conservative treatment.";
      }
    }
  }

  result.evidence = [...new Set(result.findings.flatMap((item) => item.evidence || []))];
  if (!result.nextAction) {
    result.nextAction = policy.priorAuthorization ? "Submit prior authorization" : "Claim may proceed";
  }
  return result;
}

function priorAuthorizationAssessment(request) {
  const coverage = coverageAssessment(request);
  const result = baseResult("not_required", coverage.status, "Prior authorization requirement determined from the supplied policy.");
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  if (coverage.status === "uncertain") {
    result.decision = "human_review";
    result.status = "uncertain";
    result.nextAction = "Resolve conflicting evidence before deciding prior authorization";
    result.explanation = "Conflicting request data prevents a reliable prior authorization determination.";
    return result;
  }

  if (coverage.findings.some((item) => item.criterion === "Member eligible" && item.result !== "satisfied")) {
    result.decision = request.rules.policy.priorAuthorization ? "required" : "not_required";
    result.status = coverage.status;
    result.nextAction = coverage.nextAction;
    result.explanation = coverage.explanation;
    return result;
  }

  result.decision = request.rules.policy.priorAuthorization ? "required" : "not_required";
  result.status = coverage.status;
  result.nextAction = request.rules.policy.priorAuthorization ? "Submit or continue prior authorization review" : "No prior authorization is required";
  result.explanation = request.rules.policy.priorAuthorization
    ? "The supplied policy requires prior authorization for this service."
    : "The supplied policy does not require prior authorization for this service.";
  return result;
}

function priorAuthorizationCriteriaAssessment(request) {
  const coverage = coverageAssessment(request);
  const result = baseResult("criteria_met", coverage.status, "Prior authorization criteria were evaluated against the supplied request.");
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  if (coverage.status === "uncertain") {
    result.decision = "human_review";
    result.status = "uncertain";
    result.nextAction = "Send to nurse reviewer";
    result.explanation = coverage.explanation;
    return result;
  }

  if (coverage.status === "insufficient_evidence") {
    result.decision = "criteria_unmet";
    result.nextAction = "Request missing clinical documentation";
    result.explanation = "One or more required criteria cannot be confirmed from the current evidence.";
    return result;
  }

  if (coverage.decision === "not_covered") {
    result.decision = "criteria_unmet";
    result.nextAction = "Communicate unmet clinical or policy criteria";
    result.explanation = coverage.explanation;
    return result;
  }

  result.decision = "criteria_met";
  result.status = "determined";
  result.nextAction = "Approve prior authorization if administrative checks also pass";
  result.explanation = "All required prior authorization criteria are satisfied in the supplied request.";
  return result;
}

function claimCompletenessAssessment(request) {
  const result = baseResult("complete", "determined", "The supplied claim package includes the required information.");
  const coverage = coverageAssessment(request);
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  const claimRecord = request.context.claim || {};
  const hasClaimEvidence = Boolean(claimRecord.id || request.evidence.find((item) => item.kind === "claim"));
  result.findings.push(finding("claim-record", "Claim record supplied", hasClaimEvidence ? "satisfied" : "missing_information", request.evidence.find((item) => item.kind === "claim")?.id ? [request.evidence.find((item) => item.kind === "claim")?.id] : []));

  if (coverage.status !== "determined") {
    result.decision = "incomplete";
    result.status = coverage.status;
    result.nextAction = coverage.nextAction;
    result.explanation = coverage.explanation;
    return result;
  }

  if (!hasClaimEvidence) {
    result.decision = "incomplete";
    result.status = "insufficient_evidence";
    result.unmetCriteria.push(unmet("claim", "Claim record supplied", ["Claim submission record"]));
    result.nextAction = "Provide a claim record before submission";
    result.explanation = "A claim record was not supplied in the request context.";
    return result;
  }

  result.decision = "complete";
  result.nextAction = "Claim packet is complete";
  return result;
}

function claimSubmissionAssessment(request) {
  const completeness = claimCompletenessAssessment(request);
  const result = baseResult("can_submit", completeness.status, "The claim can be submitted.");
  result.findings = [...completeness.findings];
  result.unmetCriteria = [...completeness.unmetCriteria];
  result.evidence = [...completeness.evidence];

  if (completeness.status === "insufficient_evidence") {
    result.decision = "pending_information";
    result.nextAction = completeness.nextAction;
    result.explanation = completeness.explanation;
    return result;
  }

  if (completeness.status === "uncertain" || completeness.findings.some((item) => item.criterion === "Member eligible" && item.result !== "satisfied")) {
    result.decision = "cannot_submit";
    result.status = completeness.status;
    result.nextAction = completeness.nextAction;
    result.explanation = completeness.explanation;
    return result;
  }

  const priorAuth = priorAuthorizationAssessment(request);
  if (priorAuth.decision === "required" && request.context.priorAuthorization?.status !== "approved_pending_validation") {
    result.decision = "pending_information";
    result.status = priorAuth.status;
    result.nextAction = "Obtain prior authorization before submitting the claim";
    result.explanation = "The policy requires prior authorization before claim submission.";
    return result;
  }

  result.decision = "can_submit";
  result.status = "determined";
  result.nextAction = "Submit claim";
  return result;
}

function claimExplanationAssessment(request) {
  const coverage = coverageAssessment(request);
  const result = baseResult("claim_pending", coverage.status, "The claim status can be explained from the supplied context.");
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  const claim = request.context.claim || {};
  if (coverage.status === "uncertain") {
    result.decision = "human_review";
    result.status = "uncertain";
    result.nextAction = "Tell the member the claim is under manual review";
    result.explanation = "Conflicting evidence means the claim outcome should be confirmed by a human reviewer.";
    return result;
  }

  if (coverage.decision === "not_covered" || claim.status === "denied" || claim.status === "rejected") {
    result.decision = "claim_denied";
    result.nextAction = "Explain the denial reason and next appeal or documentation step";
    result.explanation = claim.rejectionReason || coverage.explanation;
    return result;
  }

  if (coverage.status === "insufficient_evidence" || claim.status === "pended") {
    result.decision = "claim_pending";
    result.status = "insufficient_evidence";
    result.nextAction = coverage.nextAction || "Request missing information";
    result.explanation = coverage.explanation;
    return result;
  }

  result.decision = "claim_approved";
  result.status = "determined";
  result.nextAction = "Confirm approval and any remaining utilization management requirements";
  result.explanation = "The supplied claim context supports approval of the requested service.";
  return result;
}

function documentationSufficiencyAssessment(request) {
  const coverage = coverageAssessment(request);
  const result = baseResult("sufficient", coverage.status, "Documentation is sufficient for the requested decision.");
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  if (coverage.status === "uncertain") {
    result.decision = "human_review";
    result.status = "uncertain";
    result.nextAction = "Escalate the case for human review";
    result.explanation = coverage.explanation;
    return result;
  }

  if (coverage.status === "insufficient_evidence") {
    result.decision = "insufficient";
    result.status = "insufficient_evidence";
    result.nextAction = coverage.nextAction;
    result.explanation = coverage.explanation;
    return result;
  }

  result.decision = "sufficient";
  result.status = "determined";
  result.nextAction = "Documentation supports the requested determination";
  return result;
}

function eligibilityAssessment(request) {
  const eligibility = memberEligible(request);
  const result = baseResult(eligibility.decision, eligibility.status, eligibility.explanation);
  if (eligibility.finding) {
    result.findings.push(eligibility.finding);
    result.evidence.push(...(eligibility.finding.evidence || []));
  }
  if (eligibility.unmet) {
    result.unmetCriteria.push(eligibility.unmet);
  }
  result.nextAction = eligibility.nextAction;
  return result;
}

function enrollmentValidationAssessment(request) {
  const eligibility = eligibilityAssessment(request);
  const result = baseResult("valid", eligibility.status, eligibility.explanation);
  result.findings = [...eligibility.findings];
  result.unmetCriteria = [...eligibility.unmetCriteria];
  result.evidence = [...eligibility.evidence];

  if (request.context.conflicts?.length) {
    result.decision = "human_review";
    result.status = "uncertain";
    result.findings.push(finding("enrollment-conflict", "Conflicting enrollment information", "inconclusive", []));
    result.nextAction = "Resolve enrollment conflicts manually";
    result.explanation = "The enrollment record contains conflicting information that requires manual resolution.";
    return result;
  }

  if (eligibility.decision !== "eligible") {
    result.decision = "invalid";
    result.nextAction = eligibility.nextAction;
    result.explanation = eligibility.explanation;
    return result;
  }

  result.decision = "valid";
  result.status = "determined";
  result.nextAction = "Enrollment is complete";
  return result;
}

function humanReviewAssessment(request) {
  const coverage = coverageAssessment(request);
  const result = baseResult("review_not_required", coverage.status, "Human review is not required.");
  result.findings = [...coverage.findings];
  result.unmetCriteria = [...coverage.unmetCriteria];
  result.evidence = [...coverage.evidence];

  if (coverage.status !== "determined" || coverage.decision === "human_review") {
    result.decision = "review_required";
    result.status = coverage.status === "determined" ? "uncertain" : coverage.status;
    result.nextAction = coverage.nextAction || "Escalate to human reviewer";
    result.explanation = coverage.explanation;
    return result;
  }

  result.decision = "review_not_required";
  result.status = "determined";
  result.nextAction = "Automated decision is adequate";
  result.explanation = "The supplied request is sufficiently clear for automated handling.";
  return result;
}

const evaluators = {
  coverage: coverageAssessment,
  prior_authorization_required: priorAuthorizationAssessment,
  prior_authorization_criteria: priorAuthorizationCriteriaAssessment,
  claim_completeness: claimCompletenessAssessment,
  claim_submission: claimSubmissionAssessment,
  claim_explanation: claimExplanationAssessment,
  eligibility: eligibilityAssessment,
  enrollment_validation: enrollmentValidationAssessment,
  documentation_sufficiency: documentationSufficiencyAssessment,
  human_review: humanReviewAssessment,
};

export function evaluateDecisionRequest(request, metadata = {}) {
  validateDecisionRequest(request);
  const evaluator = evaluators[request.decision.type];
  const result = evaluator(request);
  return validateDecisionResult(request, result, metadata);
}

export function validateDecisionResult(request, rawResult, metadata = {}) {
  if (!rawResult || typeof rawResult !== "object") {
    throw new Error("Decision result must be an object.");
  }

  const definition = decisionTypeDefinition[request.decision.type];
  const evidenceSet = evidenceIds(request);
  const result = {
    decision: rawResult.decision,
    status: rawResult.status,
    confidence: typeof rawResult.confidence === "number" ? rawResult.confidence : undefined,
    findings: Array.isArray(rawResult.findings) ? rawResult.findings : [],
    unmetCriteria: Array.isArray(rawResult.unmetCriteria) ? rawResult.unmetCriteria : [],
    evidence: Array.isArray(rawResult.evidence) ? rawResult.evidence : [],
    nextAction: typeof rawResult.nextAction === "string" ? rawResult.nextAction : "",
    explanation: typeof rawResult.explanation === "string" ? rawResult.explanation : "",
    provider: metadata.provider || "demo",
    model: metadata.model || "northstar-demo-logic",
    decisionType: request.decision.type,
  };

  if (!definition.allowedDecisions.includes(result.decision)) {
    throw new Error(`Decision "${result.decision}" is not valid for ${request.decision.type}.`);
  }

  if (!["determined", "uncertain", "insufficient_evidence"].includes(result.status)) {
    throw new Error(`Unsupported decision status "${result.status}".`);
  }

  if (!result.explanation) {
    throw new Error("Decision explanation is required.");
  }

  const referencedEvidence = new Set([
    ...result.evidence,
    ...result.findings.flatMap((item) => item.evidence || []),
  ]);

  for (const ref of referencedEvidence) {
    if (typeof ref === "string" && ref && !evidenceSet.has(ref)) {
      throw new Error(`Decision references unknown evidence: ${ref}`);
    }
  }

  const requiredCriteria = request.rules.requiredCriteria || [];
  if (requiredCriteria.length) {
    for (const criterion of request.rules.criteria || []) {
      const description = String(criterion.description || "").toLowerCase();
      const matches = [...result.findings, ...result.unmetCriteria].some((item) => {
        const id = String(item.id || "").toLowerCase();
        const criterionText = String(item.criterion || "").toLowerCase();
        return (
          id === String(criterion.id || "").toLowerCase() ||
          criterionText === description ||
          criterionText.includes(description) ||
          description.includes(criterionText) ||
          (description.includes("eligible member") && criterionText.includes("member eligible")) ||
          (description.includes("in-network") && criterionText.includes("provider eligible")) ||
          (description.includes("qualifying diagnosis") && criterionText.includes("diagnosis")) ||
          (description.includes("conservative treatment") && criterionText.includes("conservative treatment"))
        );
      });

      if (criterion.required !== false && !matches) {
        throw new Error(`Required criterion "${criterion.id}" is missing from the decision result.`);
      }
    }
  }

  return result;
}

export function safeDecisionFallback(request, error, metadata = {}) {
  return {
    decision:
      request.decision.type === "human_review"
        ? "review_required"
        : request.decision.type === "eligibility"
          ? "human_review"
          : "human_review",
    status: "uncertain",
    confidence: 0.12,
    findings: [
      {
        id: "validation-fallback",
        criterion: "Structured response validation",
        result: "failed",
        evidence: [],
        detail: error.message,
      },
    ],
    unmetCriteria: [],
    evidence: [],
    nextAction: "Route this case to a human reviewer",
    explanation: "The inference output failed validation, so the application rejected it and routed the case to human review.",
    provider: metadata.provider || "demo",
    model: metadata.model || "northstar-demo-logic",
    decisionType: request.decision.type,
  };
}

export function buildModelPrompt(request) {
  return `
You are a healthcare decision inference engine for synthetic demonstration data.
Return JSON only.

Rules:
- Use only the supplied request.
- Do not invent evidence.
- If information is missing, set status to "insufficient_evidence".
- If evidence conflicts, set status to "uncertain".
- Decision type: ${request.decision.type}
- Allowed decisions: ${decisionTypeDefinition[request.decision.type].allowedDecisions.join(", ")}

DecisionRequest:
${JSON.stringify(request, null, 2)}

Return a JSON object with:
decision, status, confidence, findings, unmetCriteria, evidence, nextAction, explanation
  `.trim();
}
