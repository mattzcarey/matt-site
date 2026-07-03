import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PATH = "/backend-api/codex/responses"
DROP = {
    "connection", "content-length", "host", "transfer-encoding",
    "cf-connecting-ip", "cf-ew-via", "cf-ipcountry", "cf-ray",
    "cf-visitor", "cf-worker", "cdn-loop", "x-forwarded-proto", "user-agent",
}
CODEX_USER_AGENT = "codex_cli_rs/0.142.0 (Linux; x86_64) reqwest"

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != PATH:
            self.send_error(404)
            return

        body = self.rfile.read(int(self.headers.get("content-length", "0")))
        request = Request(f"https://chatgpt.com{PATH}", data=body, method="POST")
        for name, value in self.headers.items():
            if name.lower() not in DROP:
                request.add_header(name, value)
        request.add_header("User-Agent", CODEX_USER_AGENT)

        try:
            with urlopen(request, timeout=600) as upstream:
                status, data, headers = upstream.status, upstream.read(), upstream.headers
        except HTTPError as error:
            status, data, headers = error.code, error.read(), error.headers
        except Exception as error:
            print(f"Codex egress failed: {error}", flush=True)
            status, data, headers = 502, json.dumps({"error": "Codex egress failed"}).encode(), {}

        if status >= 400:
            sample = data[:200].decode(errors="replace").replace("\n", " ")
            print(f"Codex upstream {status}: {sample}", flush=True)

        self.send_response(status)
        content_type = headers.get("content-type") if headers else None
        self.send_header("content-type", content_type or ("text/event-stream" if status < 300 else "application/json"))
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass

ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
