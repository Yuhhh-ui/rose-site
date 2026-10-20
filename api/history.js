/* Every booking request ever made, kept even after the booking itself is
   cleared from the Bookings section. Written by api/bookings.js; nothing
   deletes from it short of Settings → Clear everything.
   GET    studio  -> { items }   newest first
   POST   studio  { name, contact, email, service, dateISO (YYYY-MM-DD), time, place, status, notes }
                  a past booking typed in by hand; name and date required
   DELETE studio  { id }         only one that was added by hand                 */

import { send, fail, body, clean, id } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems, getItem, putItem, delItem, keepInHistory } from '../lib/store.js';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* '2026-10-05' -> '5 October 2026', the way bookings carry their date */
function pretty(iso) {
  var p = iso.split('-');
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

export default async function handler(req, res) {
  try {
    if (!loggedIn(req)) return fail(res, 401, 'Please sign in.');
    var b = body(req);

    if (req.method === 'GET') {
      /* bookings from before the history existed are copied in the first time it is read */
      var live = await listItems('bookings');
      for (var i = 0; i < live.length; i++) await keepInHistory(live[i]);
      return send(res, 200, { items: await listItems('history') });
    }

    if (req.method === 'POST') {
      /* the panel sends the date both ways; either spelling of YYYY-MM-DD will do */
      var iso = [b.dateISO, b.date].map(function (v) { return String(v || ''); })
        .filter(function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v); })[0] || '';
      var item = {
        id: id('h'), manual: true,
        status:   STATUSES.indexOf(b.status) >= 0 ? b.status : 'completed',
        name:     clean(b.name, 120),
        contact:  clean(b.contact, 120),
        email:    clean(b.email, 160),
        occasion: '',
        notes:    clean(b.notes, 2000),
        service:  clean(b.service, 120),
        date:     iso ? pretty(iso) : '',
        dateISO:  iso,
        time:     clean(b.time, 40),
        place:    clean(b.place, 60) || 'Studio'
      };
      if (!item.name || !iso) return fail(res, 400, 'A name and the date of the appointment are needed.');
      /* dated by the appointment, so it sits in the right place in the list */
      item.at = new Date(iso + 'T12:00:00').getTime();
      await putItem('history', item);
      return send(res, 200, { ok: true, item: item });
    }

    if (req.method === 'DELETE') {
      var cur = await getItem('history', String(b.id || ''));
      if (!cur) return fail(res, 404, 'Not found');
      if (!cur.manual) return fail(res, 400, 'Only a booking added by hand can be removed from the history.');
      await delItem('history', cur.id);
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
