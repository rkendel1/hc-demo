import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDecisionRequest } from "../public/app/catalog.js";

const modelRoot = process.env.ML_RUNTIME_MODEL_DIR || resolve(".models");
const expectedBackend = process.platform === "linux" ? "onnx" : "coreml";
let installed = true;
try {
  await access(resolve(modelRoot, "laya"));
} catch {
  installed = false;
}

let portalAlreadyRunning = false;
try {
  const response = await fetch("http://127.0.0.1:8000/healthz", { signal: AbortSignal.timeout(500) });
  portalAlreadyRunning = response.ok;
} catch {
  portalAlreadyRunning = false;
}

const runtimeSkipReason = !installed
  ? `install Laya under ${modelRoot}`
  : portalAlreadyRunning
    ? "stop the portal on port 8000 before running the isolated CoreML integration test"
    : false;

test("portal endpoint executes through rust-ml-runtime and real local Laya", { skip: runtimeSkipReason, timeout: 120_000 }, async (context) => {
  const port = 20_000 + Math.floor(Math.random() * 1_000);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), ML_RUNTIME_MODEL_DIR: modelRoot },
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });

  let response;
  for (let attempt = 0; attempt < 1_100; attempt += 1) {
    try {
      response = await fetch(`${origin}/healthz`);
      break;
    } catch {
      if (child.exitCode !== null) throw new Error(`Portal exited before startup with code ${child.exitCode}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
  }
  assert.equal(response?.status, 200, "portal did not become ready after loading Laya");

  const page = await fetch(`${origin}/`);
  assert.match(await page.text(), /Decision &amp; explanation/);

  let config;
  for (let attempt = 0; attempt < 1_100; attempt += 1) {
    config = await (await fetch(`${origin}/api/config`)).json();
    if (config.modelStatus !== "Loading") break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  assert.equal(config.modelStatus, "Installed", config.error);
  assert.equal(config.runtime, "rust-ml-runtime");
  assert.equal(config.execution, "Local");

  const request = buildDecisionRequest({ perspectiveId: "provider", questionId: "provider-coverage", scenarioId: "scenario-a" });
  const decisionResponse = await fetch(`${origin}/api/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request }),
  });
  assert.equal(decisionResponse.status, 200);
  const result = await decisionResponse.json();
  assert.equal(result.decision, "covered");
  assert.equal(result.status, "determined");
  assert.equal(result.model, "Laya");
  assert.equal(result.provider, "rust-ml-runtime");
  assert.equal(result.runtime.backend, expectedBackend);
  assert.equal(result.runtime.execution, "Local");
  assert.equal(result.modelDecision.kind, "noul");
  assert.equal(result.inferenceResponse.backend, expectedBackend);
  assert.equal(result.inferenceResponse.model.identifier, result.runtime.modelIdentifier);
  assert.equal(result.inferenceResponse.provenance.artifactSha256, result.runtime.artifactChecksum);
  assert.ok(result.inferenceResponse.execution.latency);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(result.evidence.length > 0);

  const semanticCases = [
    ["provider", "provider-coverage", "scenario-d", "not_covered"],
    ["provider", "provider-claim-submit", "scenario-c", "cannot_submit"],
    ["member", "member-eligibility", "scenario-f", "eligible"],
    ["member", "member-claim-status", "scenario-f", "claim_approved"],
    ["member", "member-next-step", "scenario-f", "proceed"],
  ];

  for (const [perspectiveId, questionId, scenarioId, expectedDecision] of semanticCases) {
    const semanticRequest = buildDecisionRequest({ perspectiveId, questionId, scenarioId });
    const semanticResponse = await fetch(`${origin}/api/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: semanticRequest }),
    });
    assert.equal(semanticResponse.status, 200, `${questionId}/${scenarioId} request failed`);
    const semanticResult = await semanticResponse.json();
    assert.equal(semanticResult.decision, expectedDecision, `${questionId}/${scenarioId} was mislabeled`);
    assert.ok(semanticResult.inferenceResponse?.decisions?.length, `${questionId}/${scenarioId} omitted the raw Laya response`);
  }
});
