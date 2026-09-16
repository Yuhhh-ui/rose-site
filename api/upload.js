/* Photo uploads from the studio panel.
   POST studio { data }   data is a data URL from the browser  ->  { url }   */

import { send, fail, body } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { storeImage } from '../lib/images.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');
  try {
    var url = await storeImage(body(req).data, 'site');
    return send(res, 200, { url: url });
  } catch (e) {
    console.error(e);
    return fail(res, 400, e.message);
  }
}
