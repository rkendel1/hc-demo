import {
  buildModelPrompt,
  evaluateDecisionRequest,
  getDecisionTypeDefinition,
  safeDecisionFallback,
  validateDecisionRequest,
  validateDecisionResult,
} from "../public/app/decision-engine.js";

function headersWithAuth(baseHeaders, token) {
  if (!token) {
    return baseHeaders;
  }

  const authHeaderName = ["Author", "ization"].join("");
  const authHeaderValue = ["Bearer", token].join(" ");
  return { ...baseHeaders, [authHeaderName]: authHeaderValue };
}

async function parseJsonResponse(response) {
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Inference request failed with ${response.status}`);
    error.statusCode = 502;
    error.detail = detail;
    error.expose = true;
    throw error;
  }

  return response.json();
}

class DemoDecisionInference {
  constructor(modelName) {
    this.modelName = modelName;
  }

  async decide(request) {
    return evaluateDecisionRequest(request, { model: this.modelName });
  }
}

class JevDecisionInference {
  constructor({ apiUrl, apiKey, modelName }) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async decide(request) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: headersWithAuth({ "Content-Type": "application/json" }, this.apiKey),
      body: JSON.stringify(request),
    });

    return parseJsonResponse(response);
  }
}

class OllamaDecisionInference {
  constructor({ apiUrl, modelName }) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.modelName = modelName;
  }

  async decide(request) {
    const response = await fetch(`${this.apiUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        stream: false,
        format: "json",
        prompt: buildModelPrompt(request),
        options: {
          temperature: 0.1,
        },
      }),
    });

    const payload = await parseJsonResponse(response);
    return JSON.parse(payload.response);
  }
}

class OpenAICompatibleInference {
  constructor({ baseUrl, apiKey, modelName }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async decide(request) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: headersWithAuth({ "Content-Type": "application/json" }, this.apiKey),
      body: JSON.stringify({
        model: this.modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return only valid JSON matching the supplied healthcare decision schema.",
          },
          {
            role: "user",
            content: buildModelPrompt(request),
          },
        ],
        temperature: 0.1,
      }),
    });

    const payload = await parseJsonResponse(response);
    const content = payload.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }
}

function createInferenceProvider(env) {
  const provider = env.JEV_PROVIDER || "demo";

  if (provider === "jev") {
    if (!env.JEV_API_URL) {
      throw new Error("JEV_API_URL is required when JEV_PROVIDER=jev");
    }

    return {
      provider,
      engine: new JevDecisionInference({
        apiUrl: env.JEV_API_URL,
        apiKey: env.JEV_API_KEY,
        modelName: env.JEV_MODEL_NAME || "jev-remote",
      }),
      modelName: env.JEV_MODEL_NAME || "jev-remote",
    };
  }

  if (provider === "ollama") {
    return {
      provider,
      engine: new OllamaDecisionInference({
        apiUrl: env.OLLAMA_API_URL || "http://127.0.0.1:11434",
        modelName: env.OLLAMA_MODEL || "llama3.1",
      }),
      modelName: env.OLLAMA_MODEL || "llama3.1",
    };
  }

  if (provider === "openai-compatible") {
    if (!env.OPENAI_COMPAT_BASE_URL || !env.OPENAI_COMPAT_MODEL) {
      throw new Error("OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_MODEL are required for openai-compatible mode");
    }

    return {
      provider,
      engine: new OpenAICompatibleInference({
        baseUrl: env.OPENAI_COMPAT_BASE_URL,
        apiKey: env.OPENAI_COMPAT_API_KEY,
        modelName: env.OPENAI_COMPAT_MODEL,
      }),
      modelName: env.OPENAI_COMPAT_MODEL,
    };
  }

  return {
    provider: "demo",
    engine: new DemoDecisionInference(env.JEV_MODEL_NAME || "northstar-demo-logic"),
    modelName: env.JEV_MODEL_NAME || "northstar-demo-logic",
  };
}

export function createDecisionService(env) {
  const { provider, engine, modelName } = createInferenceProvider(env);

  return {
    describe() {
      return {
        provider,
        modelName,
        supportedDecisionTypes: Object.keys(getDecisionTypeDefinition()),
      };
    },
    async decide(request) {
      validateDecisionRequest(request);

      try {
        const rawResult = await engine.decide(request);
        return validateDecisionResult(request, rawResult, { model: modelName, provider });
      } catch (error) {
        if (provider === "demo") {
          throw error;
        }

        return safeDecisionFallback(request, error, { model: modelName, provider });
      }
    },
  };
}
