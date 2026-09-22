# Jev Healthcare Decision Portal

A local inference demonstration of one Laya model serving many bounded healthcare judgments. The healthcare application prepares perspective-specific context and evidence; `rust-ml-runtime` owns model discovery, integrity validation, loading, Core ML execution, and typed inference output.

All healthcare data is fictional Northstar Health Plan data. This is not a real coverage, eligibility, clinical, or payment system.

## Architecture

```text
HealthcareDecisionService
  → DecisionInference (RustMlRuntimeInference)
    → @rust-ml-runtime/node (thin native boundary)
      → ml-runtime reusable Rust crate
        → installed Laya package
          → Core ML
```

There is no deterministic production inference provider, cloud LLM provider, Python process, or direct Core ML integration in this application. If Laya or the runtime is unavailable, `/api/decide` returns an explicit error.

The sibling runtime repository remains responsible for model registry and installation, checksums, storage, compiled caches, model loading, Core ML, and its normalized typed result. This repository owns synthetic healthcare data, policies, questions, perspectives, compact context assembly, evidence selection, result guardrails, and presentation.

## Prerequisites

- macOS with Core ML
- Rust toolchain
- Node.js 22+
- `rust-ml-runtime` checked out beside this repository during development

Expected development layout:

```text
Desktop/
  hc-demo/
  rust-ml-runtime/
```

The application consumes the runtime's package boundary through the local `@rust-ml-runtime/node` dependency. That native package depends on the reusable `ml-runtime` Rust crate with its `coreml` feature.

## Install and run

Build the runtime CLI and native application boundary:

```bash
cd ../rust-ml-runtime
cargo build --release -p ml-runtime-cli
cd ../hc-demo
npm install
npm run build:runtime
```

Install the pinned Laya distribution into the runtime-owned default model directory:

```bash
../rust-ml-runtime/target/release/ml-runtime model install laya
npm start
```

For offline development with the checked-out Laya package, use a repository-local ignored model directory:

```bash
../rust-ml-runtime/target/release/ml-runtime model install laya \
  --source ../rust-ml-runtime/models/laya \
  --models .models

npm start
```

The development server automatically uses `.models` when that directory exists. `ML_RUNTIME_MODEL_DIR` can still select a different runtime-owned model root explicitly.

Open `http://localhost:8000`.

Initial Core ML compilation can make the first startup take about a minute. Subsequent executions reuse runtime-managed compiled state.

## What the portal demonstrates

- Provider, Member, Broker, and Employer perspectives with audience-specific questions
- Six scenarios spanning eligible, not eligible, covered, excluded, missing evidence, conflicting evidence, paid, pending, and denied outcomes
- Noul, Choice, and Score typed Laya decisions
- Compact, self-contained inference requests instead of raw healthcare records
- Explicit evidence, findings, missing information, and next action
- Explicit `determined`, `insufficient_evidence`, and `uncertain` statuses
- Runtime diagnostics: Laya, `rust-ml-runtime`, local execution, Core ML, installation state
- A same eligibility comparison across Provider, Member, Broker, and Employer contexts
- One model identifier across every workflow

## Tests

```bash
npm test
```

Unit tests verify healthcare-to-Laya request preparation and typed output interpretation. When Laya is installed under `ML_RUNTIME_MODEL_DIR` or `.models`, the integration test starts the real portal, calls its decision endpoint, executes the installed Laya model through `rust-ml-runtime` and Core ML, and validates the structured API result. It does not replace inference with a fixture.

## Failure behavior

The application fails closed for missing models, integrity errors, runtime failures, invalid model output, and invalid decision schemas. Missing or conflicting healthcare evidence remains an explicit insufficient-evidence or human-review result; it is never silently forced into yes/no and never sent to a cloud fallback.
