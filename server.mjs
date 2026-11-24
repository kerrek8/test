import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));
const VALID_TOPICS = new Set(["delivery", "pricing", "other"]);

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export async function handleTriage(request, response) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json(response, 400, { status: "invalid_input" });
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.text !== "string" ||
    payload.text.trim().length === 0
  ) {
    return json(response, 400, { status: "invalid_input" });
  }

  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("AI timeout")), 300);
    });

    let rawAi;
    try {
      rawAi = await Promise.race([
        classify(payload.text, { signal: AbortSignal.timeout(300) }),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timer);
    }

    let aiResult;
    if (typeof rawAi === "string") {
      aiResult = JSON.parse(rawAi);
    } else {
      aiResult = rawAi;
    }

    if (
      !aiResult ||
      typeof aiResult !== "object" ||
      !VALID_TOPICS.has(aiResult.topic) ||
      typeof aiResult.draft !== "string" ||
      aiResult.draft.trim().length === 0
    ) {
      return json(response, 200, {
        status: "manual_review",
        topic: null,
        draft: null,
      });
    }

    return json(response, 200, {
      status: "ready",
      topic: aiResult.topic,
      draft: aiResult.draft,
    });
  } catch {
    return json(response, 200, {
      status: "manual_review",
      topic: null,
      draft: null,
    });
  }
}

export const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  if (request.method !== "POST" || request.url !== "/api/triage") {
    return json(response, 404, { status: "not_found" });
  }
  try {
    await handleTriage(request, response);
  } catch {
    json(response, 500, { status: "server_error" });
  }
});

const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
);

if (isMain) {
  const port = Number(process.env.PORT || 3000);
  server.listen(port, "127.0.0.1");
}
