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
| `app.js` | State, the public pages, and the studio panel. |
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
of `app.js`. `go:contact#hours` opens a page and scrolls to an id.

Text fields carry `data-k="home.headline"` — a dotted path into `state.data`.
Typing saves; leaving the field re-renders. File inputs carry
`data-upload="services.0.img"` instead.

## Where things live

- **Add a public page** — write a `xxxPage()` function, add a line to `render()`,
  add a link in `nav()`.
- **Photos** — `photo(url, label, natural)` in `app.js` renders every one. They
  are never cropped: the default fits the whole photo inside its frame, and
  `natural` lets the frame take the photo's own shape instead (the caller adds
  `auto` to the frame). The only places that crop are the round frames, where
  a fitted photo would leave gaps inside the circle: `.quick-icon`,
  `.svc-card-img` and `.meet-portrait`. Do not reintroduce `object-fit: cover`
  on any square or rectangular frame.
- **Cut-out slots** (the hero portrait and the book-with-us figure) fade their
  edges into the sand band, but only for a photo that still has a background.
  `isCutOut()` tells them apart by file type: an upload with see-through parts
  is kept as a PNG and left alone, an ordinary photo becomes a JPEG and is
  softened.
- **Gallery photos** — each is `{ url, tag }`, the tag being a service name.
  Tags drive the filter chips, and only tags that have photos are offered.
  Photos saved as plain strings by an older version are lifted on load.
- **Add a panel section** — add an entry to `SECTIONS` at the top of `app.js`,
  write a `panelXxx()` function, add it to the lookup object in `panel()`.
- **Change colours or type** — `:root` in `styles.css`.
- **Change the starting copy** — `content.js`.
- **Services and lash styles** are a plain list the panel adds to and deletes
  from, so nothing assumes there are four of them. Bookings record the service
  name, not its position, so deleting one leaves past bookings intact.
- **Policies** are `policiesPage()`, and they are deliberately not in the nav.
  A client meets them on the way to the booking form: `go('booking')` sends
  them to the policies first, once a visit, and `policiesRead` sets
  `state.readPolicies` and carries on to the form. Every route to the form goes
  through `go()`, so that one line covers the nav button, the service cards and
  every band on the site. **Agree & continue** sits at the top of the page,
  beside the title, so nobody has to scroll past eight policies to reach the
  form; the foot of the page offers a question instead. The form itself keeps a
  quiet link back, and Rosé reaches the page from the panel.
  The panel edits them in their own **Policies** section, which shows how many
  are ready to be seen. Each policy is `{ title, text, img }` — typed out,
  photographed, or both — and
  renders as a numbered piece with a sticky index down the side that marks
  whichever one is being read. They run in two columns on a wide screen and
  one below 1100px — CSS columns rather than a grid, since a policy with a
  photograph is far taller than one without and a grid would leave the space
  beside it empty. A heading on its own is one she has not written
  yet, so it stays off the site; with none written at all the booking form
  opens straight away. A list of headings saved by the short-lived first
  version, with nothing written into any of them, is replaced on load by the
  headings in `content.js`; anything she has written is never touched. Policies saved as a single block of text by an older
  version are split on their blank lines on load.

## Saving, for real

On Vercel the site content, bookings, reviews and messages live on the
server, so the panel works from any device and visitors see what Rosé sets.
Half-filled forms are the only thing kept in the visitor's browser.

| Piece | Service | Set up by |
|---|---|---|
| Content + bookings + reviews + messages | Upstash Redis | Vercel project → Storage → Create → Upstash Redis |
| Photos | Vercel Blob | Vercel project → Storage → Create → Blob |
| Studio password | — | Environment variable `STUDIO_PASSWORD` |
| WhatsApp alerts | Meta WhatsApp Cloud API | Free and official. `META_WA_TOKEN`, `META_WA_PHONE_ID`, `WHATSAPP_PHONE` |
| WhatsApp alerts | Twilio | Paid past the trial. The four `TWILIO_*` / `WHATSAPP_PHONE` variables below |
| WhatsApp alerts, free | CallMeBot | `WHATSAPP_PHONE` and `CALLMEBOT_APIKEY` |
| Phone alerts | ntfy | `NTFY_TOPIC` — no account needed |
| Email alerts | Resend | `RESEND_API_KEY` and `NOTIFY_EMAIL` |

Two WhatsApp routes need no API at all, and both key off the studio's number
in Settings → WhatsApp number:

- A client can tap **Message it on WhatsApp too** on the booking confirmation,
  which opens their own WhatsApp with the booking written out.
- Every booking in the panel carries a green WhatsApp button that opens a
  message to that client, worded to match the booking's status. A number typed
  without a country code borrows the leading digits from the studio's own
  number, so a local 555 0177 is dialled in full.

The two storage add-ons set their own environment variables. After adding
any of these, redeploy (Actions → Deploy to Vercel → Run workflow).

