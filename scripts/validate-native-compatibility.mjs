import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const baseline = process.env.RUST_ML_GLIBC_BASELINE || "2.36";
const packageName = `@rust-ml-runtime/node-${process.platform}-${process.arch}${process.platform === "linux" ? "-gnu" : process.platform === "win32" ? "-msvc" : ""}`;

if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error(`Linux x64 compatibility validation must run on Linux x64, got ${process.platform}-${process.arch}`);
}

const manifestPath = require.resolve(`${packageName}/package.json`);
const packageRoot = resolve(manifestPath, "..");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const nativeBinary = resolve(packageRoot, manifest.main);

async function elfFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isFile() && (entry.name.endsWith(".node") || entry.name.endsWith(".so") || entry.name.includes(".so."))) files.push(path);
    if (entry.isDirectory()) files.push(...await elfFiles(path));
  }
  return files;
}

function versionNumber(version) {
  return version.split(".").map(Number);
}

function exceedsBaseline(version) {
  const actual = versionNumber(version);
  const expected = versionNumber(baseline);
  return actual[0] > expected[0] || (actual[0] === expected[0] && actual[1] > expected[1]);
}

for (const file of await elfFiles(packageRoot)) {
  const metadata = execFileSync("readelf", ["--version-info", file], { encoding: "utf8" });
  const versions = [...metadata.matchAll(/GLIBC_(\d+\.\d+)/g)].map((match) => match[1]);
  const unsupported = [...new Set(versions.filter(exceedsBaseline))];
  if (unsupported.length) {
    throw new Error(`${file} requires unsupported glibc symbol versions: ${unsupported.join(", ")} (baseline ${baseline})`);
  }
}

const runtime = require("@rust-ml-runtime/node");
const diagnostics = runtime.diagnoseNative();
if (!diagnostics.available) {
  throw new Error(`native binding failed to load: ${diagnostics.error?.message || "unknown loader error"}`);
}

console.log(`Validated ${packageName} against glibc ${baseline}`);
console.log(`rust-ml-runtime: package resolved ${diagnostics.packageResolved}`);
console.log(`rust-ml-runtime: native binary ${diagnostics.nativeBinary}`);
console.log("rust-ml-runtime: load success");
