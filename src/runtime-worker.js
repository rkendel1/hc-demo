import runtimeNode from "@rust-ml-runtime/node";
import { parentPort, workerData } from "node:worker_threads";

const { LocalDecisionModel } = runtimeNode;

try {
  const model = new LocalDecisionModel("laya", workerData.modelRoot);
  parentPort.postMessage({ type: "ready", description: JSON.parse(model.descriptionJson()) });
  parentPort.on("message", ({ id, request }) => {
    try {
      const result = JSON.parse(model.decideJson(JSON.stringify(request)));
      parentPort.postMessage({ type: "result", id, result });
    } catch (error) {
      parentPort.postMessage({ type: "error", id, error: error.message || String(error) });
    }
  });
} catch (error) {
  parentPort.postMessage({ type: "startup-error", error: error.message || String(error) });
}
