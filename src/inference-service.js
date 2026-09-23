import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { evaluateDecisionRequest, getDecisionTypeDefinition, validateDecisionRequest, validateDecisionResult } from "../public/app/decision-engine.js";
import { interpretLayaDecision, prepareLayaRequest } from "../public/app/context-preparation.js";

const constrainedOutcomes = new Set([
  "not_covered",
  "not_eligible",
  "criteria_unmet",
  "incomplete",
  "cannot_submit",
  "claim_denied",
  "claim_pending",
  "insufficient",
  "request_information",
  "contact_enrollment_support",
  "discuss_alternatives",
  "submit_prior_authorization",
]);

const authoritativeDecisionTypes = new Set([
  "prior_authorization_required",
  "claim_completeness",
  "claim_submission",
  "claim_explanation",
  "eligibility",
  "enrollment_completion",
  "plan_selection",
  "conflict_check",
  "enrollment_review",
  "next_action",
]);

function nativeBindingPackage() {
  return `@rust-ml-runtime/node-${process.platform}-${process.arch}${process.platform === "linux" ? "-gnu" : process.platform === "win32" ? "-msvc" : ""}`;
}

function invalidOverride(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.expose = true;
  return error;
}

function validateInferenceOverride(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidOverride("Edited inference request must be a JSON object.");
  if (!value.state || typeof value.state !== "object" || Array.isArray(value.state)) throw invalidOverride("Edited inference request must include an object state.");
  if (!Array.isArray(value.decisions) || value.decisions.length !== 1) throw invalidOverride("Edited inference request must include exactly one decision.");
  const decision = value.decisions[0];
  if (!decision || typeof decision.name !== "string" || typeof decision.instructions !== "string" || !decision.kind) {
    throw invalidOverride("Edited inference decision must include name, instructions, and kind.");
  }
  if (decision.kind.type !== expected.decisions[0].kind.type) {
    throw invalidOverride(`Edited inference decision must retain the ${expected.decisions[0].kind.type} form.`);
  }
  if (JSON.stringify(value).length > 65_536) throw invalidOverride("Edited inference request exceeds the 64 KB demonstration limit.");
  return value;
}

function runtimeUnavailable(error) {
  const wrapped = new Error(`Local Laya inference unavailable: ${error.message || error}`);
  wrapped.statusCode = 503;
  wrapped.expose = true;
  return wrapped;
}

export class RustMlRuntimeInference {
  constructor({ modelRoot } = {}) {
    this.description = null;
    this.error = null;
    this.status = "Loading";
    this.nextId = 1;
    this.pending = new Map();
    this.readyPromise = new Promise((resolveReady, rejectReady) => {
      this.resolveReady = resolveReady;
      this.rejectReady = rejectReady;
    });
    this.worker = new Worker(new URL("./runtime-worker.js", import.meta.url), { workerData: { modelRoot } });
    this.worker.on("message", (message) => this.handleMessage(message));
    this.worker.on("error", (error) => this.fail(error));
    this.worker.on("exit", (code) => {
      if (code !== 0 && this.status !== "Unavailable") this.fail(new Error(`runtime worker exited with code ${code}`));
    });
  }

  handleMessage(message) {
    if (message.type === "ready") {
      this.description = message.description;
      this.status = "Installed";
      this.resolveReady();
      return;
    }
    if (message.type === "startup-error") {
      this.fail(new Error(message.error));
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.type === "error") pending.reject(new Error(message.error));
    else pending.resolve(message.result);
  }

  fail(error) {
    this.error = error;
    this.status = "Unavailable";
    this.rejectReady(error);
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  async decide(prepared) {
    await this.readyPromise;
    const id = this.nextId++;
    const result = await new Promise((resolveResult, reject) => {
      this.pending.set(id, { resolve: resolveResult, reject });
      this.worker.postMessage({ id, request: prepared.runtimeRequest });
    });
    const typedDecision = result.decisions?.[0];
    if (!typedDecision) throw new Error("Laya returned no typed decision.");
    return { result, typedDecision, decision: interpretLayaDecision(prepared, typedDecision) };
  }
}

export class HealthcareDecisionService {
  constructor(inference, initializationError = null) {
    this.inference = inference;
    this.initializationError = initializationError;
  }

