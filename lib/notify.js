/* Tell Rosé something happened.

   Push (ntfy)  the simple one. Set NTFY_TOPIC to a long, private-ish name.
                Install the ntfy app, subscribe to that topic, and alerts
                arrive as normal phone notifications. No account, no key.
   WhatsApp     CallMeBot. Free hobby service, so it is often slow or down.
                Set WHATSAPP_PHONE (with country code) and CALLMEBOT_APIKEY.
   Email        Resend. Set RESEND_API_KEY and NOTIFY_EMAIL.
                Without a verified domain, Resend only delivers to the address
                that owns the Resend account.

   All optional. Whatever is configured gets sent. A failure is reported back
   to the panel's test button but never stops a booking from being saved. */

export function notifyConfigured() {
  return {
    push:     !!process.env.NTFY_TOPIC,
    whatsapp: !!(process.env.WHATSAPP_PHONE && process.env.CALLMEBOT_APIKEY),
    email:    !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL)
  };
}

async function push(subject, text) {
  var server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  var r = await fetch(server + '/' + encodeURIComponent(process.env.NTFY_TOPIC), {
    method: 'POST',
    headers: { 'Title': subject.replace(/[^\x20-\x7E]/g, ''), 'Tags': 'lipstick', 'Priority': 'high' },
    body: text,
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error('ntfy replied ' + r.status);
}

async function whatsapp(subject, text) {
  var phone = String(process.env.WHATSAPP_PHONE).replace(/[^\d+]/g, '');
  var url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
    '&apikey=' + encodeURIComponent(process.env.CALLMEBOT_APIKEY) +
    '&text=' + encodeURIComponent(subject + '\n' + text);
  var r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  var reply = (await r.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!r.ok) throw new Error('CallMeBot replied ' + r.status + (reply ? ': ' + reply.slice(0, 160) : ''));
  /* CallMeBot answers 200 with an error page when the key or number is wrong */
  if (/error|not allowed|invalid|apikey/i.test(reply)) throw new Error(reply.slice(0, 200));
}

async function email(subject, text) {
  var r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'ROSÉ Studio <onboarding@resend.dev>',
      to: [process.env.NOTIFY_EMAIL],
      subject: subject,
      text: text
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!r.ok) throw new Error('Resend replied ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

const CHANNELS = { push: push, whatsapp: whatsapp, email: email };

/* Sends on every configured channel. Returns one result per channel, so the
   panel's test button can show exactly what went wrong. */
export async function notify(subject, text) {
  var on = notifyConfigured();
  var names = Object.keys(CHANNELS).filter(function (n) { return on[n]; });
  return Promise.all(names.map(function (n) {
    return CHANNELS[n](subject, text)
      .then(function () { return { channel: n, ok: true }; })
      .catch(function (e) {
        console.error(n + ' alert failed:', e.message);
        return { channel: n, ok: false, error: e.message };
      });
  }));
}

/* message bodies */
export function bookingText(b) {
  return [
    'Name: ' + b.name,
    'Service: ' + b.service,
    'When: ' + b.date + ' at ' + b.time,
    'Where: ' + b.place,
    'Contact: ' + (b.contact || '—') + (b.email ? ' · ' + b.email : ''),
    b.occasion ? 'Occasion: ' + b.occasion : '',
    b.notes ? 'Notes: ' + b.notes : '',
    '',
    'Confirm it in the studio panel.'
  ].filter(function (l) { return l !== ''; }).join('\n');
}
