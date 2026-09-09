# ROSÉ Creative Artistry — website + studio panel

Plain HTML, CSS and JavaScript. No build step, no npm install, no framework.
Open `index.html` in any browser and it runs.

## Files

| File | What's in it |
|---|---|
| `index.html` | The page shell: fonts, stylesheet, scripts. Almost nothing else. |
| `styles.css` | All styling. Colours and fonts are variables at the top under `:root`. |
| `content.js` | The words, services and lash list a fresh site starts with. Safe to edit. |
| `app.js` | State, the six public pages, and the studio panel. |

## Running it

Double-click `index.html`. That's it.

If you'd rather serve it (needed if you later add fetch calls or images from disk):

```
cd rose-site
python3 -m http.server 8000
# then open http://localhost:8000
```

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
colon, and calls the matching function in the `actions` object at the bottom of
`app.js`.

Text fields carry `data-k="home.headline"` — a dotted path into `state.data`.
Typing saves; leaving the field re-renders. File inputs carry
`data-upload="services.0.img"` instead.

## Where things live

- **Add a public page** — write a `xxxPage()` function, add a line to `render()`,
  add a `<span class="nav-link" data-act="go:xxx">` in `nav()`.
- **Add a panel section** — add an entry to `SECTIONS` at the top of `app.js`,
  write a `panelXxx()` function, add it to the lookup object in `panel()`.
- **Change colours or type** — `:root` in `styles.css`.
- **Change the starting copy** — `content.js`.

## Saving

Everything the studio panel edits is saved to the browser's `localStorage`
under the key `rose-studio-v1`. That means:

- it survives refreshes and closing the browser
- it does **not** travel between devices or browsers
- uploaded photos are stored as compressed data URLs (shrunk to 1200px max)

The login is a demo — any email and password get you in. There is no server and
no real authentication. When this goes live, bookings, reviews, messages and
photos need a backend; `localStorage` is a stand-in so the whole flow can be
tried out now.

## Not built yet

- real sign-in
- email or WhatsApp notifications when a booking comes in
- a live calendar that blocks dates already taken
- payments / deposits
