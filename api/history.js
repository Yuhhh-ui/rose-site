/* Every booking request ever made, kept even after the booking itself is
   cleared from the Bookings section. Written by api/bookings.js; nothing
   deletes from it short of Settings → Clear everything.
   GET    studio  -> { items }   newest first                                   */

import { send, fail } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');
    if (req.method !== 'GET') return fail(res, 405, 'Method not allowed');
    return send(res, 200, { items: await listItems('history') });
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
