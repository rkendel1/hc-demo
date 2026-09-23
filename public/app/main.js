import { buildDecisionRequest, demoScenarios, getPerspectiveById, getQuestionsByDecisionType, getRequestParts, perspectives } from "./catalog.js";
import { escapeHtml, formatDecisionLabel, getDecisionTone, parseConfigPayload, parseDecisionPayload } from "./client-utils.js";
import { prepareLayaRequest } from "./context-preparation.js";

const state = {
  config: null,
  perspectiveId: perspectives[0].id,
  questionId: perspectives[0].questions[0].id,
  scenarioId: demoScenarios[0].id,
  result: null,
  resultError: "",
  isRunning: false,
  runtimeReady: false,
};

const elements = {
  runtimePanel: document.querySelector("[data-runtime-panel]"),
  perspectiveSelect: document.querySelector("[data-perspective-select]"),
  questionSelect: document.querySelector("[data-question-select]"),
  scenarioSelect: document.querySelector("[data-scenario-select]"),
  caseSummary: document.querySelector("[data-case-summary]"),
  selectedContext: document.querySelector("[data-selected-context]"),
  requestView: document.querySelector("[data-request-view]"),
  responseView: document.querySelector("[data-response-view]"),
  resultPanel: document.querySelector(".result-panel"),
  resultView: document.querySelector("[data-result-view]"),
  runDecision: document.querySelector("[data-run-decision]"),
  runLabel: document.querySelector("[data-run-label]"),
  copyRequest: document.querySelector("[data-copy-request]"),
  runCompare: document.querySelector("[data-run-compare]"),
  compareDialog: document.querySelector("[data-compare-dialog]"),
  closeCompare: document.querySelector("[data-close-compare]"),
  compareTitle: document.querySelector("[data-compare-title]"),
  compareRuntime: document.querySelector("[data-compare-runtime]"),
  compareView: document.querySelector("[data-compare-view]"),
  openTrace: document.querySelector("[data-open-trace]"),
  traceDialog: document.querySelector("[data-trace-dialog]"),
  closeTrace: document.querySelector("[data-close-trace]"),
  traceMeta: document.querySelector("[data-trace-meta]"),
  copyTraceRequest: document.querySelector("[data-copy-trace-request]"),
  copyTraceResponse: document.querySelector("[data-copy-trace-response]"),
  resetTraceRequest: document.querySelector("[data-reset-trace-request]"),
  runTrace: document.querySelector("[data-run-trace]"),
};

function selectedPerspective() {
  return getPerspectiveById(state.perspectiveId);
}

function selectedQuestion() {
  const perspective = selectedPerspective();
  return perspective.questions.find((item) => item.id === state.questionId) || perspective.questions[0];
}

function selectedRequest() {
  return buildDecisionRequest({
    perspectiveId: state.perspectiveId,
    questionId: state.questionId,
    scenarioId: state.scenarioId,
  });
}

function comparisonSelections() {
  return getQuestionsByDecisionType(selectedQuestion().decisionType)
    .map(({ perspective, question }) => [perspective.id, question.id]);
}

function resetDecision() {
  state.result = null;
  state.resultError = "";
}

