import runtimeNode from "@rust-ml-runtime/node";
import { runtimeConfiguration } from "../src/runtime-config.js";

const configuration = runtimeConfiguration(process.env);
const diagnostics = runtimeNode.diagnoseNative();

if (!diagnostics.available) {
  throw new Error(`native binding failed to load: ${diagnostics.error?.message || "unknown loader error"}`);
}

const runtime = await runtimeNode.LocalML.create({ modelRoot: configuration.modelRoot });

if (!runtime || typeof runtime.decide !== "function") {
  throw new Error("rust-ml-runtime failed to initialize");
}

let model;
if (configuration.modelRoot) {
  model = new runtimeNode.LocalDecisionModel(configuration.modelName, configuration.modelRoot);
  JSON.parse(model.descriptionJson());
}

console.log(`native binding resolved: ${diagnostics.nativeBinary}`);
console.log("rust-ml-runtime initialized");
if (model) {
  console.log(`model initialized: ${configuration.modelName} from ${configuration.modelRoot}`);
} else {
  console.log("model initialization deferred: no application model directory is configured during image build");
}
