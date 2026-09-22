# Jev Healthcare Decision Portal

A polished proof-of-concept portal that demonstrates Jev's core idea: the **same inference capability** can perform many bounded healthcare judgments when each request includes the question, contract, rules, evidence, and context needed for the decision.

## What this demo includes

- Five healthcare perspectives: Provider, Member, Prior Authorization, Customer Service, and Enrollment
- Self-contained `DecisionRequest` payload inspection before inference
- Structured `DecisionResult` responses with findings, evidence, missing information, and next actions
- Synthetic Northstar Health Plan data only
- Scripted demo scenarios covering:
  - covered
  - missing evidence
  - not covered
  - not eligible
  - ambiguous / human review
- Compare Perspectives mode showing the same question answered by the same model with different contexts
- Pluggable inference layer that works with:
  - built-in deterministic demo inference
  - Jev-compatible HTTP inference endpoints
  - local Ollama models
  - OpenAI-compatible local endpoints (for tools such as LM Studio or llama.cpp-compatible servers)

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deploy on Fly.io

This repo now includes:

- `Dockerfile` for a containerized deployment
- `fly.toml` with HTTP service and health check configuration
- `/healthz` for Fly health checks

Deploy with:

```bash
fly launch --copy-config --no-deploy
fly deploy
```

If the default Fly app name in `fly.toml` is already taken, update the `app` value before deploying.

## Test

```bash
npm test
```

## Inference providers

The app defaults to a deterministic demo engine so the portal always works out of the box.

### Demo provider

```bash
JEV_PROVIDER=demo npm start
```

### Jev-compatible provider

```bash
JEV_PROVIDER=jev \
JEV_API_URL=http://localhost:4000/decide \
JEV_API_KEY=optional-token \
JEV_MODEL_NAME=jev-health-model \
npm start
```

The Jev endpoint is expected to accept the portal's `DecisionRequest` JSON and return a `DecisionResult` JSON object.

### Ollama

```bash
JEV_PROVIDER=ollama \
OLLAMA_MODEL=llama3.1 \
OLLAMA_API_URL=http://127.0.0.1:11434 \
npm start
```

### OpenAI-compatible local endpoint

```bash
JEV_PROVIDER=openai-compatible \
OPENAI_COMPAT_BASE_URL=http://127.0.0.1:1234/v1 \
OPENAI_COMPAT_MODEL=local-model \
OPENAI_COMPAT_API_KEY=optional-key \
npm start
```

## Screenshots

Screenshots for the portal experience are stored in `screenshots/`:

- `screenshots/portal-overview.png`
- `screenshots/portal-compare.png`

## Safety framing

This application uses synthetic healthcare data and policies for demonstration only. It is **not** intended to make real-world healthcare, coverage, eligibility, clinical, or payment determinations.
