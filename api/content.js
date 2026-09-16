/* The editable site.
   GET  -> { content, reviews }   content is null until the panel saves once;
                                  reviews are the published ones, for the public pages
   PUT  -> { content }            studio only. Replaces the whole document.        */

import { send, fail, body } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { getContent, putContent, listItems } from '../lib/store.js';

/* the only keys the panel edits; anything else is dropped */
const KEYS = ['home', 'artist', 'services', 'lashes', 'policies', 'gallery', 'hours', 'brand'];
const MAX_BYTES = 2 * 1024 * 1024;

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      var content = await getContent();
      var reviews = (await listItems('reviews')).filter(function (r) { return r.published; });
      return send(res, 200, { content: content, reviews: reviews });
    }

    if (req.method === 'PUT') {
      if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');
      var c = body(req).content;
      if (!c || typeof c !== 'object') return fail(res, 400, 'No content');
      var keep = {};
      KEYS.forEach(function (k) { if (c[k] !== undefined) keep[k] = c[k]; });
      if (JSON.stringify(keep).length > MAX_BYTES) return fail(res, 413, 'Too large. Photos should be uploaded, not pasted.');
      await putContent(keep);
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
