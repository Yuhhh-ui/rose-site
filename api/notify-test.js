/* Studio → Settings → Send a test alert.
   POST studio  ->  { results: [{ channel, ok, error }] }
   Sends a real alert on every configured channel and reports what happened,
   so a broken key or a service being down is visible instead of silent. */

import { send, fail } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { notify, notifyConfigured } from '../lib/notify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');

  var on = notifyConfigured();
  if (!on.push && !on.whatsapp && !on.email) {
    return send(res, 200, { results: [], none: true });
  }
  var results = await notify('Test alert from your website',
    'If you are reading this, booking alerts are working.\n\nSent from the studio panel.');
  return send(res, 200, { results: results });
}