function renderSelectors() {
  elements.perspectiveSelect.innerHTML = perspectives
    .map((item) => `<option value="${item.id}" ${item.id === state.perspectiveId ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");

  elements.questionSelect.innerHTML = selectedPerspective().questions
    .map((item) => `<option value="${item.id}" ${item.id === state.questionId ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");

  elements.scenarioSelect.innerHTML = demoScenarios
    .map((item) => `<option value="${item.id}" ${item.id === state.scenarioId ? "selected" : ""}>${escapeHtml(item.title)}</option>`)
    .join("");

  const comparisonCount = comparisonSelections().length;
  elements.runCompare.hidden = comparisonCount < 2;
  elements.runCompare.textContent = `Compare across ${comparisonCount} perspectives`;
}

function renderCaseSummary() {
  const { scenario } = getRequestParts({
    perspectiveId: state.perspectiveId,
    questionId: state.questionId,
    scenarioId: state.scenarioId,
  });

  elements.caseSummary.innerHTML = `
    <div class="case-header">
      <div><h3>${escapeHtml(scenario.title)}</h3><p>${escapeHtml(scenario.summary)}</p></div>
      <span class="status-pill case-outcome outcome-neutral">Synthetic case</span>
    </div>
    <div class="key-grid">
      <div title="${escapeHtml(scenario.related.member.name)}"><span>Member</span><strong>${escapeHtml(scenario.related.member.name)}</strong></div>
      <div title="${escapeHtml(scenario.related.plan.name)}"><span>Plan on record</span><strong>${escapeHtml(scenario.related.plan.name)}</strong></div>
      <div title="${escapeHtml(scenario.service.label)}"><span>Service</span><strong>${escapeHtml(scenario.service.label)}</strong></div>
      <div title="${escapeHtml(scenario.diagnosis.code)}"><span>Diagnosis</span><strong>${escapeHtml(scenario.diagnosis.code)}</strong></div>
      <div title="${escapeHtml(scenario.related.provider.name)}"><span>Provider</span><strong>${escapeHtml(scenario.related.provider.name)}</strong></div>
      <div title="${escapeHtml(scenario.serviceDate)}"><span>Date</span><strong>${escapeHtml(scenario.serviceDate)}</strong></div>
    </div>`;

  elements.selectedContext.innerHTML = `<strong>${escapeHtml(selectedPerspective().label)} · ${escapeHtml(scenario.title)}</strong>${escapeHtml(selectedQuestion().label)}`;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatProbability(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function formatLatency(latency) {
  if (!latency) return "n/a";
  return `${((latency.secs || 0) * 1000 + (latency.nanos || 0) / 1e6).toFixed(0)} ms`;
}

function renderInspectors(preserveRequest = false) {
  if (!preserveRequest) elements.requestView.value = prettyJson(prepareLayaRequest(selectedRequest()).runtimeRequest);
  elements.responseView.textContent = state.result?.inferenceResponse
    ? prettyJson(state.result.inferenceResponse)
    : "Execute the decision to see the raw local runtime response.";
  elements.copyTraceResponse.disabled = !state.result?.inferenceResponse;
}

function renderResult() {
  elements.resultPanel.setAttribute("aria-busy", String(state.isRunning));
  elements.runDecision.disabled = state.isRunning || !state.runtimeReady;
  elements.runCompare.disabled = state.isRunning || !state.runtimeReady || comparisonSelections().length < 2;
  elements.runTrace.disabled = state.isRunning || !state.runtimeReady;
  elements.runLabel.textContent = state.isRunning ? "Executing…" : state.runtimeReady ? "Execute decision" : "Loading Laya…";

  if (state.isRunning) {
    elements.resultView.innerHTML = `<div class="empty-state"><div class="empty-icon">•••</div><strong>Evaluating decision</strong><p>Jev is applying the selected question to this scenario.</p></div>`;
    return;
  }

  if (state.resultError) {
    elements.resultView.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><strong>Decision unavailable</strong><p>${escapeHtml(state.resultError)}</p></div>`;
    return;
  }

  if (!state.result) {
    elements.resultView.innerHTML = `<div class="empty-state"><div class="empty-icon">→</div><strong>Ready to evaluate</strong><p>Choose a perspective, question, and demo scenario, then execute. The decision and explanation will appear here without leaving this view.</p></div>`;
    return;
  }

  const result = state.result;
  const { evidence } = getRequestParts({
    perspectiveId: state.perspectiveId,
    questionId: state.questionId,
    scenarioId: state.scenarioId,
  });
  const evidenceLookup = new Map(evidence.map((item) => [item.id, item]));
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const citedEvidence = Array.isArray(result.evidence) ? result.evidence : [];
  const unmetCriteria = Array.isArray(result.unmetCriteria) ? result.unmetCriteria : [];
  const decisionLabel = formatDecisionLabel(result.decision, result.status, state.questionId);
  const modelDecision = result.modelDecision || {};
  const modelResponse = result.inferenceResponse || {};
  const probabilities = Object.entries(modelDecision.probabilities || {}).sort((left, right) => right[1] - left[1]);
  const selectedValue = modelDecision.value?.value;
  const selectedProbabilityLabel = modelDecision.value?.type === "score" ? String(Math.round(selectedValue)) : String(selectedValue);
  const execution = modelResponse.execution || {};
  const provenance = modelResponse.provenance || {};
  const resolution = result.resolution || {};

  elements.resultView.innerHTML = `
    <div class="decision-output">
      <div class="decision-banner outcome-${getDecisionTone(result.decision, result.status)}">
        <div><p class="eyebrow">Decision</p><h3>${escapeHtml(decisionLabel)}</h3></div>
        <div class="banner-meta"><span>${escapeHtml(result.status.replaceAll("_", " "))}</span><span>Confidence: ${formatProbability(result.confidence)}</span></div>
      </div>
      <section class="explanation-card">
        <h4>Why this decision</h4>
        <p>${escapeHtml(result.explanation)}</p>
        <p class="next-action"><strong>Next action:</strong> ${escapeHtml(result.nextAction)}</p>
      </section>
      <section class="model-output-card">
        <div class="model-output-heading">
          <div>
            <span class="model-kicker">${resolution.constrained ? "Rules-constrained model execution" : "Advisory model recommendation"}</span>
            <strong>${escapeHtml(formatDecisionLabel(resolution.modelSuggestion || selectedValue || result.decision))}</strong>
            ${resolution.modelOverridden
              ? `<span class="model-disposition rejected">Not applied</span><small class="override-label"><b>Final determination: ${escapeHtml(decisionLabel)}</b>${escapeHtml(resolution.reason || result.explanation)}</small>`
              : `<span class="model-disposition accepted">Applied</span><small class="agreement-label">${resolution.constrained ? "Only outcome admitted by deterministic evidence gates" : "Matches the final determination"}</small>`}
          </div>
          <span class="model-kind">${escapeHtml(modelDecision.kind || "typed decision")}</span>
        </div>
        <div class="model-probabilities">
          <span class="model-kicker">${resolution.constrained ? "Admissible outcome distribution" : "Model probability distribution"}</span>
          <div class="probability-list">
            ${probabilities.map(([label, probability]) => `
              <div class="probability-item ${selectedProbabilityLabel === label ? "selected" : ""}">
                <div><span>${escapeHtml(label.replaceAll("_", " "))}</span><strong>${formatProbability(probability)}</strong></div>
                <div class="probability-track"><i style="width:${Math.max(0, Math.min(100, probability * 100))}%"></i></div>
              </div>`).join("")}
          </div>
        </div>
        <div class="model-metadata">
          <span>Action <strong>${formatProbability(modelDecision.action_probability)}</strong></span>
          <span>Latency <strong>${escapeHtml(formatLatency(execution.latency))}</strong></span>
          <span>Input <strong>${escapeHtml(execution.input_tokens ?? "n/a")} tokens</strong></span>
          <span>Output <strong>${escapeHtml(execution.output_tokens ?? "n/a")} tokens</strong></span>
          <span>Backend <strong>${escapeHtml(modelResponse.backend || "coreml")}</strong></span>
          <span>Runtime <strong>v${escapeHtml(provenance.runtimeVersion || "unknown")}</strong></span>
          <span>Model <strong>${escapeHtml(modelResponse.model?.identifier || "Laya")}</strong></span>
          <span>Revision <strong title="${escapeHtml(modelResponse.model?.revision || "")}">${escapeHtml((modelResponse.model?.revision || "unknown").slice(0, 8))}</strong></span>
          <span>Artifact <strong title="${escapeHtml(provenance.artifactSha256 || "")}">${escapeHtml((provenance.artifactSha256 || "unknown").slice(0, 8))}</strong></span>
        </div>
      </section>
      <div class="result-details">
        <section class="result-section">
          <h4>Criteria evaluated</h4>
          <ul class="criteria-list">
            ${findings.map((item) => `<li><strong>${escapeHtml(item.criterion)}</strong><span>${escapeHtml(item.result.replaceAll("_", " "))}</span>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ""}</li>`).join("") || "<li><span>No criteria returned.</span></li>"}
          </ul>
          ${unmetCriteria.length ? `<div class="missing-block"><h4>Missing information</h4><ul class="criteria-list">${unmetCriteria.map((item) => `<li><strong>${escapeHtml(item.criterion)}</strong><span>${escapeHtml((item.missingEvidence || []).join(", ") || "Additional documentation required")}</span></li>`).join("")}</ul></div>` : ""}
        </section>
        <section class="result-section">
          <h4>Evidence used</h4>
          <ul class="evidence-list">
            ${citedEvidence.map((id) => { const item = evidenceLookup.get(id); return item ? `<li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.detail)}</span></li>` : ""; }).join("") || "<li><span>No evidence cited.</span></li>"}
          </ul>
        </section>
      </div>
    </div>`;
}

function render() {
  renderSelectors();
  renderCaseSummary();
  renderInspectors();
  renderResult();
}

elements.perspectiveSelect.addEventListener("change", () => {
  state.perspectiveId = elements.perspectiveSelect.value;
  state.questionId = selectedPerspective().questions[0].id;
  resetDecision();
  render();
});

elements.questionSelect.addEventListener("change", () => {
  state.questionId = elements.questionSelect.value;
  resetDecision();
  render();
});

elements.scenarioSelect.addEventListener("change", () => {
  state.scenarioId = elements.scenarioSelect.value;
  resetDecision();
  render();
});

async function runDecision() {
  state.resultError = "";
  state.result = null;
  let inferenceRequestOverride;
  try {
    inferenceRequestOverride = JSON.parse(elements.requestView.value);
  } catch (error) {
    state.resultError = `Edited Laya request is invalid JSON: ${error.message}`;
    renderResult();
    return;
  }
  state.isRunning = true;
  renderResult();
  try {
    const response = await fetch("/api/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: selectedRequest(), inferenceRequestOverride }),
    });
    state.result = parseDecisionPayload(response, await response.json());
  } catch (error) {
    state.resultError = error.message || "Unable to run decision.";
  } finally {
    state.isRunning = false;
    renderResult();
    renderInspectors(true);
  }
}

elements.runDecision.addEventListener("click", runDecision);

elements.copyRequest.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.requestView.value);
    elements.copyRequest.textContent = "Copied";
    window.setTimeout(() => { elements.copyRequest.textContent = "Copy request"; }, 1200);
  } catch {
    elements.copyRequest.textContent = "Copy failed";
  }
});

async function runCompare() {
  const selections = comparisonSelections();
  if (selections.length < 2) return;
  elements.compareDialog.showModal();
  elements.compareTitle.textContent = `${selectedQuestion().label} · ${selections.length} perspectives`;
  elements.compareView.innerHTML = `<div class="empty-state"><div class="empty-icon">•••</div><strong>Running ${selections.length} local decisions</strong><p>The same decision type is being evaluated with each audience's context.</p></div>`;
  try {
    const results = await Promise.all(selections.map(async ([perspectiveId, questionId]) => {
      const request = buildDecisionRequest({ perspectiveId, questionId, scenarioId: state.scenarioId });
      const response = await fetch("/api/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request }) });
      return { perspective: getPerspectiveById(perspectiveId), questionId, request, result: parseDecisionPayload(response, await response.json()) };
    }));
    elements.compareView.innerHTML = `<div class="compare-grid">${results.map(({ perspective, questionId, request, result }) => {
      const prepared = prepareLayaRequest(request);
      const label = formatDecisionLabel(result.decision, result.status, questionId);
      return `<article class="compare-card"><h3>${escapeHtml(perspective.label)}</h3><p>Perspective-specific compact context</p><pre class="compare-context">${escapeHtml(prettyJson(prepared.runtimeRequest.state))}</pre><div class="compare-decision outcome-${getDecisionTone(result.decision, result.status)}">${escapeHtml(label)}</div><ul class="compare-evidence">${prepared.evidence.map((item) => `<li>${escapeHtml(item.label)}</li>`).join("")}</ul></article>`;
    }).join("")}</div>`;
  } catch (error) {
    elements.compareView.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><strong>Comparison unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

elements.runCompare.addEventListener("click", runCompare);
elements.closeCompare.addEventListener("click", () => elements.compareDialog.close());
elements.compareDialog.addEventListener("click", (event) => { if (event.target === elements.compareDialog) elements.compareDialog.close(); });
elements.openTrace.addEventListener("click", () => elements.traceDialog.showModal());
elements.closeTrace.addEventListener("click", () => elements.traceDialog.close());
elements.traceDialog.addEventListener("click", (event) => { if (event.target === elements.traceDialog) elements.traceDialog.close(); });
elements.runTrace.addEventListener("click", runDecision);
elements.resetTraceRequest.addEventListener("click", () => {
  elements.requestView.value = prettyJson(prepareLayaRequest(selectedRequest()).runtimeRequest);
});

async function copyTrace(button, value, defaultLabel) {
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  window.setTimeout(() => { button.textContent = defaultLabel; }, 1200);
}

elements.copyTraceRequest.addEventListener("click", () => copyTrace(elements.copyTraceRequest, elements.requestView.value, "Copy"));
elements.copyTraceResponse.addEventListener("click", () => copyTrace(elements.copyTraceResponse, elements.responseView.textContent, "Copy response"));

async function refreshRuntimeConfig() {
  try {
    const response = await fetch("/api/config");
    const config = parseConfigPayload(response, await response.json());
    state.config = config;
    state.runtimeReady = config.modelStatus === "Installed";
    const statusClass = state.runtimeReady ? "runtime-ready" : config.modelStatus === "Loading" ? "" : "runtime-error";
    elements.runtimePanel.innerHTML = `<span><small>Model</small><strong>${escapeHtml(config.modelName)}</strong></span><span><small>Runtime</small><strong>${escapeHtml(config.runtime || config.provider)}</strong></span><span><small>Execution</small><strong>${escapeHtml(config.execution || "Local")}</strong></span><span><small>Backend</small><strong>${escapeHtml(config.backend || "Core ML")}</strong></span><span><small>Status</small><strong class="${statusClass}">${escapeHtml(config.modelStatus || "Unknown")}</strong></span>`;
    elements.compareRuntime.innerHTML = `<strong>Model: ${escapeHtml(config.modelName)}</strong><span>Runtime: ${escapeHtml(config.runtime || config.provider)}</span><span>Execution: ${escapeHtml(config.execution || "Local")}</span><span>Backend: ${escapeHtml(config.backend || "Core ML")}</span>`;
    elements.traceMeta.innerHTML = `<span>Model: <strong>${escapeHtml(config.modelIdentifier || config.modelName)}</strong></span><span>Revision: <strong>${escapeHtml(config.modelRevision || "unknown")}</strong></span><span>Runtime: <strong>${escapeHtml(config.runtime || config.provider)}</strong></span><span>Execution: <strong>${escapeHtml(config.execution || "Local")}</strong></span><span>Backend: <strong>${escapeHtml(config.backend || "Core ML")}</strong></span><span>Status: <strong>${escapeHtml(config.modelStatus || "Unknown")}</strong></span>${config.artifactChecksum ? `<span>SHA-256: <strong>${escapeHtml(config.artifactChecksum.slice(0, 16))}…</strong></span>` : ""}`;
    if (config.modelStatus === "Unavailable") state.resultError = config.error || "Local Laya inference is unavailable.";
    renderResult();
    if (config.modelStatus === "Loading") window.setTimeout(refreshRuntimeConfig, 1000);
  } catch (error) {
    elements.runtimePanel.innerHTML = `<strong class="runtime-error">Local inference unavailable</strong>`;
    state.resultError = `Portal configuration unavailable: ${error.message || "Unknown error."}`;
    renderResult();
  }
}

render();
refreshRuntimeConfig();
