// Tiny static server with HTTP Range support, needed for video seeking (Python's http.server has none).
// Usage from the repo root: node work/serve.mjs public 8787
import { createServer } from 'node:http';
import { statSync, createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';
const [root, port] = [process.argv[2], +process.argv[3]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  let st; try { st = statSync(file); } catch { res.writeHead(404); return res.end(); }
  const type = types[extname(file)] || 'application/octet-stream', range = req.headers.range;
  if (range) {
    const [a, b] = range.replace('bytes=', '').split('-'), start = +a, end = b ? +b : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  }
}).listen(port, '127.0.0.1');
