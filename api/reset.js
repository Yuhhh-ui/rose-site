/* Studio → Settings → Clear everything.
   POST studio   wipes content, bookings, reviews and messages. Photos already
                 uploaded stay in Blob storage but nothing points at them.      */

import { send, fail } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { resetAll } from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');
  try {
    await resetAll();
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
