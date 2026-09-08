// Paradise Reclaimed: serves the Godot HTML5 export.
//
// The export must be served over http, not opened as file:// -- the engine
// fetches its .pck over XHR and every browser blocks that on the file scheme.
//
// Serving same-origin with the axum API also sidesteps the missing CorsLayer
// (see docs/GODOT-CLIENT.md, "Server-side blockers").

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "build", "web");
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const target = path.join(ROOT, rel === "/" ? "index.html" : rel);
    if (!target.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(target, (err, body) => {
      if (err) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(target)] || "application/octet-stream" });
      res.end(body);
    });
  })
  .listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
