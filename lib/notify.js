/* Tell Rosé something happened.

   WhatsApp (Twilio)  the reliable one. Official WhatsApp Business API.
                      Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
                      TWILIO_WHATSAPP_FROM and WHATSAPP_PHONE.
   WhatsApp (CallMeBot)  free hobby service, often slow or down. Set
                      CALLMEBOT_APIKEY and WHATSAPP_PHONE.
   Push (ntfy)        phone notification, no account. Set NTFY_TOPIC.
   Email (Resend)     set RESEND_API_KEY and NOTIFY_EMAIL.

   All optional. Whatever is configured gets sent. A failure is reported back
   to the panel's test button but never stops a booking from being saved. */

export function notifyConfigured() {
  return {
    whatsapp:  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
                  process.env.TWILIO_WHATSAPP_FROM && process.env.WHATSAPP_PHONE),
    callmebot: !!(process.env.WHATSAPP_PHONE && process.env.CALLMEBOT_APIKEY),
    push:      !!process.env.NTFY_TOPIC,
    email:     !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL)
  };
}

/* +1 869 555 0100 -> +18695550100 */
function e164(v) {
  var digits = String(v || '').replace(/[^\d]/g, '');
  return digits ? '+' + digits : '';
}

function waAddress(v) {
  var n = e164(v);
  return /^whatsapp:/.test(String(v)) ? String(v) : 'whatsapp:' + n;
}

async function whatsapp(subject, text) {
  var sid = process.env.TWILIO_ACCOUNT_SID;
  var form = new URLSearchParams({
    From: waAddress(process.env.TWILIO_WHATSAPP_FROM),
    To:   waAddress(process.env.WHATSAPP_PHONE),
    Body: subject + '\n\n' + text
  });
  var base = process.env.TWILIO_API_BASE || 'https://api.twilio.com';
  var r = await fetch(base + '/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form,
    signal: AbortSignal.timeout(10000)
  });
  var j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    var msg = j.message || ('Twilio replied ' + r.status);
    /* 63016 is the usual one: outside the 24-hour window, so a template is needed */
    if (j.code === 63016) msg += ' — send any message to your Twilio WhatsApp number to reopen the 24-hour window, or set up an approved template.';
    if (j.code === 63007) msg += ' — check TWILIO_WHATSAPP_FROM is the sandbox number in the form +14155238886.';
    throw new Error(msg);
  }
  if (j.status === 'failed' || j.status === 'undelivered') throw new Error('Twilio could not deliver it: ' + (j.error_message || j.status));
}

async function callmebot(subject, text) {
  var url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(e164(process.env.WHATSAPP_PHONE)) +
    '&apikey=' + encodeURIComponent(process.env.CALLMEBOT_APIKEY) +
    '&text=' + encodeURIComponent(subject + '\n' + text);
  var r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  var reply = (await r.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!r.ok) throw new Error('CallMeBot replied ' + r.status + (reply ? ': ' + reply.slice(0, 160) : ''));
  /* CallMeBot answers 200 with an error page when the key or number is wrong */
  if (/error|not allowed|invalid|apikey/i.test(reply)) throw new Error(reply.slice(0, 200));
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

const CHANNELS = { whatsapp: whatsapp, callmebot: callmebot, push: push, email: email };

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