  describe() {
    const description = this.inference?.description;
    return {
      provider: "rust-ml-runtime",
      modelName: "Laya",
      runtime: "rust-ml-runtime",
      execution: "Local",
      platform: `${process.platform}-${process.arch}`,
      nativeBinding: nativeBindingPackage(),
      nativeBindingStatus: description ? "loaded" : this.inference?.status === "Unavailable" ? "unavailable" : "loading",
      backend: description?.backend || "Core ML",
      modelStatus: this.inference?.status || "Unavailable",
      modelIdentifier: description?.identifier || "laya",
      modelRevision: description?.revision,
      artifactChecksum: description?.artifact_sha256,
      error: this.inference?.error?.message || this.initializationError?.message,
      supportedDecisionTypes: Object.keys(getDecisionTypeDefinition()),
    };
  }

  async decide(request, inferenceRequestOverride = undefined) {
    validateDecisionRequest(request);
    if (!this.inference) throw runtimeUnavailable(this.initializationError || "runtime failed to initialize");

    const prepared = prepareLayaRequest(request);
    if (inferenceRequestOverride !== undefined) {
      prepared.runtimeRequest = validateInferenceOverride(inferenceRequestOverride, prepared.runtimeRequest);
    }
    let local;
    try {
      local = await this.inference.decide(prepared);
    } catch (error) {
      throw runtimeUnavailable(error);
    }

    // Healthcare rules and evidence completeness remain application-owned. Laya
    // supplies the bounded judgment; the application refuses to turn missing or
    // conflicting evidence into a forced yes/no result.
    const evidenceAssessment = evaluateDecisionRequest(request, { model: "Laya", provider: "rust-ml-runtime" });
    const preserveGuardrail =
      evidenceAssessment.status !== "determined" ||
      constrainedOutcomes.has(evidenceAssessment.decision) ||
      authoritativeDecisionTypes.has(request.decision.type);
    const decision = preserveGuardrail ? evidenceAssessment.decision : local.decision;
    const status = preserveGuardrail ? evidenceAssessment.status : "determined";
    const explanation = preserveGuardrail
      ? evidenceAssessment.explanation
      : evidenceAssessment.decision === decision
        ? evidenceAssessment.explanation
        : `Local Laya inference selected ${decision.replaceAll("_", " ")} from the bounded options using the supplied evidence.`;

    const result = {
      ...evidenceAssessment,
      decision,
      status,
      confidence: preserveGuardrail ? evidenceAssessment.confidence : local.typedDecision.confidence,
      explanation,
      model: "Laya",
      provider: "rust-ml-runtime",
      runtime: {
        name: "rust-ml-runtime",
        execution: "Local",
        backend: local.result.backend,
        modelIdentifier: local.result.model.identifier,
        modelRevision: local.result.model.revision,
        latency: local.result.execution.latency,
        artifactChecksum: local.result.provenance.artifact_sha256,
      },
      inferenceRequest: prepared.runtimeRequest,
      modelDecision: local.typedDecision,
      resolution: {
        modelSuggestion: local.decision,
        finalDecision: decision,
        modelOverridden: local.decision !== decision,
        source: preserveGuardrail ? "healthcare_rules_and_evidence" : "laya",
      },
      inferenceResponse: {
        model: local.result.model,
        backend: local.result.backend,
        decisions: local.result.decisions,
        execution: local.result.execution,
        provenance: {
          artifactSha256: local.result.provenance.artifact_sha256,
          runtimeVersion: local.result.provenance.runtime_version,
        },
      },
    };

    const validated = validateDecisionResult(request, result, { model: "Laya", provider: "rust-ml-runtime" });
    return {
      ...validated,
      runtime: result.runtime,
      inferenceRequest: result.inferenceRequest,
      modelDecision: result.modelDecision,
      inferenceResponse: result.inferenceResponse,
      resolution: result.resolution,
    };
  }

  ready() {
    return this.inference?.readyPromise || Promise.reject(this.initializationError || new Error("runtime unavailable"));
  }
}

export function createDecisionService(env, dependencies = {}) {
  if (dependencies.inference) return new HealthcareDecisionService(dependencies.inference);
  try {
    const developmentModelRoot = resolve(".models");
    const modelRoot = env.ML_RUNTIME_MODEL_DIR || (existsSync(developmentModelRoot) ? developmentModelRoot : undefined);
    return new HealthcareDecisionService(new RustMlRuntimeInference({ modelRoot }));
  } catch (error) {
    return new HealthcareDecisionService(null, runtimeUnavailable(error));
  }
}
