/* Tell Rosé something happened.

   WhatsApp — CallMeBot, a free service that messages your own number.
              Set WHATSAPP_PHONE (with country code) and CALLMEBOT_APIKEY.
   Email    — Resend. Set RESEND_API_KEY and NOTIFY_EMAIL.
              Without a verified domain, Resend only delivers to the address
              that owns the Resend account, so use that one.

   Both are optional. Whatever is configured gets sent; failures are logged
   and never stop a booking from being saved. */

export function notifyConfigured() {
  return {
    whatsapp: !!(process.env.WHATSAPP_PHONE && process.env.CALLMEBOT_APIKEY),
    email:    !!(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL)
  };
}

async function whatsapp(text) {
  var phone = String(process.env.WHATSAPP_PHONE).replace(/[^\d+]/g, '');
  var url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
    '&apikey=' + encodeURIComponent(process.env.CALLMEBOT_APIKEY) +
    '&text=' + encodeURIComponent(text);
  var r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('CallMeBot ' + r.status);
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
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

export async function notify(subject, text) {
  var c = notifyConfigured();
  var jobs = [];
  if (c.whatsapp) jobs.push(whatsapp(subject + '\n' + text).catch(function (e) { console.error('whatsapp failed:', e.message); }));
  if (c.email)    jobs.push(email(subject, text).catch(function (e) { console.error('email failed:', e.message); }));
  await Promise.all(jobs);
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
