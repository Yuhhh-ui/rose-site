/* Booking requests.
   POST   public  { name, contact, email, occasion, notes, service, date, time, place }
   GET    studio  -> { items }
   PATCH  studio  { id, status }          pending | confirmed | completed | cancelled
   DELETE studio  { id }  or  { clear: true }   clear removes completed and cancelled   */

import { send, fail, body, clean, id } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems, getItem, putItem, delItem } from '../lib/store.js';
import { notify, bookingText } from '../lib/notify.js';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

export default async function handler(req, res) {
  try {
    var b = body(req);

    if (req.method === 'POST') {
      if (b.website) return send(res, 200, { ok: true });   // honeypot field: bots fill it, people never see it
      var item = {
        id: id('b'), at: Date.now(), status: 'pending',
        name:     clean(b.name, 120),
        contact:  clean(b.contact, 120),
        email:    clean(b.email, 160),
        occasion: clean(b.occasion, 160),
        notes:    clean(b.notes, 2000),
        service:  clean(b.service, 120),
        date:     clean(b.date, 60),
        dateISO:  /^\d{4}-\d{2}-\d{2}$/.test(String(b.dateISO || '')) ? String(b.dateISO) : '',
        time:     clean(b.time, 40),
        place:    clean(b.place, 60) || 'Studio'
      };
      if (!item.name || !item.service || !item.date || !item.time) return fail(res, 400, 'Add your name, a service, a date and a time first.');
      await putItem('bookings', item);
      await notify('New booking request from ' + item.name, bookingText(item));
      return send(res, 200, { ok: true, id: item.id });
    }

    if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');

    if (req.method === 'GET') {
      return send(res, 200, { items: await listItems('bookings') });
    }

    if (req.method === 'PATCH') {
      var cur = await getItem('bookings', String(b.id || ''));
      if (!cur) return fail(res, 404, 'Booking not found');
      if (STATUSES.indexOf(b.status) < 0) return fail(res, 400, 'Bad status');
      cur.status = b.status;
      await putItem('bookings', cur);
      return send(res, 200, { ok: true, item: cur });
    }

    if (req.method === 'DELETE') {
      if (b.clear) {
        var all = await listItems('bookings');
        for (var i = 0; i < all.length; i++) {
          if (all[i].status === 'completed' || all[i].status === 'cancelled') await delItem('bookings', all[i].id);
        }
        return send(res, 200, { ok: true });
      }
      await delItem('bookings', String(b.id || ''));
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
