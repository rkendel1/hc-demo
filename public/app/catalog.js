export const perspectives = [
  {
    id: "provider",
    label: "Provider",
    summary: "Clinical and claim-readiness questions",
    questions: [
      ["provider-coverage", "Is this service covered?", "coverage"],
      ["provider-prior-auth", "Is prior authorization required?", "prior_authorization_required"],
      ["provider-documentation", "Is my documentation sufficient?", "documentation_sufficiency"],
      ["provider-missing-information", "What information is missing?", "claim_completeness"],
      ["provider-claim-submit", "Can I submit this claim?", "claim_submission"],
    ],
  },
  {
    id: "member",
    label: "Member",
    summary: "Coverage and next-step guidance with member-safe context",
    questions: [
      ["member-coverage", "Is this service covered?", "coverage"],
      ["member-prior-auth", "Is prior authorization required?", "prior_authorization_required"],
      ["member-claim-denied", "Why was this claim denied?", "claim_explanation"],
      ["member-next-step", "What will I need to do next?", "human_review"],
    ],
  },
  {
    id: "prior-auth",
    label: "Prior Authorization",
    summary: "Criteria checks and evidence sufficiency",
    questions: [
      ["pa-required", "Is prior authorization required?", "prior_authorization_required"],
      ["pa-criteria", "Does this request satisfy the criteria?", "prior_authorization_criteria"],
      ["pa-unmet", "Which criteria are unmet?", "prior_authorization_criteria"],
      ["pa-evidence", "Is the evidence sufficient?", "documentation_sufficiency"],
      ["pa-human-review", "Should this case be reviewed by a human?", "human_review"],
    ],
  },
  {
    id: "customer-service",
    label: "Customer Service",
    summary: "Explain claims and recommend actions",
    questions: [
      ["cs-rejected", "Why was this claim rejected?", "claim_explanation"],
      ["cs-coverage", "Is this service covered?", "coverage"],
      ["cs-missing", "What information is missing?", "claim_completeness"],
      ["cs-tell-member", "What should I tell the member?", "claim_explanation"],
      ["cs-action", "What action should I take?", "human_review"],
    ],
  },
  {
    id: "enrollment",
    label: "Enrollment",
    summary: "Eligibility and enrollment validation",
    questions: [
      ["enrollment-eligible", "Is this member eligible?", "eligibility"],
      ["enrollment-complete", "Is enrollment complete?", "enrollment_validation"],
      ["enrollment-plan", "Which plan applies?", "enrollment_validation"],
      ["enrollment-conflict", "Is there conflicting information?", "enrollment_validation"],
      ["enrollment-review", "Does this require manual review?", "human_review"],
    ],
  },
].map((perspective) => ({
  ...perspective,
  questions: perspective.questions.map(([id, label, decisionType]) => ({ id, label, decisionType })),
}));

