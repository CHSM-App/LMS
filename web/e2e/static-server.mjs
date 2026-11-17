// Serves the built dist/ the way Plesk will (public/.htaccess, public/web.config):
//   /api/*            → proxied to the API (as when Plesk proxies /api on the same domain)
//   an existing file  → served as-is
//   anything else     → index.html (client-side route; deep links never 404)
// Used by the Playwright suite. Usage: node e2e/static-server.mjs  (PORT default 4173, API default :4100)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.E2E_WEB_PORT || 4173);
const api = new URL(process.env.E2E_API_URL || 'http://localhost:4100');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('dist/index.html missing — run `npm run build` first');
  process.exit(1);
}

function proxy(req, res) {
  const upstream = http.request({ host: api.hostname, port: api.port, path: req.url, method: req.method, headers: { ...req.headers, host: api.host } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  upstream.on('error', () => {
    res.writeHead(502);
    res.end('API unavailable');
  });
  req.pipe(upstream);
}

function send(res, file, status = 200) {
  const ext = path.extname(file);
  res.writeHead(status, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return proxy(req, res);
    const file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) {
      res.writeHead(400);
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, file);
    return send(res, path.join(root, 'index.html'));
  })
  .listen(port, () => console.log(`dist on http://localhost:${port} (api → ${api.origin})`));
