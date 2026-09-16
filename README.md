# ROSÉ Creative Artistry — website + studio panel

Plain HTML, CSS and JavaScript on the front, a handful of small Vercel
functions on the back. No framework, no build step.

## Files

| File | What's in it |
|---|---|
| `index.html` | The page shell: fonts, stylesheet, scripts. Almost nothing else. |
| `styles.css` | All styling. Colours and fonts are variables at the top under `:root`. |
| `content.js` | The words, services and lash list a fresh site starts with. Safe to edit. |
| `client.js` | Talks to the server. Decides whether the site is running on Vercel or from disk. |
| `app.js` | State, the six public pages, and the studio panel. |
| `api/` | The server: one file per thing (content, session, bookings, reviews, messages, upload, reset). |
| `lib/` | Shared server code: storage, login, photos, notifications. |
| `dev-server.js` | Runs the whole thing locally with an in-memory store. |
| `.github/workflows/deploy.yml` | Deploys every push to `main` to Vercel. |

## Running it

**Just the pages, no server.** Double-click `index.html`. Everything you do is
kept in that browser only. Handy for looking at the design.

**The real thing, locally.**

```
npm install
npm run dev
# open http://localhost:3000 — studio password is "rose"
```

The dev server runs the same functions Vercel does, but keeps everything in
memory (it forgets when you stop it) and stores photos inline instead of in
Blob storage.

## How it's put together

`app.js` holds a single `state` object:

```js
state = {
  page: 'home',        // which public page is showing, or 'admin'
  logged: false,       // signed into the studio panel
  section: 'bookings', // which panel section is open
  data: { ... },       // all site content
  flash: ''            // transient confirmation message
}
```

Every page is a function that returns an HTML string — `homePage()`,
`servicesPage()`, `panelBookings()` and so on. `render()` picks the right ones
for the current state and writes them into `#app`. Anything that changes state
calls `render()` again.

Clicks are wired with attributes, not inline handlers:

```html
<span class="btn" data-act="go:booking">BOOK APPOINTMENT</span>
```

One listener at the top of the page reads `data-act`, splits it on the first
colon, and calls the matching function in the `actions` object near the bottom
of `app.js`. `go:services#policies` opens a page and scrolls to an id.

Text fields carry `data-k="home.headline"` — a dotted path into `state.data`.
Typing saves; leaving the field re-renders. File inputs carry
`data-upload="services.0.img"` instead.

## Where things live

- **Add a public page** — write a `xxxPage()` function, add a line to `render()`,
  add a link in `nav()`.
- **Add a panel section** — add an entry to `SECTIONS` at the top of `app.js`,
  write a `panelXxx()` function, add it to the lookup object in `panel()`.
- **Change colours or type** — `:root` in `styles.css`.
- **Change the starting copy** — `content.js`.

## Saving, for real

On Vercel the site content, bookings, reviews and messages live on the
server, so the panel works from any device and visitors see what Rosé sets.
Half-filled forms are the only thing kept in the visitor's browser.

| Piece | Service | Set up by |
|---|---|---|
| Content + bookings + reviews + messages | Upstash Redis | Vercel project → Storage → Create → Upstash Redis |
| Photos | Vercel Blob | Vercel project → Storage → Create → Blob |
| Studio password | — | Environment variable `STUDIO_PASSWORD` |
| WhatsApp alerts | Twilio | The four `TWILIO_*` / `WHATSAPP_PHONE` variables below |
| WhatsApp alerts, free | CallMeBot | `WHATSAPP_PHONE` and `CALLMEBOT_APIKEY` |
| Phone alerts | ntfy | `NTFY_TOPIC` — no account needed |
| Email alerts | Resend | `RESEND_API_KEY` and `NOTIFY_EMAIL` |

A client can also tap **Message it on WhatsApp too** on the booking
confirmation, which opens their own WhatsApp with the booking written out.
That needs no API at all; set the studio's number in Settings → WhatsApp
number to switch it on.

The two storage add-ons set their own environment variables. After adding
any of these, redeploy (Actions → Deploy to Vercel → Run workflow).

Settings → Connections inside the panel shows what is connected, and
**Send a test alert** sends a real one and reports exactly what failed.

### Environment variables

| Name | What it is |
|---|---|
| `STUDIO_PASSWORD` | The panel password. Changing it signs everyone out. |
| `TWILIO_ACCOUNT_SID` | From the Twilio console home page. Starts with `AC`. |
| `TWILIO_AUTH_TOKEN` | Next to the SID on the same page. |
| `TWILIO_WHATSAPP_FROM` | The Twilio WhatsApp number. The sandbox one is `+14155238886`. |
| `WHATSAPP_PHONE` | Where alerts go: your own number with country code, e.g. `+18695550100`. Shared with CallMeBot. |
| `NTFY_TOPIC` | Any long, hard-to-guess name, e.g. `rose-studio-a7f3k9qz`. Install the ntfy app, subscribe to that exact name, and alerts arrive as phone notifications. Anyone who knows the name can read the alerts, so keep it long and private. |
| `NTFY_SERVER` | Optional. Defaults to `https://ntfy.sh`. |
| `CALLMEBOT_APIKEY` | From CallMeBot: send "I allow callmebot to send me messages" on WhatsApp to +34 644 10 93 63 and it replies with your key. CallMeBot is a free hobby service and is often slow or down. |
| `RESEND_API_KEY` | From resend.com → API Keys. |
| `NOTIFY_EMAIL` | Where alerts go. Without a verified domain, Resend only delivers to the address that owns the Resend account. |
| `NOTIFY_FROM` | Optional sender, once you have a verified domain in Resend. |

### The API

All JSON. "studio" means the session cookie from logging in is required.

| Route | Methods |
|---|---|
| `/api/session` | `GET` am I logged in · `POST {password}` · `DELETE` |
| `/api/content` | `GET` the site + published reviews · `PUT {content}` studio |
| `/api/bookings` | `POST` new request · `GET` studio · `PATCH {id,status}` studio · `DELETE {id}` or `{clear:true}` studio |
| `/api/reviews` | `GET` published (all, for studio) · `POST {name,text,img}` · `PATCH {id,published}` or `{id,featured:true}` studio · `DELETE {id}` studio |
| `/api/messages` | `POST` · `GET` studio · `DELETE {id}` studio |
| `/api/upload` | `POST {data}` studio → `{url}` |
| `/api/reset` | `POST` studio — wipes everything |
| `/api/notify-test` | `POST` studio — sends a test alert, reports per-channel results |

### Twilio WhatsApp, in short

1. Sign up at twilio.com and open Messaging → Try it out → Send a WhatsApp message.
2. The sandbox shows a number and a phrase like `join amber-tiger`. Send that
   phrase on WhatsApp from the phone that should receive alerts.
3. Copy the Account SID and Auth Token from the console home page.
4. Add the four variables above in Vercel and redeploy.
5. Studio panel → Settings → Send a test alert.

The sandbox drops a number that has been quiet for 72 hours, and free-form
messages only send inside 24 hours of your last message to it. Sending the
join phrase again fixes both. To remove that limit, apply for a WhatsApp
sender in Twilio and use an approved template.

## Not built yet

- a live calendar that blocks dates already taken
- payments / deposits
- a note back to the client when a booking is confirmed