export const syntheticDomain = {
  payer: {
    id: "northstar-health-plan",
    name: "Northstar Health Plan",
  },
  plans: [
    { id: "gold-plus", name: "Northstar Gold Plus", metal: "Gold", network: "Premier PPO" },
    { id: "silver-select", name: "Northstar Silver Select", metal: "Silver", network: "Value HMO" },
    { id: "bronze-saver", name: "Northstar Bronze Saver", metal: "Bronze", network: "Open Access EPO" },
  ],
  members: [
    { id: "M-1001", name: "Jane Carter", planId: "gold-plus" },
    { id: "M-1002", name: "Luis Ramirez", planId: "silver-select" },
    { id: "M-1003", name: "Ava Brooks", planId: "bronze-saver" },
    { id: "M-1004", name: "Noah Kim", planId: "gold-plus" },
    { id: "M-1005", name: "Sophia Nguyen", planId: "silver-select" },
    { id: "M-1006", name: "Mason Patel", planId: "gold-plus" },
    { id: "M-1007", name: "Mia Turner", planId: "bronze-saver" },
    { id: "M-1008", name: "Ethan Scott", planId: "gold-plus" },
    { id: "M-1009", name: "Olivia Hall", planId: "silver-select" },
    { id: "M-1010", name: "Leo Green", planId: "bronze-saver" },
  ],
  providers: [
    { id: "P-201", name: "Northstar Orthopedics", specialty: "Orthopedics", networkStatus: "in_network" },
    { id: "P-202", name: "Harbor Imaging Center", specialty: "Diagnostic Imaging", networkStatus: "in_network" },
    { id: "P-203", name: "Summit Family Medicine", specialty: "Primary Care", networkStatus: "in_network" },
    { id: "P-204", name: "Blue Valley Dermatology", specialty: "Dermatology", networkStatus: "in_network" },
    { id: "P-205", name: "Riverside Surgical Group", specialty: "General Surgery", networkStatus: "out_of_network" },
    { id: "P-206", name: "Pine Street PT", specialty: "Physical Therapy", networkStatus: "in_network" },
  ],
  claims: [
    { id: "CL-3001", memberId: "M-1001", status: "pending" },
    { id: "CL-3002", memberId: "M-1002", status: "rejected" },
    { id: "CL-3003", memberId: "M-1003", status: "denied" },
    { id: "CL-3004", memberId: "M-1004", status: "denied" },
    { id: "CL-3005", memberId: "M-1002", status: "pended" },
    { id: "CL-3006", memberId: "M-1006", status: "pending" },
    { id: "CL-3007", memberId: "M-1007", status: "paid" },
    { id: "CL-3008", memberId: "M-1005", status: "rejected" },
    { id: "CL-3009", memberId: "M-1009", status: "pending" },
    { id: "CL-3010", memberId: "M-1010", status: "pended" },
  ],
  policies: [
    {
      policyId: "MRI-KNEE-2026",
      version: 7,
      serviceCode: "MRI_KNEE",
      serviceLabel: "MRI — Knee",
      covered: true,
      priorAuthorization: true,
      criteria: [
        { id: "C1", description: "Eligible member", required: true },
        { id: "C2", description: "Qualifying diagnosis", required: true },
        { id: "C3", description: "Conservative treatment for at least 6 weeks", required: true },
        { id: "C4", description: "In-network ordering provider", required: true },
      ],
    },
    {
      policyId: "PT-LOW-BACK-2026",
      version: 3,
      serviceCode: "PHYSICAL_THERAPY",
      serviceLabel: "Physical Therapy",
      covered: true,
      priorAuthorization: false,
      criteria: [
        { id: "C1", description: "Eligible member", required: true },
        { id: "C2", description: "Musculoskeletal diagnosis", required: true },
      ],
    },
    {
      policyId: "DERM-COSMETIC-2026",
      version: 2,
      serviceCode: "COSMETIC_DERM",
      serviceLabel: "Cosmetic Dermatology",
      covered: false,
      priorAuthorization: false,
      exclusionReason: "Cosmetic services are excluded from all Northstar plans.",
      criteria: [],
    },
    {
      policyId: "CT-ABD-2026",
      version: 5,
      serviceCode: "CT_ABDOMEN",
      serviceLabel: "CT Abdomen",
      covered: true,
      priorAuthorization: true,
      criteria: [
        { id: "C1", description: "Eligible member", required: true },
        { id: "C2", description: "Acute abdominal symptoms documented", required: true },
      ],
    },
    {
      policyId: "COLONOSCOPY-2026",
      version: 4,
      serviceCode: "COLONOSCOPY",
      serviceLabel: "Colonoscopy",
      covered: true,
      priorAuthorization: false,
      criteria: [{ id: "C1", description: "Eligible member", required: true }],
    },
    {
      policyId: "DME-BRACE-2026",
      version: 1,
      serviceCode: "KNEE_BRACE",
      serviceLabel: "Knee Brace",
      covered: true,
      priorAuthorization: false,
      criteria: [{ id: "C1", description: "Eligible member", required: true }],
    },
    {
      policyId: "SURGERY-ARTHROSCOPY-2026",
      version: 6,
      serviceCode: "KNEE_ARTHROSCOPY",
      serviceLabel: "Knee Arthroscopy",
      covered: true,
      priorAuthorization: true,
      criteria: [
        { id: "C1", description: "Eligible member", required: true },
        { id: "C2", description: "Imaging supports mechanical symptoms", required: true },
      ],
    },
    {
      policyId: "ER-VISIT-2026",
      version: 8,
      serviceCode: "ER_VISIT",
      serviceLabel: "Emergency Department Visit",
      covered: true,
      priorAuthorization: false,
      criteria: [{ id: "C1", description: "Eligible member", required: true }],
    },
  ],
};

