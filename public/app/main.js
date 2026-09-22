import { buildDecisionRequest, demoScenarios, getPerspectiveById, getRequestParts, perspectives } from "./catalog.js";

const state = {
  config: null,
  perspectiveId: perspectives[0].id,
  questionId: perspectives[0].questions[0].id,
  scenarioId: demoScenarios[0].id,
  result: null,
  compareResults: [],
};

const elements = {
  inferenceBadge: document.querySelector("[data-model-badge]"),
  perspectiveGrid: document.querySelector("[data-perspective-grid]"),
  questionList: document.querySelector("[data-question-list]"),
  scenarioSelect: document.querySelector("[data-scenario-select]"),
  caseSummary: document.querySelector("[data-case-summary]"),
  contextView: document.querySelector("[data-context-view]"),
  rulesView: document.querySelector("[data-rules-view]"),
  evidenceView: document.querySelector("[data-evidence-view]"),
  requestView: document.querySelector("[data-request-view]"),
  resultView: document.querySelector("[data-result-view]"),
  runDecision: document.querySelector("[data-run-decision]"),
  copyRequest: document.querySelector("[data-copy-request]"),
  compareRun: document.querySelector("[data-run-compare]"),
  compareView: document.querySelector("[data-compare-view]"),
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

function renderPerspectiveCards() {
  elements.perspectiveGrid.innerHTML = perspectives
    .map(
      (perspective) => `
        <button class="selector-card ${perspective.id === state.perspectiveId ? "active" : ""}" data-perspective="${perspective.id}">
          <strong>${perspective.label}</strong>
          <span>${perspective.summary}</span>
        </button>
      `,
    )
    .join("");

  elements.perspectiveGrid.querySelectorAll("[data-perspective]").forEach((button) => {
    button.addEventListener("click", () => {
      state.perspectiveId = button.dataset.perspective;
      state.questionId = getPerspectiveById(state.perspectiveId).questions[0].id;
      state.result = null;
      render();
    });
  });
}

function renderQuestions() {
  const perspective = selectedPerspective();
  elements.questionList.innerHTML = perspective.questions
    .map(
      (question) => `
        <button class="question-chip ${question.id === state.questionId ? "active" : ""}" data-question="${question.id}">
          ${question.label}
        </button>
      `,
    )
    .join("");

  elements.questionList.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      state.questionId = button.dataset.question;
      state.result = null;
      render();
    });
  });
}

function renderScenarioSelect() {
  elements.scenarioSelect.innerHTML = demoScenarios
    .map(
      (scenario) => `
        <option value="${scenario.id}" ${scenario.id === state.scenarioId ? "selected" : ""}>
          ${scenario.title}
        </option>
      `,
    )
    .join("");

  elements.scenarioSelect.onchange = () => {
    state.scenarioId = elements.scenarioSelect.value;
    state.result = null;
    render();
  };
}

