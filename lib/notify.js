/* Tell Rosé something happened.

   WhatsApp (Meta)    free and official. Meta's own WhatsApp Cloud API.
                      Set META_WA_TOKEN, META_WA_PHONE_ID and WHATSAPP_PHONE,
                      plus META_WA_TEMPLATE once an approved template exists.
   WhatsApp (Twilio)  also official, paid past the trial credit.
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
    metaWhatsapp: !!(process.env.META_WA_TOKEN && process.env.META_WA_PHONE_ID && process.env.WHATSAPP_PHONE),
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

/* Meta's Cloud API. Two shapes:
   - a template, which can be sent at any time and is what you want in the end
   - plain text, which Meta only allows within 24 hours of your last message
     to the business number. Handy for a first test, useless for quiet weeks. */
async function metaWhatsapp(subject, text) {
  var base = process.env.META_WA_API_BASE || 'https://graph.facebook.com';
  var version = process.env.META_WA_VERSION || 'v21.0';
  var to = e164(process.env.WHATSAPP_PHONE).replace(/^\+/, '');
  var tpl = process.env.META_WA_TEMPLATE;
  var payload;

  if (tpl) {
    /* Template parameters may not contain newlines, tabs, or long runs of
       spaces, so the body is flattened onto one line. */
    var flat = (subject + ' — ' + text).replace(/\s*\n+\s*/g, ' · ').replace(/ {2,}/g, ' ').trim();
    payload = {
      messaging_product: 'whatsapp', to: to, type: 'template',
      template: {
        name: tpl,
        language: { code: process.env.META_WA_LANG || 'en_US' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: flat.slice(0, 900) }] }]
      }
    };
  } else {
    payload = { messaging_product: 'whatsapp', to: to, type: 'text', text: { body: subject + '\n\n' + text } };
  }

  var r = await fetch(base + '/' + version + '/' + encodeURIComponent(process.env.META_WA_PHONE_ID) + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.META_WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  var j = {};
  try { j = await r.json(); } catch (e) {}
  if (!r.ok || j.error) {
    var err = j.error || {};
    var msg = err.message || ('Meta replied ' + r.status);
    if (err.code === 131047 || err.code === 131051) {
      msg += ' — outside the 24-hour window. Create an approved template and set META_WA_TEMPLATE, or message the business number from your phone first.';
    }
    if (err.code === 190) msg += ' — the access token has expired. A test token only lasts 24 hours; make a permanent System User token.';
    if (err.code === 132001) msg += ' — no template by that name in that language. Check META_WA_TEMPLATE and META_WA_LANG.';
    if (err.code === 131030) msg += ' — with a test number, the recipient must be added to the allowed list in the Meta dashboard first.';
    if (err.error_data && err.error_data.details) msg += ' (' + err.error_data.details + ')';
    throw new Error(msg);
  }
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

const CHANNELS = { metaWhatsapp: metaWhatsapp, whatsapp: whatsapp, callmebot: callmebot, push: push, email: email };

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
