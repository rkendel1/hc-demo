export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const positiveDecisions = new Set([
  "covered",
  "eligible",
  "not_required",
  "criteria_met",
  "complete",
  "can_submit",
  "claim_approved",
  "sufficient",
  "no_conflict",
  "review_not_required",
  "proceed",
  "northstar_gold_plus",
  "northstar_silver_select",
  "northstar_bronze_saver",
]);

const negativeDecisions = new Set([
  "not_covered",
  "not_eligible",
  "criteria_unmet",
  "incomplete",
  "cannot_submit",
  "claim_denied",
  "insufficient",
  "no_applicable_plan",
]);

const pendingDecisions = new Set([
  "required",
  "pending_information",
  "claim_pending",
  "insufficient_evidence",
  "submit_prior_authorization",
  "request_information",
  "contact_enrollment_support",
  "discuss_alternatives",
]);
const reviewDecisions = new Set(["human_review", "review_required", "uncertain", "conflict_found"]);

const questionSpecificLabels = {
  "provider-missing-information": { complete: "NO INFORMATION MISSING", incomplete: "INFORMATION MISSING" },
};

export function formatDecisionLabel(decision, status = "", questionId = "") {
  if (status === "insufficient_evidence") return "INSUFFICIENT EVIDENCE";
  return questionSpecificLabels[questionId]?.[decision] || String(decision).replaceAll("_", " ").toUpperCase();
}

export function getDecisionTone(decision, status = "") {
  if (status === "insufficient_evidence") return "warning";
  if (status === "uncertain") return "review";
  if (positiveDecisions.has(decision)) return "positive";
  if (negativeDecisions.has(decision)) return "negative";
  if (pendingDecisions.has(decision)) return "warning";
  if (reviewDecisions.has(decision)) return "review";
  return "neutral";
}

export function parseDecisionPayload(response, payload) {
  if (!response.ok) {
    const message =
      (payload && typeof payload.error === "string" && payload.error) ||
      `Decision request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Decision service returned an invalid response.");
  }

  if (typeof payload.decision !== "string" || typeof payload.status !== "string" || typeof payload.explanation !== "string") {
    throw new Error("Decision service returned an invalid response.");
  }

  return payload;
}

export function parseConfigPayload(response, payload) {
  if (!response.ok) {
    throw new Error(`Configuration request failed with status ${response.status}.`);
  }

  if (!payload || typeof payload.modelName !== "string" || typeof payload.provider !== "string") {
    throw new Error("Configuration response is invalid.");
  }

  return payload;
}