function renderCaseSummary() {
  const { scenario } = getRequestParts({
    perspectiveId: state.perspectiveId,
    questionId: state.questionId,
    scenarioId: state.scenarioId,
  });

  elements.caseSummary.innerHTML = `
    <div class="case-header">
      <div>
        <p class="eyebrow">CASE</p>
        <h3>${scenario.title}</h3>
        <p>${scenario.summary}</p>
      </div>
      <div class="status-pill">${scenario.expectedOutcome.replaceAll("_", " ")}</div>
    </div>
    <div class="key-grid">
      <div><span>Member</span><strong>${scenario.related.member.name}</strong></div>
      <div><span>Plan</span><strong>${scenario.related.plan.name}</strong></div>
      <div><span>Service</span><strong>${scenario.service.label}</strong></div>
      <div><span>Diagnosis</span><strong>${scenario.diagnosis.code}</strong></div>
      <div><span>Provider</span><strong>${scenario.related.provider.name}</strong></div>
      <div><span>Date</span><strong>${scenario.serviceDate}</strong></div>
    </div>
  `;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function renderInspectors() {
  const parts = getRequestParts({
    perspectiveId: state.perspectiveId,
    questionId: state.questionId,
    scenarioId: state.scenarioId,
  });
  const request = selectedRequest();
  elements.contextView.textContent = prettyJson(parts.context);
  elements.rulesView.textContent = prettyJson(parts.rules);
  elements.evidenceView.textContent = prettyJson(parts.evidence);
  elements.requestView.textContent = prettyJson(request);
}

function renderResult() {
  if (!state.result) {
    elements.resultView.innerHTML = `
      <div class="empty-state">
        <strong>No decision run yet</strong>
        <p>Select a perspective, inspect the self-contained request, then run the decision.</p>
      </div>
    `;
    return;
  }

  const result = state.result;
  elements.resultView.innerHTML = `
    <div class="decision-banner decision-${result.status}">
      <div>
        <p class="eyebrow">Decision Result</p>
        <h3>${result.decision.replaceAll("_", " ").toUpperCase()}</h3>
        <p>${result.explanation}</p>
      </div>
      <div class="banner-meta">
        <span>Status: ${result.status.replaceAll("_", " ")}</span>
        <span>Confidence: ${result.confidence ?? "n/a"}</span>
      </div>
    </div>
    <div class="result-section">
      <h4>Criteria</h4>
      <ul class="criteria-list">
        ${result.findings
          .map(
            (item) => `
              <li>
                <strong>${item.criterion}</strong>
                <span>${item.result.replaceAll("_", " ")}</span>
                ${item.detail ? `<small>${item.detail}</small>` : ""}
              </li>
            `,
          )
          .join("")}
      </ul>
    </div>
    <div class="result-section">
      <h4>Evidence</h4>
      <ul class="evidence-list">
        ${result.evidence
          .map((id) => {
            const item = getRequestParts({
              perspectiveId: state.perspectiveId,
              questionId: state.questionId,
              scenarioId: state.scenarioId,
            }).evidence.find((entry) => entry.id === id);
            return item ? `<li><strong>${item.label}</strong><span>${item.detail}</span></li>` : "";
          })
          .join("")}
      </ul>
    </div>
    ${
      result.unmetCriteria.length
        ? `
        <div class="result-section">
          <h4>Missing information</h4>
          <ul class="criteria-list">
            ${result.unmetCriteria
              .map(
                (item) => `
                  <li>
                    <strong>${item.criterion}</strong>
                    <span>${(item.missingEvidence || []).join(", ") || "Additional documentation required"}</span>
                  </li>
                `,
              )
              .join("")}
          </ul>
        </div>
      `
        : ""
    }
    <div class="result-section">
      <h4>Next action</h4>
      <p>${result.nextAction}</p>
    </div>
  `;
}

async function fetchConfig() {
  const response = await fetch("/api/config");
  state.config = await response.json();
  elements.inferenceBadge.textContent = `Inference: ${state.config.modelName} (${state.config.provider})`;
}

async function runDecision() {
  const request = selectedRequest();
  const response = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });
  state.result = await response.json();
  renderResult();
}

async function runCompare() {
  const comparePerspectives = ["provider", "member", "customer-service"];
  const coverageQuestion = {
    provider: "provider-coverage",
    member: "member-coverage",
    "customer-service": "cs-coverage",
  };

  const responses = await Promise.all(
    comparePerspectives.map(async (perspectiveId) => {
      const request = buildDecisionRequest({
        perspectiveId,
        questionId: coverageQuestion[perspectiveId],
        scenarioId: state.scenarioId,
      });
      const response = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      return {
        perspective: getPerspectiveById(perspectiveId),
        request,
        result: await response.json(),
      };
    }),
  );

  state.compareResults = responses;
  renderCompare();
}

function renderCompare() {
  if (!state.compareResults.length) {
    elements.compareView.innerHTML = `
      <div class="empty-state">
        <strong>ONE MODEL · 3 perspectives · 3 decision contexts</strong>
        <p>Run the compare demo to show how the same question changes when the context changes.</p>
      </div>
    `;
    return;
  }

  elements.compareView.innerHTML = `
    <div class="compare-header">
      <div>
        <p class="eyebrow">JEV INFERENCE</p>
        <h3>ONE MODEL · 3 perspectives · 3 decision contexts</h3>
      </div>
      <div class="status-pill">${state.config.modelName}</div>
    </div>
    <div class="compare-grid">
      ${state.compareResults
        .map(
          ({ perspective, request, result }) => `
            <article class="compare-card">
              <h4>${perspective.label}</h4>
              <p class="compare-subtitle">Same question, perspective-specific context</p>
              <pre>${prettyJson(request.context)}</pre>
              <div class="compare-outcome">
                <strong>${result.decision.replaceAll("_", " ")}</strong>
                <span>${result.status.replaceAll("_", " ")}</span>
              </div>
              <p>${result.explanation}</p>
              <small>Next action: ${result.nextAction}</small>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

async function copyRequest() {
  await navigator.clipboard.writeText(prettyJson(selectedRequest()));
  elements.copyRequest.textContent = "Copied";
  window.setTimeout(() => {
    elements.copyRequest.textContent = "Copy Request";
  }, 1200);
}

function render() {
  renderPerspectiveCards();
  renderQuestions();
  renderScenarioSelect();
  renderCaseSummary();
  renderInspectors();
  renderResult();
  renderCompare();
}

elements.runDecision.addEventListener("click", runDecision);
elements.copyRequest.addEventListener("click", copyRequest);
elements.compareRun.addEventListener("click", runCompare);

fetchConfig().then(render);