const scenarioBase = [
  {
    id: "scenario-a",
    title: "Scenario A — Covered",
    summary: "MRI is covered and all criteria are satisfied.",
    expectedOutcome: "covered",
    memberId: "M-1001",
    providerId: "P-201",
    claimId: "CL-3001",
    planId: "gold-plus",
    serviceDate: "2026-09-22",
    service: { code: "MRI_KNEE", label: "MRI — Knee", placeOfService: "Outpatient Imaging" },
    diagnosis: { code: "M23.201", label: "Derangement of meniscus due to old tear or injury, right knee" },
    policyId: "MRI-KNEE-2026",
    enrollment: { effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "active" },
    benefits: { deductibleMet: true, coinsurance: "10%", priorAuthRequired: true },
    clinical: {
      symptoms: "Persistent right knee locking and swelling",
      conservativeTreatmentWeeks: 8,
      priorTherapy: "Physical therapy and NSAIDs",
      documentationComplete: true,
    },
    claim: { status: "pending", rejectionReason: null, history: ["Initial ortho visit approved", "PT completed 8 weeks"] },
    priorAuthorization: { submitted: false, status: "required" },
    conflicts: [],
  },
  {
    id: "scenario-b",
    title: "Scenario B — Missing Evidence",
    summary: "MRI may be covered, but conservative treatment duration is missing.",
    expectedOutcome: "insufficient_evidence",
    memberId: "M-1002",
    providerId: "P-201",
    claimId: "CL-3005",
    planId: "silver-select",
    serviceDate: "2026-09-25",
    service: { code: "MRI_KNEE", label: "MRI — Knee", placeOfService: "Outpatient Imaging" },
    diagnosis: { code: "M23.221", label: "Derangement of posterior horn of medial meniscus" },
    policyId: "MRI-KNEE-2026",
    enrollment: { effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "active" },
    benefits: { deductibleMet: false, coinsurance: "20%", priorAuthRequired: true },
    clinical: {
      symptoms: "Right knee pain after injury",
      conservativeTreatmentWeeks: null,
      priorTherapy: "Home exercise documented, duration omitted",
      documentationComplete: false,
    },
    claim: { status: "pended", rejectionReason: "Documentation missing treatment duration", history: ["Request pended for review"] },
    priorAuthorization: { submitted: true, status: "pending" },
    conflicts: [],
  },
  {
    id: "scenario-c",
    title: "Scenario C — Not Covered",
    summary: "Service is explicitly excluded from plan benefits.",
    expectedOutcome: "not_covered",
    memberId: "M-1003",
    providerId: "P-204",
    claimId: "CL-3003",
    planId: "bronze-saver",
    serviceDate: "2026-10-03",
    service: { code: "COSMETIC_DERM", label: "Cosmetic dermatology consultation", placeOfService: "Office" },
    diagnosis: { code: "L98.8", label: "Other specified disorders of skin" },
    policyId: "DERM-COSMETIC-2026",
    enrollment: { effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "active" },
    benefits: { deductibleMet: false, coinsurance: "40%", priorAuthRequired: false },
    clinical: {
      symptoms: "Elective cosmetic consultation",
      conservativeTreatmentWeeks: null,
      priorTherapy: null,
      documentationComplete: true,
    },
    claim: { status: "denied", rejectionReason: "Cosmetic service exclusion", history: ["Benefit exclusion applied"] },
    priorAuthorization: { submitted: false, status: "not_required" },
    conflicts: [],
  },
  {
    id: "scenario-d",
    title: "Scenario D — Eligibility",
    summary: "Member enrollment ended before the date of service.",
    expectedOutcome: "not_eligible",
    memberId: "M-1004",
    providerId: "P-203",
    claimId: "CL-3004",
    planId: "gold-plus",
    serviceDate: "2026-07-15",
    service: { code: "ER_VISIT", label: "Emergency department visit", placeOfService: "Emergency Department" },
    diagnosis: { code: "R10.9", label: "Unspecified abdominal pain" },
    policyId: "ER-VISIT-2026",
    enrollment: { effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30", status: "terminated" },
    benefits: { deductibleMet: true, coinsurance: "10%", priorAuthRequired: false },
    clinical: {
      symptoms: "Abdominal pain evaluated in ED",
      conservativeTreatmentWeeks: null,
      priorTherapy: null,
      documentationComplete: true,
    },
    claim: { status: "denied", rejectionReason: "Coverage inactive on service date", history: ["Enrollment ended 2026-06-30"] },
    priorAuthorization: { submitted: false, status: "not_required" },
    conflicts: [],
  },
  {
    id: "scenario-e",
    title: "Scenario E — Ambiguous",
    summary: "Conflicting evidence makes the case uncertain and suitable for human review.",
    expectedOutcome: "uncertain",
    memberId: "M-1005",
    providerId: "P-205",
    claimId: "CL-3008",
    planId: "silver-select",
    serviceDate: "2026-09-18",
    service: { code: "CT_ABDOMEN", label: "CT Abdomen", placeOfService: "Hospital Outpatient" },
    diagnosis: { code: "R10.84", label: "Generalized abdominal pain" },
    policyId: "CT-ABD-2026",
    enrollment: { effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "active" },
    benefits: { deductibleMet: true, coinsurance: "20%", priorAuthRequired: true },
    clinical: {
      symptoms: "Acute abdominal pain noted, but chart and claim disagree on ordering provider",
      conservativeTreatmentWeeks: null,
      priorTherapy: null,
      documentationComplete: true,
    },
    claim: { status: "rejected", rejectionReason: "Ordering provider conflict", history: ["Provider NPI mismatch", "Manual review recommended"] },
    priorAuthorization: { submitted: true, status: "approved_pending_validation" },
    conflicts: ["Ordering provider on claim differs from clinical note", "Network status varies across supplied documents"],
  },
];

const perspectiveContextBuilders = {
  provider(scenario, related) {
    return {
      conflicts: scenario.conflicts,
      member: related.member,
      plan: related.plan,
      provider: related.provider,
      service: scenario.service,
      diagnosis: scenario.diagnosis,
      serviceDate: scenario.serviceDate,
      placeOfService: scenario.service.placeOfService,
      clinicalDocumentation: {
        symptoms: scenario.clinical.symptoms,
        priorTherapy: scenario.clinical.priorTherapy,
        conservativeTreatmentWeeks: scenario.clinical.conservativeTreatmentWeeks,
        documentationComplete: scenario.clinical.documentationComplete,
      },
      priorAuthorization: scenario.priorAuthorization,
    };
  },
  member(scenario, related) {
    return {
      conflicts: scenario.conflicts,
      member: { id: related.member.id, name: related.member.name },
      plan: { id: related.plan.id, name: related.plan.name, network: related.plan.network },
      service: { code: scenario.service.code, label: scenario.service.label },
      serviceDate: scenario.serviceDate,
      benefits: scenario.benefits,
      claim: {
        id: related.claim.id,
        status: related.claim.status,
        rejectionReason: related.claim.rejectionReason,
      },
      priorAuthorization: { status: scenario.priorAuthorization.status },
    };
  },
  "prior-auth"(scenario, related) {
    return {
      conflicts: scenario.conflicts,
      request: { requestId: `PA-${scenario.id.toUpperCase()}`, submitted: scenario.priorAuthorization.submitted },
      member: related.member,
      plan: related.plan,
      provider: related.provider,
      service: scenario.service,
      diagnosis: scenario.diagnosis,
      clinicalEvidence: {
        symptoms: scenario.clinical.symptoms,
        priorTherapy: scenario.clinical.priorTherapy,
        conservativeTreatmentWeeks: scenario.clinical.conservativeTreatmentWeeks,
      },
      claimHistory: scenario.claim.history,
      serviceDate: scenario.serviceDate,
    };
  },
  "customer-service"(scenario, related) {
    return {
      conflicts: scenario.conflicts,
      member: { id: related.member.id, name: related.member.name },
      plan: { id: related.plan.id, name: related.plan.name },
      claim: related.claim,
      benefits: scenario.benefits,
      service: scenario.service,
      serviceDate: scenario.serviceDate,
      policySummary: {
        policyId: related.policy.policyId,
        covered: related.policy.covered,
        priorAuthorization: related.policy.priorAuthorization,
      },
      relevantHistory: scenario.claim.history,
    };
  },
  enrollment(scenario, related) {
    return {
      member: related.member,
      plan: related.plan,
      enrollmentRecord: scenario.enrollment,
      serviceDate: scenario.serviceDate,
      eligibilityEvidence: {
        status: scenario.enrollment.status,
        effectiveFrom: scenario.enrollment.effectiveFrom,
        effectiveTo: scenario.enrollment.effectiveTo,
      },
      conflicts: scenario.conflicts,
    };
  },
};

function createEvidence(scenario, related) {
  return [
    {
      id: `${scenario.policyId}-policy`,
      kind: "policy",
      label: `${related.policy.policyId} v${related.policy.version}`,
      detail: related.policy.covered
        ? `Coverage policy for ${related.policy.serviceLabel}`
        : related.policy.exclusionReason,
    },
    {
      id: `${scenario.memberId}-eligibility`,
      kind: "eligibility",
      label: "Member eligibility",
      detail: `${scenario.enrollment.status} ${scenario.enrollment.effectiveFrom} → ${scenario.enrollment.effectiveTo}`,
    },
    {
      id: `${scenario.id}-diagnosis`,
      kind: "diagnosis",
      label: "Diagnosis",
      detail: `${scenario.diagnosis.code} — ${scenario.diagnosis.label}`,
    },
    {
      id: `${scenario.id}-provider`,
      kind: "provider",
      label: "Provider",
      detail: `${related.provider.name} (${related.provider.specialty}, ${related.provider.networkStatus})`,
    },
    {
      id: `${scenario.id}-documentation`,
      kind: "clinical_note",
      label: "Clinical documentation",
      detail:
        scenario.clinical.conservativeTreatmentWeeks == null
          ? `${scenario.clinical.priorTherapy || "Clinical note supplied"}; duration not documented`
          : `${scenario.clinical.priorTherapy}; duration ${scenario.clinical.conservativeTreatmentWeeks} weeks`,
    },
    {
      id: `${scenario.claimId}-claim`,
      kind: "claim",
      label: "Claim record",
      detail: scenario.claim.rejectionReason || `Claim status: ${scenario.claim.status}`,
    },
    {
      id: `${scenario.id}-benefit`,
      kind: "benefit",
      label: "Benefit summary",
      detail: `Coinsurance ${scenario.benefits.coinsurance}; prior auth ${scenario.benefits.priorAuthRequired ? "required" : "not required"}`,
    },
    {
      id: `${scenario.id}-conflict`,
      kind: "conflict",
      label: "Conflict check",
      detail: scenario.conflicts.length ? scenario.conflicts.join("; ") : "No conflicts identified",
    },
  ];
}

function buildOutputSchema(decisionType) {
  return {
    type: "object",
    required: ["decision", "status", "findings", "evidence", "explanation"],
    decisionType,
    properties: {
      decision: { type: "string" },
      status: { enum: ["determined", "uncertain", "insufficient_evidence"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      findings: { type: "array" },
      unmetCriteria: { type: "array" },
      evidence: { type: "array" },
      nextAction: { type: "string" },
      explanation: { type: "string" },
    },
  };
}

export const demoScenarios = scenarioBase.map((scenario) => {
  const member = syntheticDomain.members.find((item) => item.id === scenario.memberId);
  const provider = syntheticDomain.providers.find((item) => item.id === scenario.providerId);
  const plan = syntheticDomain.plans.find((item) => item.id === scenario.planId);
  const claim = syntheticDomain.claims.find((item) => item.id === scenario.claimId);
  const policy = syntheticDomain.policies.find((item) => item.policyId === scenario.policyId);
  const related = { member, provider, plan, claim: { ...claim, ...scenario.claim }, policy };
  const evidence = createEvidence(scenario, related);

  return {
    ...scenario,
    related,
    evidence,
  };
});

export function getScenarioById(scenarioId) {
  return demoScenarios.find((scenario) => scenario.id === scenarioId) || demoScenarios[0];
}

export function getPerspectiveById(perspectiveId) {
  return perspectives.find((item) => item.id === perspectiveId) || perspectives[0];
}

export function getQuestionById(perspectiveId, questionId) {
  const perspective = getPerspectiveById(perspectiveId);
  return perspective.questions.find((item) => item.id === questionId) || perspective.questions[0];
}

export function getRequestParts({ perspectiveId, questionId, scenarioId }) {
  const scenario = getScenarioById(scenarioId);
  const perspective = getPerspectiveById(perspectiveId);
  const question = getQuestionById(perspective.id, questionId);
  const context = perspectiveContextBuilders[perspective.id](scenario, scenario.related);
  const rules = {
    payer: syntheticDomain.payer,
    plan: scenario.related.plan,
    policy: scenario.related.policy,
    criteria: scenario.related.policy.criteria,
    requiredCriteria: scenario.related.policy.criteria.filter((item) => item.required !== false).map((item) => item.id),
    allowedDecisions: question.decisionType,
  };

  return {
    perspective,
    question,
    scenario,
    context,
    rules,
    evidence: scenario.evidence,
  };
}

export function buildDecisionRequest({ perspectiveId, questionId, scenarioId }) {
  const { perspective, question, scenario, context, rules, evidence } = getRequestParts({
    perspectiveId,
    questionId,
    scenarioId,
  });

  return {
    decision: {
      type: question.decisionType,
      question: question.label,
      perspective: perspective.label,
      outputSchema: buildOutputSchema(question.decisionType),
    },
    context,
    rules,
    evidence,
    constraints: {
      useSyntheticDataOnly: true,
      noHiddenState: true,
      sameModelDemonstration: true,
      scenarioId: scenario.id,
    },
  };
}
