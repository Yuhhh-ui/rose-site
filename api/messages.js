/* Contact-page messages.
   POST   public  { name, phone, email, topic, message }  name, phone and message required
   GET    studio  -> { items }
   DELETE studio  { id }                                                          */

import { send, fail, body, clean, id } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems, putItem, delItem } from '../lib/store.js';
import { notify } from '../lib/notify.js';

export default async function handler(req, res) {
  try {
    var b = body(req);

    if (req.method === 'POST') {
      if (b.website) return send(res, 200, { ok: true });
      var item = {
        id: id('m'), at: Date.now(), read: false,
        name:    clean(b.name, 120),
        phone:   clean(b.phone, 60),
        email:   clean(b.email, 160),
        topic:   clean(b.topic, 160),
        message: clean(b.message, 3000)
      };
      if (!item.name || !item.phone || !item.message) {
        return fail(res, 400, 'Add your name, a number to reach you on, and a message.');
      }
      await putItem('messages', item);
      await notify('New message from ' + item.name + (item.topic ? ': ' + item.topic : ''),
        item.message + '\n\nReply to: ' + item.phone + (item.email ? ' / ' + item.email : ''));
      return send(res, 200, { ok: true, id: item.id });
    }

    if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');

    if (req.method === 'GET') {
      return send(res, 200, { items: await listItems('messages') });
    }

    if (req.method === 'DELETE') {
      await delItem('messages', String(b.id || ''));
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
