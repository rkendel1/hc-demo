import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const MODEL_NAME = "laya";

export function runtimeConfiguration(env = process.env, cwd = process.cwd()) {
  const developmentModelRoot = resolve(cwd, ".models");
  return {
    modelName: MODEL_NAME,
    modelRoot: env.ML_RUNTIME_MODEL_DIR || (existsSync(developmentModelRoot) ? developmentModelRoot : undefined),
  };
}
