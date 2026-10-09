// Tiny static server for Contlas. Usage: node contlas-serve.js [port] [--open]
const http = require("http"), fs = require("fs"), path = require("path"), { exec } = require("child_process");
const root = __dirname, port = +(process.argv[2] || 8143), open = process.argv.includes("--open");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".sql": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found: " + p); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  const url = "http://localhost:" + port + "/";
  console.log("Contlas running at " + url);
  if (open) exec(process.platform === "win32" ? 'start "" "' + url + '"' : (process.platform === "darwin" ? "open " : "xdg-open ") + url);
}).on("error", (e) => { console.error(e.code === "EADDRINUSE" ? "Port " + port + " is already in use." : e.message); process.exit(1); });
