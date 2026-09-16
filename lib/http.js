/* Small helpers shared by every API function. */

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function fail(res, status, message) {
  send(res, status, { error: message });
}

/* Vercel parses JSON bodies for us; the dev server does the same. Be defensive anyway. */
export function body(req) {
  var b = req.body;
  if (b == null) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return {}; } }
  return b;
}

export function cookies(req) {
  if (req.cookies) return req.cookies;
  var out = {};
  String(req.headers.cookie || '').split(';').forEach(function (part) {
    var i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/* trim, cap the length, and drop control characters (newlines and tabs stay) */
export function clean(v, max) {
  var s = String(v == null ? '' : v), out = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 32 || c === 10 || c === 13 || c === 9) out += s[i];
  }
  return out.trim().slice(0, max);
}

export function id(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
