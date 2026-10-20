/* Booking requests.
   POST   public  { name, contact, email, occasion, notes, service, date, time, place }
                  name, contact, service, date and time required; service may
                  be several, joined with " · "; a time already taken on that
                  date is refused
                  `minutes` is how long the services take altogether, so the
                  booking holds every time it runs over
   GET    public  ?taken=1 -> { taken: [{ date, time, minutes }] }   dates as
                  YYYY-MM-DD, every booking that is not cancelled, nothing about who
   GET    studio  -> { items }
   PATCH  studio  { id, status }          pending | confirmed | completed | cancelled
   DELETE studio  { id }  or  { clear: true }   clear removes completed and cancelled

   Every request is also written to the history, which keeps a copy for good:
   a status change is mirrored there, and a delete first makes sure the copy
   exists, for bookings that came in before the history did.                 */

import { send, fail, body, clean, id } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems, getItem, putItem, delItem, keepInHistory } from '../lib/store.js';
import { notify, bookingText } from '../lib/notify.js';
import { timeToMinutes, overlaps } from '../lib/time.js';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

/* The times no one else can book: every booking still standing, as date and
   time only. A cancelled one frees its time again. */
function takenTimes(all) {
  return all.filter(function (x) { return x.status !== 'cancelled' && x.dateISO && x.time; })
    .map(function (x) { return { date: x.dateISO, time: x.time, minutes: x.minutes || 0 }; });
}

/* Would a booking at this date and time, for this long, run into one already
   standing? Times that cannot be read clash only when written the same way. */
function clashes(taken, item) {
  var start = timeToMinutes(item.time);
  return taken.some(function (t) {
    if (t.date !== item.dateISO) return false;
    if (t.time === item.time) return true;
    return overlaps(start, item.minutes, timeToMinutes(t.time), t.minutes);
  });
}

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
        service:  clean(b.service, 400),
        date:     clean(b.date, 60),
        dateISO:  /^\d{4}-\d{2}-\d{2}$/.test(String(b.dateISO || '')) ? String(b.dateISO) : '',
        time:     clean(b.time, 40),
        place:    clean(b.place, 60) || 'Studio',
        minutes:  Math.min(Math.max(Math.round(Number(b.minutes)) || 0, 0), 24 * 60)
      };
      if (!item.name || !item.contact || !item.service || !item.date || !item.time) {
        return fail(res, 400, 'Add a service, a date, a time, your name and a number to reach you on.');
      }
      /* two people on the page at once: the second to send loses the time */
      if (item.dateISO && clashes(takenTimes(await listItems('bookings')), item)) {
        return fail(res, 409, 'That time has just been taken on that date. Please pick another.');
      }
      await putItem('bookings', item);
      await putItem('history', item);
      await notify('New booking request from ' + item.name, bookingText(item));
      return send(res, 200, { ok: true, id: item.id });
    }

    if (req.method === 'GET' && (req.query || {}).taken) {
      return send(res, 200, { taken: takenTimes(await listItems('bookings')) });
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
      var past = await getItem('history', cur.id);
      if (past) { past.status = b.status; await putItem('history', past); }
      return send(res, 200, { ok: true, item: cur });
    }

    if (req.method === 'DELETE') {
      if (b.clear) {
        var all = await listItems('bookings');
        for (var i = 0; i < all.length; i++) {
          if (all[i].status === 'completed' || all[i].status === 'cancelled') {
            await keepInHistory(all[i]);
            await delItem('bookings', all[i].id);
          }
        }
        return send(res, 200, { ok: true });
      }
      await keepInHistory(await getItem('bookings', String(b.id || '')));
      await delItem('bookings', String(b.id || ''));
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
