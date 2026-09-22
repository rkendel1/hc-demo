import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createDecisionService } from "./src/inference-service.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const decisionService = createDecisionService(process.env);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function json(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

async function serveStatic(pathname, response) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const resolved = safePath === "/" ? "/index.html" : safePath;
  const filePath = join(publicDir, resolved);
  const file = await readFile(filePath);
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "text/plain; charset=utf-8" });
  response.end(file);
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/config") {
      return json(response, 200, decisionService.describe());
    }

    if (request.method === "POST" && url.pathname === "/api/decide") {
      const body = await readBody(request);
      const result = await decisionService.decide(body.request);
      return json(response, 200, result);
    }

    if (request.method === "GET") {
      return await serveStatic(url.pathname, response);
    }

    return json(response, 404, { error: "Not found" });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.expose ? error.message : "Internal server error";
    return json(response, statusCode, { error: message, detail: error.detail });
  }
});

server.listen(port, () => {
  console.log(`Jev Healthcare Decision Portal running at http://localhost:${port}`);
});
