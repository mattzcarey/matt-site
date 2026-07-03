import http from "node:http";

const PATH = "/backend-api/codex/responses";
const DROP = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
  "cf-connecting-ip",
  "cf-ew-via",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "cdn-loop",
  "x-forwarded-proto",
]);

function reply(res, status, body) {
  const text = JSON.stringify({ error: body });
  res.writeHead(status, { "content-type": "application/json" });
  res.end(text);
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== PATH) return reply(res, 404, "Not found");

    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (DROP.has(name) || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
    }

    try {
      const upstream = await fetch(`https://chatgpt.com${PATH}`, {
        method: "POST",
        headers,
        body: req,
        duplex: "half",
      });
      const responseHeaders = Object.fromEntries(
        [...upstream.headers].filter(([name]) => !DROP.has(name)),
      );
      responseHeaders["content-type"] ||= "text/event-stream; charset=utf-8";
      res.writeHead(upstream.status, responseHeaders);
      if (upstream.body) for await (const chunk of upstream.body) res.write(chunk);
      res.end();
    } catch (error) {
      console.error("Codex egress failed", error instanceof Error ? error.message : error);
      reply(res, 502, "Codex egress failed");
    }
  })
  .listen(8080, "0.0.0.0");
