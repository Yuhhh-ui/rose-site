/* Local dev server:  npm run dev  →  http://localhost:3000

   Serves the site and runs the API functions in api/ the way Vercel does,
   with an in-memory store instead of Redis (everything is forgotten when the
   server stops) and photos kept inline instead of in Blob storage.

   Studio password is whatever STUDIO_PASSWORD is set to, or "rose". */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.ROSE_MEMORY_STORE = process.env.ROSE_MEMORY_STORE || '1';
process.env.ROSE_INLINE_PHOTOS = process.env.ROSE_INLINE_PHOTOS || '1';
process.env.STUDIO_PASSWORD = process.env.STUDIO_PASSWORD || 'rose';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function readBody(req) {
  return new Promise(function (resolve) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      var raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}

http.createServer(async function (req, res) {
  var url = new URL(req.url, 'http://localhost');

  if (url.pathname.indexOf('/api/') === 0) {
    var name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '');
    var file = path.join(ROOT, 'api', name + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"no such api"}'); }
    req.body = await readBody(req);
    req.query = Object.fromEntries(url.searchParams);
    req.cookies = {};
    String(req.headers.cookie || '').split(';').forEach(function (p) {
      var i = p.indexOf('='); if (i > 0) req.cookies[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    res.status = function (code) { res.statusCode = code; return res; };
    res.json = function (obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
    try {
      var mod = await import(pathToFileURL(file).href);
      await mod.default(req, res);
    } catch (e) {
      console.error(e);
      res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  var p = url.pathname === '/' ? '/index.html' : url.pathname;
  var f = path.join(ROOT, path.normalize(p));
  if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(PORT, function () {
  console.log('ROSÉ dev server → http://localhost:' + PORT + '   (studio password: ' + process.env.STUDIO_PASSWORD + ')');
});
