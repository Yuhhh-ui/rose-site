/* Studio login.
   GET     -> { logged, configured, setup }     setup lists what is connected, only when logged in
   POST    -> { password }  sets the session cookie
   DELETE  -> clears it                                                          */

import { send, fail, body } from '../lib/http.js';
import { configured, checkPassword, sessionCookie, clearCookie, loggedIn } from '../lib/auth.js';
import { storageReady } from '../lib/store.js';
import { blobReady } from '../lib/images.js';
import { notifyConfigured } from '../lib/notify.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    var logged = loggedIn(req);
    var out = { logged: logged, configured: configured() };
    if (logged) {
      var n = notifyConfigured();
      out.setup = { storage: storageReady(), photos: blobReady(), metaWhatsapp: n.metaWhatsapp, whatsapp: n.whatsapp, callmebot: n.callmebot, push: n.push, email: n.email };
    }
    return send(res, 200, out);
  }

  if (req.method === 'POST') {
    if (!configured()) return fail(res, 503, 'No studio password is set yet. Add STUDIO_PASSWORD in the Vercel project settings.');
    var b = body(req);
    if (!checkPassword(b.password)) {
      await new Promise(function (r) { setTimeout(r, 600); });   // slow down guessing
      return fail(res, 401, 'That password is not right.');
    }
    sessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    clearCookie(res);
    return send(res, 200, { ok: true });
  }

  return fail(res, 405, 'Method not allowed');
}
