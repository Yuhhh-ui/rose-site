/* Reading the times and lengths Rosé types into the panel.
   The same two readers live in app.js for the booking page; keep them alike.

   timeToMinutes('9:00 am') -> 540, '2:30 pm' -> 870, '14:30' -> 870, '9pm' -> 1260,
   or null when it cannot be read.
   durationMinutes('90 min') -> 90, '1 hr 30 min' -> 90, '1.5 hours' -> 90, '2h' -> 120,
   '45' -> 45, or 0 when it cannot be read.                                        */

export function timeToMinutes(str) {
  var m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(String(str || ''));
  if (!m) return null;
  var h = Number(m[1]), min = Number(m[2] || 0), ap = (m[3] || '').toLowerCase();
  if (h > 23 || min > 59) return null;
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return h * 60 + min;
}

export function durationMinutes(str) {
  var s = String(str || '').toLowerCase();
  var hours = /(\d+(?:[.,]\d+)?)\s*(?:h(?![a-z])|hr|hour)/.exec(s);
  var mins  = /(\d+)\s*(?:m\b|min)/.exec(s);
  if (!hours && !mins) {
    var bare = /^\s*(\d+)\s*$/.exec(s);           // a number on its own is minutes
    return bare ? Number(bare[1]) : 0;
  }
  var total = 0;
  if (hours) total += Math.round(Number(hours[1].replace(',', '.')) * 60);
  if (mins)  total += Number(mins[1]);
  return total;
}

/* Does an appointment at `start` for `minutes` run into one at `otherStart`
   for `otherMinutes`? A length of 0 still holds its own starting time. Times
   that cannot be read only clash when written the same way. */
export function overlaps(start, minutes, otherStart, otherMinutes) {
  if (start == null || otherStart == null) return false;
  var end = start + Math.max(minutes || 0, 1), otherEnd = otherStart + Math.max(otherMinutes || 0, 1);
  return start < otherEnd && otherStart < end;
}