Settings → Connections inside the panel shows what is connected, and
**Send a test alert** sends a real one and reports exactly what failed.

### Environment variables

| Name | What it is |
|---|---|
| `STUDIO_PASSWORD` | The panel password. Changing it signs everyone out. |
| `META_WA_TOKEN` | Meta access token. A test token dies after 24 hours; a System User token does not. |
| `META_WA_PHONE_ID` | The Phone number ID from the WhatsApp → API Setup page. Not the phone number itself. |
| `META_WA_TEMPLATE` | Name of an approved template, e.g. `new_booking`. Without it, alerts only send inside the 24-hour window. |
| `META_WA_LANG` | Template language code. Defaults to `en_US`. |
| `TWILIO_ACCOUNT_SID` | From the Twilio console home page. Starts with `AC`. |
| `TWILIO_AUTH_TOKEN` | Next to the SID on the same page. |
| `TWILIO_WHATSAPP_FROM` | The Twilio WhatsApp number. The sandbox one is `+14155238886`. |
| `WHATSAPP_PHONE` | Where alerts go: your own number with country code, e.g. `+18695550100`. Shared with CallMeBot. |
| `NTFY_TOPIC` | Any long, hard-to-guess name, e.g. `rose-studio-a7f3k9qz`. Install the ntfy app, subscribe to that exact name, and alerts arrive as phone notifications. Anyone who knows the name can read the alerts, so keep it long and private. |
| `NTFY_SERVER` | Optional. Defaults to `https://ntfy.sh`. |
| `CALLMEBOT_APIKEY` | From CallMeBot. Its bot number rotates and is only published at callmebot.com/blog/free-api-whatsapp-messages, so read it there rather than from any number written down here. Save that number as a contact, send it "I allow callmebot to send me messages", and it replies with your key. It is a free hobby project that caps how many people it serves, so the number is sometimes hidden and signups closed. Treat it as a bonus, not the channel you rely on. |
| `RESEND_API_KEY` | From resend.com → API Keys. |
| `NOTIFY_EMAIL` | Where alerts go. Without a verified domain, Resend only delivers to the address that owns the Resend account. |
| `NOTIFY_FROM` | Optional sender, once you have a verified domain in Resend. |

### The API

All JSON. "studio" means the session cookie from logging in is required.

| Route | Methods |
|---|---|
| `/api/session` | `GET` am I logged in · `POST {password}` · `DELETE` |
| `/api/content` | `GET` the site + published reviews · `PUT {content}` studio |
| `/api/bookings` | `POST` new request (name, contact, service, date and time required) · `GET` studio · `PATCH {id,status}` studio · `DELETE {id}` or `{clear:true}` studio |
| `/api/reviews` | `GET` published (all, for studio) · `POST {name,text,img}` · `PATCH {id,published}` or `{id,featured:true}` studio · `DELETE {id}` studio |
| `/api/messages` | `POST` (name, phone and message required) · `GET` studio · `DELETE {id}` studio |
| `/api/upload` | `POST {data}` studio → `{url}` |
| `/api/reset` | `POST` studio — wipes everything |
| `/api/notify-test` | `POST` studio — sends a test alert, reports per-channel results |

### Meta WhatsApp Cloud API, in short

Free, official, and it does not expire the way a hobby service does.

1. At developers.facebook.com create an app, type **Business**, and add the
   **WhatsApp** product.
2. On WhatsApp → API Setup, copy the **Phone number ID** and add your own
   number under **To**. A test number only sends to numbers on that list.
3. Set `META_WA_TOKEN`, `META_WA_PHONE_ID` and `WHATSAPP_PHONE`, redeploy,
   and use Settings → Send a test alert. The temporary token on that page
   works for 24 hours, which is enough to prove it end to end.
4. For alerts that keep working, two things have to be permanent:
   - **A lasting token.** Business Settings → Users → System users → add one,
     give it the app, generate a token with `whatsapp_business_messaging`.
   - **A template.** WhatsApp Manager → Templates → Create, category
     **Utility**, body `New booking: {{1}}`. Utility templates are usually
     approved within minutes. Put its name in `META_WA_TEMPLATE`.

Without a template, Meta only accepts a message within 24 hours of you
messaging the business number, so quiet weeks would silently drop alerts.
The panel's test button names this error when it happens.

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

### The booking calendar

Dates are held as `YYYY-MM-DD`, so a choice keeps its month. The arrows move
between months, today is the earliest date that can be picked, and
`MONTHS_AHEAD` in `app.js` caps how far forward bookings open (six months).
Past days render dimmed with no click handler. The week starts on Monday to
match `DAYS` in `content.js`. A booking carries both a readable `date`
("5 October 2026") and a sortable `dateISO`.

## Not built yet

- blocking dates and times that are already taken
- payments / deposits
- automatic email to the client (needs a domain of your own, since a shared
  sender only delivers to the account owner)
