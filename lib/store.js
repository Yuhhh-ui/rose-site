/* Where everything lives.

   Production: Upstash Redis, added from the Vercel project's Storage tab.
   It sets KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_ names).
   Local:      `npm run dev` uses an in-memory copy that forgets on restart.

   Keys
     rose:content                          the editable site as one JSON document
     rose:bookings / reviews / messages    hashes of id -> JSON item             */

const KEY = 'rose:';

/* The Upstash integration names its variables after the prefix chosen when connecting
   (KV_REST_API_URL, STORAGE_REST_API_URL, ...), so accept whatever prefix was used. */
function restPrefix() {
  var names = Object.keys(process.env);
  for (var i = 0; i < names.length; i++) {
    var m = /^(.*)_REST_API_URL$/.exec(names[i]);
    if (m && process.env[m[1] + '_REST_API_TOKEN']) return m[1];
  }
  return null;
}
function restUrl()   { var p = restPrefix(); return p ? process.env[p + '_REST_API_URL']   : process.env.UPSTASH_REDIS_REST_URL; }
function restToken() { var p = restPrefix(); return p ? process.env[p + '_REST_API_TOKEN'] : process.env.UPSTASH_REDIS_REST_TOKEN; }

/* --- in-memory backend, for the dev server ------------------------------ */
const mem = { str: {}, hash: {} };

function memCmd(cmd, args) {
  var k = args[0];
  switch (cmd) {
    case 'GET':     return mem.str[k] == null ? null : mem.str[k];
    case 'SET':     mem.str[k] = args[1]; return 'OK';
    case 'DEL':     args.forEach(function (x) { delete mem.str[x]; delete mem.hash[x]; }); return args.length;
    case 'HSET':    mem.hash[k] = mem.hash[k] || {}; mem.hash[k][args[1]] = args[2]; return 1;
    case 'HGET':    return (mem.hash[k] || {})[args[1]] == null ? null : mem.hash[k][args[1]];
    case 'HDEL':    if (mem.hash[k]) delete mem.hash[k][args[1]]; return 1;
    case 'HGETALL': var h = mem.hash[k] || {}, out = []; Object.keys(h).forEach(function (f) { out.push(f, h[f]); }); return out;
  }
  throw new Error('memCmd: ' + cmd);
}

/* --- one call to Redis --------------------------------------------------- */
async function redis(cmd) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (process.env.ROSE_MEMORY_STORE) return memCmd(cmd, args);
  if (!restUrl() || !restToken()) throw new Error('Storage is not connected: add Upstash Redis to the Vercel project.');
  var r = await fetch(restUrl(), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + restToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd].concat(args.map(String)))
  });
  var j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

export function storageReady() {
  return !!process.env.ROSE_MEMORY_STORE || !!(restUrl() && restToken());
}

/* --- content ------------------------------------------------------------- */
export async function getContent() {
  var raw = await redis('GET', KEY + 'content');
  return raw ? JSON.parse(raw) : null;
}

export async function putContent(obj) {
  await redis('SET', KEY + 'content', JSON.stringify(obj));
}

/* --- inbox lists: bookings, reviews, messages ---------------------------- */
export const KINDS = ['bookings', 'reviews', 'messages'];

export async function listItems(kind) {
  var flat = await redis('HGETALL', KEY + kind) || [];
  var items = [];
  for (var i = 1; i < flat.length; i += 2) { try { items.push(JSON.parse(flat[i])); } catch (e) {} }
  items.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  return items;
}

export async function getItem(kind, id) {
  var raw = await redis('HGET', KEY + kind, id);
  return raw ? JSON.parse(raw) : null;
}

export async function putItem(kind, item) {
  await redis('HSET', KEY + kind, item.id, JSON.stringify(item));
  return item;
}

export async function delItem(kind, id) {
  await redis('HDEL', KEY + kind, id);
}

export async function resetAll() {
  await redis('DEL', KEY + 'content', KEY + 'bookings', KEY + 'reviews', KEY + 'messages');
}
