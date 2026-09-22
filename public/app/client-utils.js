export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
