/* ==========================================================================
   ROSÉ Creative Artistry — app logic
   Plain JavaScript. No build step, no libraries.

   How it works
   ------------
   state          current page + all saved content
   render()       rebuilds #app from state, called after every change
   api/           on Vercel, content and the inbox live on the server (see client.js);
                  opened from disk, everything is kept in this browser instead

   Adding a page:  write a xxxPage() function, then add it to render().
   Adding a panel section:  add it to SECTIONS and write a section function.
   ========================================================================== */

var KEY = 'rose-studio-v1';

var SECTIONS = {
  bookings:     'Bookings',
  availability: 'Availability',
  services:     'Services & prices',
  policies:     'Policies',
  portfolio:    'Portfolio',
  pages:        'Website content',
  reviews:      'Reviews',
  clients:      'Clients',
  messages:     'Messages',
  settings:     'Settings'
};

var state = {
  page: 'home',        // home | services | artist | reviews | booking | contact | admin
  logged: false,       // signed into the studio panel
  section: 'bookings', // which panel section is open
  data: null,          // all site content — see content.js
  flash: '',           // transient confirmation message
  setup: null,         // what the server has connected (storage, photos, whatsapp, email)
  loginError: '',      // shown on the login page
  saveNote: '',        // "Saving…" / "Saved" in the panel header
  storageError: '',    // set when the server has no storage connected yet
  gal: { filter: 'All', open: false, i: 0 },   // gallery filter and lightbox
  calOffset: 0,        // months ahead of this one shown on the booking calendar
  booked: null,        // the request just sent, shown as a confirmation
  sending: false,      // a booking is on its way to the server
  inboxAt: 0,          // when bookings, reviews and messages were last fetched
  notifyTest: null,    // result of Settings → Send a test alert
  lastBooking: null,   // the booking just sent, for the WhatsApp link on the confirmation
  readPolicies: false, // the policies have been shown on the way to the form this visit
  polAt: null,         // a policy picked from the index, while it is still on screen
  polAtAt: 0           // when it was picked, to ride out the scroll to it
};

/* --- storage ------------------------------------------------------------ */

/* Two modes, chosen in client.js:
   API.remote  content and the inbox live on the server; only half-filled
               forms are kept in this browser.
   local       everything lives in this browser under KEY (opening index.html
               straight from disk, or a server without an API).            */

var KEY = 'rose-studio-v1';
var FORMS_KEY = 'rose-forms-v1';
var CONTENT_KEYS = ['home', 'artist', 'services', 'lashes', 'policies', 'gallery', 'hours', 'brand'];
var FORM_KEYS = ['form', 'rform', 'cform'];

function blank() { return JSON.parse(JSON.stringify(DEFAULT_CONTENT)); }

/* lay saved values over the defaults, one level deep for the nested objects */
function applySaved(saved) {
  if (!saved) return;
  state.data = Object.assign(state.data, saved);
  ['home', 'artist', 'brand'].forEach(function (k) {
    if (saved[k]) state.data[k] = Object.assign(blank()[k], saved[k]);
  });
  normaliseGallery();
  normalisePolicies();
}

function loadLocal() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) applySaved(JSON.parse(raw));
  } catch (e) { /* private browsing, corrupt data — start blank */ }
}

function restoreForms() {
  try {
    var raw = localStorage.getItem(FORMS_KEY);
    if (raw) applySaved(JSON.parse(raw));
  } catch (e) {}
  /* dates used to be stored as a bare day number; ignore anything that old */
  if (state.data.form && !isIso(state.data.form.date)) state.data.form.date = '';
}

/* Photos used to be plain URL strings and are now { url, tag }.
   Anything saved in the old shape is lifted on load so nothing is lost. */
function normaliseGallery() {
  if (!Array.isArray(state.data.gallery)) { state.data.gallery = []; return; }
  state.data.gallery = state.data.gallery.map(function (g) {
    return typeof g === 'string' ? { url: g, tag: '' } : { url: (g && g.url) || '', tag: (g && g.tag) || '' };
  }).filter(function (g) { return g.url; });
}

var OLD_POLICY_HEADINGS = ['Deposits', 'Cancellations', 'Travel', 'How to prep'];

/* Policies used to be one block of text and are now a list of
   { title, text, img }. An old block is split on its blank lines so nothing
   written before is lost, and a site that never had any starts from the
   headings in content.js rather than from nothing at all. */
function normalisePolicies() {
  var p = state.data.policies;
  if (typeof p === 'string') {
    var paras = p.split(/\n\s*\n/).map(function (para) {
      return { title: '', text: para.trim(), img: '' };
    }).filter(function (x) { return x.text; });
    state.data.policies = paras.length ? paras : blank().policies;
    return;
  }
  if (!Array.isArray(p)) { state.data.policies = blank().policies; return; }
  var list = p.map(function (x) {
    return { title: (x && x.title) || '', text: (x && x.text) || '', img: (x && x.img) || '' };
  });
  /* A short-lived earlier version saved these four headings with nothing in
     them. Untouched, they are a leftover default rather than her work, so the
     headings the site ships with now take their place. */
  var stale = list.length === OLD_POLICY_HEADINGS.length &&
    list.every(function (x, i) { return !x.text && !x.img && x.title === OLD_POLICY_HEADINGS[i]; });
  state.data.policies = stale ? blank().policies : list;
}

/* Only the ones with something on them — words, a picture, or both — reach
   the website. A heading on its own is one she has not got to yet. */
function livePolicies() {
  return (state.data.policies || []).filter(function (p) { return p.text || p.img; });
}

function pick(keys) {
  var out = {};
  keys.forEach(function (k) { out[k] = state.data[k]; });
  return out;
}

/* the forms only: kept in this browser so a half-filled form survives a refresh */
function saveForms() {
  try { localStorage.setItem(API.remote ? FORMS_KEY : KEY, JSON.stringify(API.remote ? pick(FORM_KEYS) : state.data)); } catch (e) {}
}

/* the site content changed: push it to the server (a moment after typing stops), or keep it here */
var pushTimer = null;
function save() {
  if (!API.remote) { saveForms(); return; }
  if (!state.logged) return;
  clearTimeout(pushTimer);
  setSaveNote('Saving…');
  pushTimer = setTimeout(pushContent, 700);
}

function pushContent() {
  API.put('/api/content', { content: pick(CONTENT_KEYS) })
    .then(function () { setSaveNote('Saved'); })
    .catch(function (e) { setSaveNote('Not saved — ' + e.message); });
}

/* update the note in the panel header without re-rendering, so typing is not interrupted */
function setSaveNote(text) {
  state.saveNote = text;
  var el = document.querySelector('.main-note');
  if (el) el.textContent = text;
}

/* bookings, reviews and messages for the panel */
/* Panel sections that show things clients sent in, so they go stale on their own. */
var INBOX_SECTIONS = { bookings: 1, reviews: 1, messages: 1, clients: 1 };
var inboxTimer = null;
var inboxBusy = false;

/* quiet: a background check, so a hiccup does not throw an error on screen */
function loadInbox(quiet) {
  if (inboxBusy) return Promise.resolve();
  inboxBusy = true;
  return Promise.all([API.get('/api/bookings'), API.get('/api/reviews'), API.get('/api/messages')])
    .then(function (r) {
      state.data.bookings = r[0].items;
      state.data.reviews  = r[1].items;
      state.data.messages = r[2].items;
      state.inboxAt = Date.now();
      render();
    })
    .catch(function (e) { if (!quiet) flash('inbox-error:' + e.message); })
    .then(function () { inboxBusy = false; });
}

/* While an inbox section is open, look for new bookings without being asked.
   Content sections are left alone so a check never interrupts typing. */
function watchInbox() {
  clearInterval(inboxTimer);
  inboxTimer = null;
  if (!API.remote || !state.logged || state.page !== 'admin') return;
  if (!INBOX_SECTIONS[state.section]) return;
  inboxTimer = setInterval(function () {
    if (document.visibilityState === 'visible') loadInbox(true);
  }, 45000);
}

function ago(t) {
  if (!t) return 'not yet';
  var s = Math.round((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + ' seconds ago';
  var m = Math.round(s / 60);
  return m <= 1 ? 'a minute ago' : m + ' minutes ago';
}

/* first load */
function boot() {
  state.data = blank();
  if (!API.remote) { loadLocal(); render(); return; }
  restoreForms();
  API.get('/api/session')
    .then(function (ses) {
      state.logged = !!ses.logged;
      state.setup = ses.setup || null;
      state.loginConfigured = ses.configured;
      return API.get('/api/content')
        .then(function (c) {
          applySaved(c.content);
          if (!state.logged) state.data.reviews = c.reviews || [];
        })
        .catch(function (e) {
          /* the server is there but storage is not connected yet: show the defaults and say so in the panel */
          state.storageError = e.message;
        })
        .then(function () {
          render();
          if (state.logged) { loadInbox(); watchInbox(); }
        });
    })
    .catch(function () {
      /* no API behind this server (a plain static host) — behave like a local copy */
      API.remote = false;
      loadLocal();
      render();
    });
}

/* --- small helpers ------------------------------------------------------ */

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(v) {
  if (!v) return 'Price on request';
  v = String(v).trim();
  return v.charAt(0) === '$' ? v : '$' + v;
}

/* A picture kept as a PNG is one that had see-through parts, so it is already
   cut out and needs no help blending. A JPEG came from a camera and carries
   whatever wall was behind the subject. */
function isCutOut(url) {
  return /^data:image\/png/i.test(url) || /\.png(\?|$)/i.test(url);
}

/* Photo frame contents: the image, or a labelled placeholder.

   Nothing is ever cropped. A normal photo is fitted whole inside its frame,
   so a tall portrait in a wide slot shows the full picture with a little of
   the frame either side. Pass natural = true and the frame takes the photo's
   own shape instead, leaving no space around it at all; the caller adds the
   "auto" class to the frame to release its fixed shape. */
function photo(url, label, natural) {
  if (url) {
    return '<img class="' + (natural ? 'shot' : 'fill') + '" src="' + esc(url) + '" alt="">';
  }
  return '<div class="ph"><span class="ph-label">' + esc(label || '') + '</span></div>';
}

function getPath(path) {
  return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state.data);
}

function setPath(path, val) {
  var ks = path.split('.'), o = state.data;
  for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
  if (FORM_KEYS.indexOf(ks[0]) >= 0) saveForms(); else save();
}

/* --- the booking calendar ------------------------------------------------
   Dates are held as 'YYYY-MM-DD' so a choice keeps its month. Clients can
   look ahead but never behind: today is the earliest date, and MONTHS_AHEAD
   caps how far forward the arrows go. */

var MONTHS_AHEAD = 6;

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function isoDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }

function isIso(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }

/* midnight today, so "is this in the past" ignores the time of day */
function todayStart() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function isoToDate(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/* '2026-10-05' -> '5 October 2026' */
function prettyDate(iso) {
  if (!isIso(iso)) return '';
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

/* the month on screen, as an offset in months from this one */
function calMonth() {
  var off = Math.min(Math.max(state.calOffset || 0, 0), MONTHS_AHEAD);
  var n = new Date();
  var first = new Date(n.getFullYear(), n.getMonth() + off, 1);
  return {
    y: first.getFullYear(),
    m: first.getMonth(),
    offset: off,
    label: MONTHS[first.getMonth()] + ' ' + first.getFullYear(),
    days: new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    /* DAYS starts on Monday, so shift Sunday-first getDay() to match */
    lead: (first.getDay() + 6) % 7
  };
}

function calendar() {
  var c = calMonth(), today = todayStart(), chosen = state.data.form.date;

  var out = DAYS.map(function (day) {
    return '<span class="cal-head">' + esc(day.slice(0, 3)) + '</span>';
  }).join('');

  for (var i = 0; i < c.lead; i++) out += '<span class="cal-blank"></span>';

  for (var d = 1; d <= c.days; d++) {
    var iso = isoDate(c.y, c.m, d);
    var day = new Date(c.y, c.m, d);
    var past = day < today;
    var cls = 'cal-day' +
      (past ? ' past' : '') +
      (day.getTime() === today.getTime() ? ' today' : '') +
      (chosen === iso ? ' sel' : '');
    out += past
      ? '<span class="' + cls + '" aria-disabled="true">' + d + '</span>'
      : '<span class="' + cls + '" data-act="day:' + iso + '">' + d + '</span>';
  }

  var back = c.offset > 0
    ? '<span class="cal-nav" data-act="month:-1" title="Previous month">‹</span>'
    : '<span class="cal-nav off" title="This is the earliest month">‹</span>';
  var fwd = c.offset < MONTHS_AHEAD
    ? '<span class="cal-nav" data-act="month:1" title="Next month">›</span>'
    : '<span class="cal-nav off" title="Bookings open ' + MONTHS_AHEAD + ' months ahead">›</span>';

  return '<div class="cal-top">' + back +
      '<span class="cal-label">' + esc(c.label) + '</span>' + fwd +
    '</div>' +
    '<div class="cal">' + out + '</div>' +
    (isIso(chosen)
      ? '<p class="cal-chosen">Chosen: ' + esc(prettyDate(chosen)) + '</p>'
      : '<p class="cal-chosen dim">No date chosen yet</p>');
}

function flash(msg) {
  state.flash = msg;
  render();
  if (msg === 'sending' || msg === 'signing-in') return;
  setTimeout(function () {
    if (state.flash === msg) { state.flash = ''; render(); }
  }, msg.indexOf('error') >= 0 ? 6000 : 2600);
}

/* the text behind a flash like "send-error:Storage is not connected" */
function flashText(prefix) {
  return state.flash.indexOf(prefix + ':') === 0 ? state.flash.slice(prefix.length + 1) : '';
}

/* go('contact', 'hours') opens a page and scrolls to the element with that id */
/* The policies are read on the way to booking, once a visit. Every route to
   the form comes through here — the nav button, the service cards, the bands
   at the foot of each page — so there is one place to send them via the
   policies, and one flag that says they have been seen. */
function go(page, anchor) {
  if (page === 'booking' && !state.readPolicies && livePolicies().length) page = 'policies';
  if (page !== 'booking') state.booked = null;
  if (page !== 'gallery') state.gal.open = false;
  state.page = page;
  state.flash = '';
  render();
  /* opening the panel should show what has come in since the page loaded */
  if (page === 'admin' && state.logged && API.remote) loadInbox(true);
  watchInbox();
  var el = anchor ? document.getElementById(anchor) : null;
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}

function goSection(sec) {
  state.section = sec;
  state.flash = '';
  state.saveNote = '';
  render();
  if (API.remote && state.logged && INBOX_SECTIONS[sec]) loadInbox(true);
  watchInbox();
  window.scrollTo(0, 0);
}

function liveServices() {
  return state.data.services
    .map(function (s, i) { return { s: s, i: i }; })
    .filter(function (x) { return x.s.live; });
}

function featuredReview() {
  var rs = state.data.reviews;
  return rs.filter(function (r) { return r.published && r.featured; })[0] ||
         rs.filter(function (r) { return r.published; })[0] || null;
}

/* =========================================================================
   PUBLIC SITE
   ========================================================================= */

function nav() {
  function link(page, label) {
    return '<span class="nav-link' + (state.page === page ? ' active' : '') + '" data-act="go:' + page + '">' + label + '</span>';
  }
  return '' +
  '<header class="nav">' +
    '<div class="brand" data-act="go:home">' +
      '<span class="brand-name">ROSÉ</span>' +
      '<span class="brand-sub">CREATIVE ARTISTRY</span>' +
    '</div>' +
    '<nav class="nav-links">' +
      link('home', 'HOME') +
      link('services', 'SERVICES') +
      link('gallery', 'GALLERY') +
      link('artist', 'THE ARTIST') +
      link('reviews', 'REVIEWS') +
      link('contact', 'CONTACT') +
      '<span class="nav-book" data-act="go:booking">BOOK</span>' +
    '</nav>' +
  '</header>';
}

/* homepage quick links — page, label, and a 24x24 line icon */
var QUICK_LINKS = [
  { to: 'artist',       label: 'THE ARTIST',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>' },
  { to: 'services',     label: 'SERVICES',
    icon: '<path d="M15 3.5 8 15"/><path d="M18.5 5.5 11.5 17"/><path d="M15 3.5a2 2 0 0 1 3.5 2"/><path d="M8 15c-2 1-2.5 4-2.5 5.5C7 20 10 19.5 11.5 17"/>' },
  { to: 'gallery',      label: 'PORTFOLIO',
    icon: '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/>' },
  { to: 'reviews',      label: 'REVIEWS',
    icon: '<path d="m12 3.6 2.5 5.3 5.5.8-4 4.1 1 5.9-5-2.9-5 2.9 1-5.9-4-4.1 5.5-.8Z"/>' },
  { to: 'booking',      label: 'BOOKING',
    icon: '<rect x="3.5" y="5" width="17" height="15.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>' },
  { to: 'contact',      label: 'CONTACT',
    icon: '<rect x="3" y="5.5" width="18" height="13"/><path d="m3 6.5 9 6.5 9-6.5"/>' }
];

/* the circle for quick link i: the uploaded picture if there is one, else the line icon */
function quickIcon(i) {
  var url = (state.data.home.quickIcons || [])[i];
  if (url) return '<div class="quick-icon has-img">' + photo(url, '') + '</div>';
  return '<div class="quick-icon">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A47C" stroke-width="1">' + QUICK_LINKS[i].icon + '</svg>' +
  '</div>';
}

function homePage() {
  var d = state.data, h = d.home, a = d.artist;

  var quick = QUICK_LINKS.map(function (q, i) {
    return '<div class="quick-link" data-act="go:' + q.to + '">' +
      quickIcon(i) +
      '<span class="quick-label">' + q.label + '</span>' +
    '</div>';
  }).join('');

  var cards = liveServices().map(function (x) {
    return '<article class="svc-card" data-act="go:services">' +
      '<div class="svc-card-img">' + photo(x.s.img, 'PHOTO') + '</div>' +
      '<span class="svc-card-name">' + esc(x.s.name) + '</span>' +
      '<span class="svc-card-price">' + esc(money(x.s.price)) + '</span>' +
    '</article>';
  }).join('');

  /* recent work: the gallery, padded out to a full row of three (six when empty) */
  var tiles = d.gallery.slice(0, 6).map(function (g) { return g.url; });
  var want = tiles.length ? Math.ceil(tiles.length / 3) * 3 : 6;
  while (tiles.length < want) tiles.push('');
  var gallery = tiles.map(function (u) {
    return '<div class="gallery-tile frame">' + photo(u, 'PHOTO') + '</div>';
  }).join('');

  var repeat = '';
  for (var i = 0; i < 4; i++) repeat += '<span>Book with us</span>';

  return '<div class="page home">' +

    /* hero */
    '<section class="hero sand">' +
      '<div class="hero-inner">' +
        '<div class="hero-copy">' +
          '<span class="hero-script">' + esc(h.script) + '</span>' +
          '<h1 class="hero-title">' + esc(h.headline) + '</h1>' +
          '<span class="btn-dark" data-act="go:booking">BOOK NOW</span>' +
        '</div>' +
        '<div class="hero-figure">' +
          '<div class="hero-portrait cutout' + (h.heroImg ? ' has-img auto' + (isCutOut(h.heroImg) ? '' : ' soft') : '') + '">' +
            (h.heroImg
              ? photo(h.heroImg, '', true)
              : '<div class="ph"><span class="ph-label">HERO PORTRAIT<br><small>cut-out works best</small></span></div>') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* quick links to every section */
    '<section class="quick sand">' +
      '<div class="quick-inner">' + quick + '</div>' +
    '</section>' +

    /* about + meet the artist */
    '<section class="about">' +
      '<div class="band-head">' +
        '<h2 class="band-title">About</h2>' +
        '<span class="band-sub">A BEAUTY STUDIO IN ST KITTS</span>' +
        '<div class="band-rule"></div>' +
        '<p class="about-text">' + esc(h.sub) + '</p>' +
        (h.welcome ? '<p class="about-text">' + esc(h.welcome) + '</p>' : '') +
      '</div>' +
      '<div class="meet">' +
        '<div class="meet-figure">' +
          '<div class="meet-portrait-wrap">' +
            '<div class="meet-portrait">' + photo(a.portrait, 'PORTRAIT OF ROSÉ') + '</div>' +
            '<span class="meet-tag">ROSÉ</span>' +
          '</div>' +
        '</div>' +
        '<div class="meet-body">' +
          '<span class="script">Your trusted makeup artist</span>' +
          '<h3 class="meet-title">Meet the artist</h3>' +
          (a.intro
            ? '<p class="meet-intro">' + esc(a.intro) + '</p>'
            : '<p class="meet-intro empty-hint">A short line about you goes here — add it in the studio panel.</p>') +
          '<span class="link-gold" data-act="go:artist">READ MY STORY →</span>' +
        '</div>' +
      '</div>' +
    '</section>' +

    /* services */
    '<section class="home-services sand">' +
      '<div class="band-head">' +
        '<h2 class="band-title">Services</h2>' +
        '<span class="band-sub">MAKEUP FOR EVERY OCCASION</span>' +
        '<div class="band-rule"></div>' +
      '</div>' +
      '<div class="svc-grid">' + cards + '</div>' +
    '</section>' +

    /* book with us */
    '<section class="bookband sand">' +
      '<div class="bookband-stack">' +
        '<div class="bookband-words" aria-hidden="true">' + repeat + '</div>' +
        '<div class="bookband-figure">' +
          '<div class="bookband-cutout cutout' + (h.ctaImg ? ' has-img auto' + (isCutOut(h.ctaImg) ? '' : ' soft') : '') + '">' +
            photo(h.ctaImg, 'CUT-OUT PORTRAIT', !!h.ctaImg) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bookband-cta">' +
        '<span class="btn-dark" data-act="go:booking">GO TO BOOKING PAGE</span>' +
      '</div>' +
    '</section>' +

    /* portfolio */
    '<section class="home-portfolio">' +
      '<div class="band-head">' +
        '<h2 class="band-title">Portfolio</h2>' +
        '<span class="band-sub">RECENT WORK</span>' +
        '<div class="band-rule"></div>' +
      '</div>' +
      '<div class="gallery-grid">' + gallery + '</div>' +
      '<div class="gallery-cta">' +
        '<span class="btn-ghost" data-act="go:gallery">SEE THE FULL GALLERY</span>' +
      '</div>' +
    '</section>' +

  '</div>';
}

function servicesPage() {
  var d = state.data, live = liveServices();

  var summary = live.map(function (x) {
    return '<div class="sv-sum">' +
      '<span class="sv-sum-name">' + esc(x.s.name) + '</span>' +
      '<span class="sv-sum-price">' + esc(x.s.price ? money(x.s.price) : 'On request') + '</span>' +
    '</div>';
  }).join('');

  var cards = live.map(function (x) {
    var s = x.s;
    return '<article class="sv-card" data-act="book:' + x.i + '">' +
      '<div class="sv-photo frame">' +
        photo(s.img, 'PHOTO — ' + s.name.toUpperCase()) +
        '<span class="sv-num">0' + (x.i + 1) + '</span>' +
      '</div>' +
      '<div class="sv-body">' +
        '<h2 class="sv-name">' + esc(s.name) + '</h2>' +
        (s.desc ? '<p class="sv-desc">' + esc(s.desc) + '</p>' : '') +
        '<div class="sv-meta">' +
          '<span class="sv-dur">' + esc(s.dur) + '</span>' +
          '<span class="sv-price">' + esc(s.price ? money(s.price) : 'On request') + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="sv-book">BOOK THIS →</span>' +
    '</article>';
  }).join('');

  var lashes = d.lashes.map(function (l) {
    return '<div class="lash-card">' +
      '<div class="lash-img frame">' + photo(l.img, 'LASH PHOTO') + '</div>' +
      '<span class="lash-name">' + esc(l.name) + '</span>' +
      '<span class="lash-price">' + esc(l.price ? money(l.price) : 'On request') + '</span>' +
    '</div>';
  }).join('');

  var pol = livePolicies();

  return '<div class="page services">' +
    '<div class="sv-head">' +
      '<div class="sv-head-copy">' +
        '<span class="eyebrow">SERVICES</span>' +
        '<span class="sv-script">Choose your</span>' +
        '<h1 class="sv-title">Look</h1>' +
      '</div>' +
      '<div class="sv-scroll" aria-hidden="true">' +
        '<span>SCROLL</span>' +
        '<svg width="44" height="8" viewBox="0 0 44 8" fill="none" stroke="#C9A47C" stroke-width="1"><path d="M0 4h42M37 1l5 3-5 3"/></svg>' +
      '</div>' +
    '</div>' +

    '<div class="sv-summary">' + summary + '</div>' +

    '<div class="strip sv-strip">' + cards + '</div>' +

    '<section class="addons">' +
      '<div class="addons-head">' +
        '<span class="eyebrow">ADD-ONS</span>' +
        '<h3>Lashes, with any look.</h3>' +
      '</div>' +
      '<div class="lash-grid">' + lashes + '</div>' +
    '</section>' +

    /* The policies sit in front of the booking form, so this band goes there
       rather than off to a page of its own. */
    (pol.length || state.logged
      ? '<section class="policy-band" data-act="go:booking">' +
          '<div class="policy-band-copy">' +
            '<span class="policy-band-label">BEFORE YOU BOOK</span>' +
            '<h3>Deposits, timing, travel and touch-ups.</h3>' +
          '</div>' +
          '<span class="policy-band-link">READ THE POLICIES →</span>' +
        '</section>'
      : '') +

    '<div class="tail-cta"><span class="btn" data-act="go:booking">BOOK A SERVICE</span></div>' +
  '</div>';
}

/* Which tags actually have photos, so no filter leads to an empty grid. */
function galleryTags() {
  var seen = {}, out = [];
  state.data.gallery.forEach(function (g) {
    if (g.tag && !seen[g.tag]) { seen[g.tag] = 1; out.push(g.tag); }
  });
  return out;
}

function galleryShown() {
  var f = state.gal.filter;
  if (f === 'All') return state.data.gallery;
  return state.data.gallery.filter(function (g) { return g.tag === f; });
}

function galleryPage() {
  var all = state.data.gallery, shown = galleryShown(), tags = galleryTags();

  if (!all.length) {
    return '<div class="page gallery">' +
      '<section class="gal-head">' +
        '<div class="gal-head-copy">' +
          '<span class="script">Her work</span>' +
          '<h1 class="gal-title">Gallery</h1>' +
        '</div>' +
      '</section>' +
      '<section class="gal-empty">' +
        '<p class="empty-hint">No photographs here yet. They will appear as soon as Rosé adds them.</p>' +
        '<span class="btn" data-act="go:booking">BOOK AN APPOINTMENT</span>' +
      '</section>' +
    '</div>';
  }

  var chips = ['All'].concat(tags).map(function (t) {
    return '<span class="gal-chip' + (state.gal.filter === t ? ' on' : '') +
      '" data-act="galFilter:' + esc(t) + '">' + esc(t.toUpperCase()) + '</span>';
  }).join('');

  var tiles = shown.map(function (g, i) {
    return '<div class="gal-tile" data-act="galOpen:' + i + '">' +
      photo(g.url, 'PHOTO') +
      (g.tag ? '<span class="gal-tag">' + esc(g.tag.toUpperCase()) + '</span>' : '') +
    '</div>';
  }).join('');

  var lightbox = '';
  if (state.gal.open && shown.length) {
    var i = ((state.gal.i % shown.length) + shown.length) % shown.length;
    var cur = shown[i];
    lightbox =
    '<div class="lightbox" data-act="galClose">' +
      '<div class="lb-top">' +
        '<span class="lb-pos">' + (i + 1) + ' / ' + shown.length + '</span>' +
        '<span class="lb-close" data-act="galClose">CLOSE ✕</span>' +
      '</div>' +
      '<div class="lb-stage">' +
        '<img class="lb-img" src="' + esc(cur.url) + '" alt="' + esc(cur.tag || 'Photograph') + '">' +
      '</div>' +
      '<div class="lb-foot">' +
        '<span class="lb-nav" data-act="galStep:-1">← PREVIOUS</span>' +
        '<span class="lb-tag">' + esc((cur.tag || '').toUpperCase()) + '</span>' +
        '<span class="lb-nav" data-act="galStep:1">NEXT →</span>' +
      '</div>' +
    '</div>';
  }

  return '<div class="page gallery">' +
    '<section class="gal-head">' +
      '<div class="gal-head-copy">' +
        '<span class="script">Her work</span>' +
        '<h1 class="gal-title">Gallery</h1>' +
      '</div>' +
      '<span class="gal-count">' + all.length + (all.length === 1 ? ' PHOTOGRAPH' : ' PHOTOGRAPHS') + '</span>' +
    '</section>' +
    (tags.length ? '<div class="gal-filters">' + chips + '</div>' : '') +
    '<div class="gal-grid">' + tiles + '</div>' +
    lightbox +
  '</div>';
}

function artistPage() {
  var d = state.data, a = d.artist, feat = featuredReview();
  var first = (a.name || 'Rosé').split(' ')[0].toUpperCase();

  var looks = (a.looks || []).map(function (l, i) {
    return '<div class="look">' +
      '<div class="look-img frame">' + photo(l.img, 'PHOTO') + '</div>' +
      '<span class="look-num">0' + (i + 1) + '</span>' +
      '<span class="look-name">' + esc(l.name || 'Look name') + '</span>' +
      '<span class="look-note' + (l.note ? '' : ' empty-hint') + '">' + esc(l.note || 'One line about it.') + '</span>' +
    '</div>';
  }).join('');

  return '<div class="page artist">' +

    '<section class="artist-hero">' +
      '<div class="artist-hero-copy">' +
        '<span class="artist-script">Meet your artist</span>' +
        '<h1 class="artist-name">' + esc(a.name || 'Rosé') + '</h1>' +
        '<div class="band-rule"></div>' +
        '<span class="artist-tagline">' + esc(a.tagline || 'Your trusted makeup artist · St Kitts') + '</span>' +
      '</div>' +
      '<div class="artist-figure">' +
        '<div class="artist-frame' + (a.portrait ? ' auto' : '') + '">' +
          '<div class="artist-portrait">' + photo(a.portrait, 'PORTRAIT', !!a.portrait) + '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="story">' +
      '<div class="story-img frame' + (a.storyImg ? ' auto' : '') + '">' +
        photo(a.storyImg, 'PHOTO', !!a.storyImg) + '</div>' +
      '<div class="story-copy">' +
        '<span class="eyebrow">HER STORY</span>' +
        (a.story
          ? '<p class="story-text">' + esc(a.story) + '</p>'
          : '<p class="story-text empty-hint">A short paragraph goes here — three or four sentences is plenty. Add it in the studio panel.</p>') +
        '<span class="story-quote' + (a.quote ? '' : ' empty-hint') + '">' + esc(a.quote || 'A line in her own words goes here.') + '</span>' +
      '</div>' +
    '</section>' +

    '<section class="looks">' +
      '<div class="looks-head">' +
        '<h2>Her three favourite looks</h2>' +
        '<span class="eyebrow">CHOSEN BY ' + esc(first) + '</span>' +
      '</div>' +
      '<div class="looks-grid">' + looks + '</div>' +
    '</section>' +

    '<section class="kind">' +
      '<span class="script">Kind words</span>' +
      (feat
        ? '<p class="kind-quote">' + esc(feat.text) + '</p><span class="kind-by">— ' + esc(feat.name.toUpperCase()) + '</span>'
        : '<p class="kind-quote empty-hint">A client\'s review appears here once one is published from the studio panel.</p><span class="kind-by">— CLIENT NAME</span>') +
      '<span class="link-gold" data-act="go:reviews">ALL REVIEWS →</span>' +
    '</section>' +

    '<section class="artist-tail">' +
      '<h2>I would love to do your makeup.</h2>' +
      '<span class="btn" data-act="go:booking">BOOK WITH ' + esc(first) + '</span>' +
    '</section>' +
  '</div>';
}

/* A wa.me link the client can tap to send the booking straight to Rosé's WhatsApp.
   Free, instant and needs no API — it just opens their own WhatsApp with the
   message written. Only offered when a WhatsApp number is set in Settings. */
function whatsappBookingLink() {
  var num = String(state.data.brand.whatsapp || '').replace(/[^\d]/g, '');
  if (!num) return '';
  var f = state.booked;
  if (!f) return '';
  var lines = [
    'Hi! I just requested an appointment on your website.',
    '',
    'Name: ' + f.name,
    'Service: ' + f.service,
    'When: ' + f.date + ' at ' + f.time,
    'Where: ' + f.place
  ];
  if (f.contact) lines.push('Contact: ' + f.contact);
  if (f.occasion) lines.push('Occasion: ' + f.occasion);
  if (f.notes) lines.push('Notes: ' + f.notes);
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(lines.join('\n'));
}

/* the review quoted at the top of the reviews page: featured first, but it must have words */
function quotedReview() {
  var rs = state.data.reviews.filter(function (r) { return r.published && r.text; });
  return rs.filter(function (r) { return r.featured; })[0] || rs[0] || null;
}

function reviewsPage() {
  var d = state.data, f = d.rform;
  var pub = d.reviews.filter(function (r) { return r.published; });
  var quote = quotedReview();
  var first = (d.artist.name || 'Rosé').split(' ')[0];

  var cards = pub.map(function (r) {
    var meta = r.service ? r.service : (r.img && !r.text ? 'Sent in' : 'Client');
    return '<article class="rv-card">' +
      (r.img ? '<img class="rv-shot" src="' + esc(r.img) + '" alt="Review from ' + esc(r.name) + '">' : '') +
      (r.text ? '<p class="rv-text">' + esc(r.text) + '</p>' : '') +
      '<span class="rv-meta">' + esc(r.name) + ' · ' + esc(meta) + '</span>' +
    '</article>';
  }).join('');

  return '<div class="page reviews">' +
    '<section class="rv-head">' +
      '<span class="eyebrow">' +
        (pub.length ? pub.length + (pub.length === 1 ? ' REVIEW' : ' REVIEWS') + ' · ALL FROM REAL CLIENTS' : 'NO REVIEWS YET · BE THE FIRST') +
      '</span>' +
      (quote
        ? '<span class="rv-quote">' + esc(quote.text) + '</span><span class="rv-by">— ' + esc(quote.name) + '</span>'
        : '<span class="rv-quote empty-hint">Kind words from clients will appear here.</span>') +
    '</section>' +

    (pub.length ? '<div class="rv-wall">' + cards + '</div>' : '') +

    '<section class="rv-form sand">' +
      '<div class="rv-form-grid">' +
        '<div class="rv-form-intro">' +
          '<span class="rv-form-label">BEEN IN THE CHAIR?</span>' +
          '<span class="rv-form-script">Leave a review</span>' +
          '<p>A screenshot of your message is a fine review.</p>' +
        '</div>' +
        '<div class="rv-form-fields">' +
          '<label class="rv-field"><span>YOUR NAME</span>' +
            '<input type="text" value="' + esc(f.name) + '" data-k="rform.name"></label>' +
          '<label class="rv-field"><span>IN YOUR WORDS (OPTIONAL)</span>' +
            '<textarea rows="3" data-k="rform.text">' + esc(f.text) + '</textarea></label>' +
          (f.img
            ? '<div class="rv-attach"><img src="' + esc(f.img) + '" alt=""><span class="rv-attach-name">ATTACHED</span>' +
              '<span class="rv-attach-remove" data-act="clearImg:rform.img">REMOVE</span></div>'
            : '') +
          '<div class="rv-form-actions">' +
            '<label class="rv-upload">＋ ' + (f.img ? 'CHANGE THE PICTURE' : 'ADD A SCREENSHOT OR PHOTO') +
              '<input type="file" accept="image/*" data-upload="rform.img"></label>' +
            '<span class="btn-dark rv-send" data-act="sendReview">SEND IT IN</span>' +
          '</div>' +
          (state.flash === 'review-sent'
            ? '<span class="rv-note ok-dark">Thank you — sent to ' + esc(first) + ' for approval.</span>'
            : state.flash === 'sending'
              ? '<span class="rv-note">Sending…</span>'
            : state.flash === 'review-error'
              ? '<span class="rv-note err-dark">Add your name and either a few words or a picture.</span>'
            : flashText('send-error')
              ? '<span class="rv-note err-dark">Could not send: ' + esc(flashText('send-error')) + '</span>'
              : '<span class="rv-note">Nothing appears until ' + esc(first) + ' approves it.</span>') +
        '</div>' +
      '</div>' +
    '</section>' +
  '</div>';
}

/* Shown in place of the form once a request has gone through, so there is no
   doubt about whether it was sent. */
function bookingDone() {
  var b = state.booked, wa = whatsappBookingLink();
  return '<div class="page">' +
    '<section class="done">' +
      '<div class="done-mark">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A47C" stroke-width="1.2">' +
          '<path d="m4 12.5 5.5 5.5L20 7"/></svg>' +
      '</div>' +
      '<span class="script">Thank you</span>' +
      '<h1 class="done-title">Your request is in.</h1>' +
      '<p class="done-copy">It is with the studio now. You will hear back to confirm' +
        (b.contact ? ' on ' + esc(b.contact) : '') + '.</p>' +
      '<div class="done-card">' +
        '<div class="sum-row"><span>Name</span><span>' + esc(b.name) + '</span></div>' +
        '<div class="sum-row"><span>Service</span><span>' + esc(b.service) + '</span></div>' +
        '<div class="sum-row"><span>Date</span><span>' + esc(b.date) + '</span></div>' +
        '<div class="sum-row"><span>Time</span><span>' + esc(b.time) + '</span></div>' +
        '<div class="sum-row"><span>Location</span><span>' + esc(b.place) + '</span></div>' +
      '</div>' +
      (wa ? '<a class="btn-wa" href="' + esc(wa) + '" target="_blank" rel="noopener">MESSAGE IT ON WHATSAPP TOO</a>' : '') +
      '<div class="done-links">' +
        '<span class="btn-line" data-act="bookAnother">BOOK ANOTHER</span>' +
        '<span class="btn-line" data-act="go:home">BACK TO THE SITE</span>' +
      '</div>' +
    '</section>' +
  '</div>';
}

function bookingPage() {
  if (state.booked) return bookingDone();
  var d = state.data;

  var picks = liveServices().map(function (x) {
    var s = x.s, sel = d.form.svc === s.name;
    return '<div class="pick" data-act="pick:' + x.i + '">' +
      '<div class="pick-top">' +
        '<span class="pick-name">' + esc(s.name) + '</span>' +
        (sel ? '<span class="tick">✓</span>' : '') +
      '</div>' +
      '<span class="pick-meta">' + esc(money(s.price)) + ' · ' + esc(s.dur) + '</span>' +
    '</div>';
  }).join('');

  var slots = TIME_SLOTS.map(function (t) {
    return '<div class="slot" data-act="slot:' + esc(t) + '">' +
      '<span>' + esc(t) + '</span>' +
      (d.form.time === t ? '<span class="tick">✓</span>' : '') +
    '</div>';
  }).join('');

  return '<div class="page">' +
    '<div class="page-head">' +
      '<p class="eyebrow">APPOINTMENTS</p>' +
      '<h1>Book your appointment</h1>' +
    '</div>' +

    '<section class="step">' +
      '<div class="step-head"><span class="step-num">STEP 01</span><h2 class="step-title">Which service?</h2></div>' +
      '<div class="pick-grid">' + picks + '</div>' +
    '</section>' +

    '<section class="step-cols">' +
      '<div>' +
        '<div class="step-head"><span class="step-num">STEP 02</span><h2 class="step-title">Pick a date</h2></div>' +
        calendar() +
      '</div>' +
      '<div>' +
        '<p class="eyebrow" style="margin-bottom:20px">TIME</p>' +
        '<div class="slots">' + slots + '</div>' +
        '<p class="eyebrow" style="margin:20px 0 12px">WHERE</p>' +
        '<div class="row">' +
          '<span class="btn-chip" data-act="place:Studio">AT THE STUDIO</span>' +
          '<span class="btn-chip" data-act="place:Travel to client">TRAVEL TO ME</span>' +
        '</div>' +
        '<p class="place-note">' + esc(d.form.place || 'Not chosen yet') + '</p>' +
      '</div>' +
    '</section>' +

    '<section class="step">' +
      '<div class="step-head"><span class="step-num">STEP 03</span><h2 class="step-title">Your details</h2></div>' +
      '<div class="detail-grid">' +
        '<input type="text" value="' + esc(d.form.name) + '" data-k="form.name" placeholder="Full name *">' +
        '<input type="tel" value="' + esc(d.form.contact) + '" data-k="form.contact" placeholder="Phone / WhatsApp *">' +
        '<input type="text" value="' + esc(d.form.email) + '" data-k="form.email" placeholder="Email (optional)">' +
        '<input type="text" value="' + esc(d.form.occasion) + '" data-k="form.occasion" placeholder="Occasion (optional)">' +
      '</div>' +
      '<p class="form-note" style="margin-top:10px">' +
        '* Your name and a number to reach you on. Ros\u00e9 confirms every appointment by WhatsApp.</p>' +
      '<textarea rows="3" data-k="form.notes" style="margin-top:16px" ' +
        'placeholder="Anything I should know? Allergies, inspiration, where you&#39;ll be getting ready">' +
        esc(d.form.notes) + '</textarea>' +
    '</section>' +

    '<section class="confirm">' +
      '<div>' +
        '<div class="step-head"><span class="step-num">STEP 04</span><h2 class="step-title">Confirm</h2></div>' +
        '<p class="confirm-copy">Your request goes straight to the studio. ' +
          'Once it is confirmed you will get a note back.</p>' +
      '</div>' +
      '<div class="summary">' +
        '<div class="sum-row"><span>Service</span><span>' + esc(d.form.svc || '—') + '</span></div>' +
        '<div class="sum-row"><span>Date</span><span>' + esc(prettyDate(d.form.date) || '—') + '</span></div>' +
        '<div class="sum-row"><span>Time</span><span>' + esc(d.form.time || '—') + '</span></div>' +
        '<div class="sum-row"><span>Location</span><span>' + esc(d.form.place || '—') + '</span></div>' +
        '<div class="rule"></div>' +
        '<span class="btn-confirm' + (state.sending ? ' busy' : '') + '" data-act="sendBooking">' +
          (state.sending ? 'SENDING…' : 'REQUEST THIS APPOINTMENT') + '</span>' +
        (state.flash === 'booking-error'
          ? '<p class="err">Add a service, a date, a time, your name and a number to reach you on.</p>' : '') +
        (state.flash === 'booking-past'
          ? '<p class="err">That date has already passed. Please pick another.</p>' : '') +
        (flashText('send-error') ? '<p class="err">Could not send: ' + esc(flashText('send-error')) + '</p>' : '') +
        /* the policies were shown on the way in; this is the way back to them */
        (livePolicies().length
          ? '<p class="confirm-note">Booking a date confirms you have read the ' +
              '<span class="link-gold" data-act="go:policies">policies</span>.</p>' : '') +
      '</div>' +
    '</section>' +
  '</div>';
}

/* The policies, as a page. It is not in the nav: a visitor meets it on the way
   to booking, which is the moment the wording is about. Rosé reaches it from
   the panel, and the booking form keeps a quiet link back to it.

   A sticky index down the left side, and each policy as its own numbered
   piece: a heading, then the policy itself — typed out, or photographed if
   she already has it written somewhere. */
function policiesPage() {
  var pol = livePolicies();

  var index = pol.map(function (p, i) {
    return '<span class="pol-index-item' + (i === 0 ? ' on' : '') + '" data-act="polJump:' + i + '">' +
      '<span class="pol-index-num">' + pad2(i + 1) + '</span>' +
      '<span class="pol-index-name">' + esc(p.title || 'Good to know') + '</span>' +
    '</span>';
  }).join('');

  var items = pol.map(function (p, i) {
    return '<article class="pol-item" id="pol-' + i + '">' +
      '<div class="pol-item-head">' +
        '<span class="pol-item-num">' + pad2(i + 1) + '</span>' +
        '<h2 class="pol-item-name">' + esc(p.title || 'Good to know') + '</h2>' +
      '</div>' +
      (p.img ? '<div class="pol-shot auto">' + photo(p.img, 'POLICY PHOTO', true) + '</div>' : '') +
      (p.text ? '<p class="pol-text">' + esc(p.text) + '</p>' : '') +
    '</article>';
  }).join('');

  return '<div class="page pol-page">' +
    '<section class="pol-hero">' +
      '<div class="pol-hero-copy">' +
        '<span class="script">Before you book</span>' +
        '<h1 class="pol-page-title">Policies</h1>' +
      '</div>' +
      '<div class="pol-hero-do">' +
        (pol.length ? '<span class="pol-count">' + pol.length + ' THING' + (pol.length === 1 ? '' : 'S') + ' TO KNOW</span>' : '') +
        '<span class="btn pol-go" data-act="policiesRead">AGREE &amp; CONTINUE</span>' +
        '<span class="pol-go-note">Booking a date confirms you have read these.</span>' +
      '</div>' +
    '</section>' +

    (pol.length
      ? '<div class="pol-body">' +
          '<aside class="pol-index">' + index + '</aside>' +
          '<div class="pol-list">' + items + '</div>' +
        '</div>'
      : '<section class="pol-empty">' +
          '<p class="empty-hint">' +
            (state.logged
              ? 'Nothing written yet \u2014 fill the headings in under Policies, by typing them out or adding a picture of each one.'
              : 'Nothing here yet. Ask away when you book and Ros\u00e9 will talk you through it.') +
          '</p>' +
        '</section>') +

    /* the way on is at the top; down here is the way to ask instead */
    '<section class="pol-tail">' +
      '<div class="pol-tail-copy">' +
        '<span class="pol-tail-label">STILL UNSURE?</span>' +
        '<h3 class="pol-tail-title">Message me and I will talk it through.</h3>' +
      '</div>' +
      '<span class="btn-line pol-tail-btn" data-act="go:contact">ASK A QUESTION</span>' +
    '</section>' +
  '</div>';
}

function contactPage() {
  var d = state.data;

  var hours = d.hours.map(function (h) {
    return '<div class="hours-row"><span>' + esc(h.day) + '</span><span>' + esc(h.open || 'Closed') + '</span></div>';
  }).join('');

  return '<div class="page">' +
    '<div class="page-head">' +
      '<h1>Say hello</h1>' +
      '<p class="lede">Appointments are booked on this site — for anything else, write to me.</p>' +
    '</div>' +
    '<section class="contact-grid">' +
      '<div class="contact-form">' +
        '<h2>Write to me</h2>' +
        '<input type="text" value="' + esc(d.cform.name) + '" data-k="cform.name" placeholder="Your name *">' +
        '<input type="tel" value="' + esc(d.cform.phone) + '" data-k="cform.phone" placeholder="Phone or WhatsApp number *">' +
        '<input type="text" value="' + esc(d.cform.email) + '" data-k="cform.email" placeholder="Email (optional)">' +
        '<input type="text" value="' + esc(d.cform.topic) + '" data-k="cform.topic" placeholder="What can I help with?">' +
        '<textarea rows="5" data-k="cform.message" placeholder="Your message *">' + esc(d.cform.message) + '</textarea>' +
        '<span class="form-note">* Name, number and message are needed so Rosé can reply.</span>' +
        '<span class="btn-msg" data-act="sendMessage">SEND MESSAGE</span>' +
        (state.flash === 'message-error'
          ? '<p class="err">Add your name, a number to reach you on, and a message.</p>' : '') +
        (state.flash === 'message-sent' ? '<p class="ok">Sent — it is in the studio inbox.</p>' : '') +
        (state.flash === 'sending' ? '<p class="form-note">Sending…</p>' : '') +
        (flashText('send-error') ? '<p class="err">Could not send: ' + esc(flashText('send-error')) + '</p>' : '') +
      '</div>' +
      '<div class="contact-info">' +
        '<div class="info"><span class="info-label">INSTAGRAM</span>' +
          '<span class="info-val">' + esc(d.brand.ig || 'Instagram to be added') + '</span></div>' +
        '<div class="info"><span class="info-label">EMAIL</span>' +
          '<span class="info-val">' + esc(d.brand.email || 'Email to be added') + '</span></div>' +
        '<div class="info"><span class="info-label">STUDIO</span>' +
          '<span class="info-val addr">' + esc(d.brand.address || 'Address to be added') + '</span></div>' +
        '<div class="info" id="hours"><span class="info-label">STUDIO HOURS</span>' + hours + '</div>' +
      '</div>' +
    '</section>' +
  '</div>';
}

function footer() {
  var d = state.data;
  return '' +
  '<footer class="footer">' +
    '<div class="footer-inner">' +
      '<div class="foot-col brand-col">' +
        '<span class="foot-name">ROSÉ</span>' +
        '<span class="foot-sub">CREATIVE ARTISTRY</span>' +
        '<span class="foot-ig">' + esc(d.brand.ig || 'Instagram to be added') + '</span>' +
        (d.brand.email ? '<span class="foot-place">' + esc(d.brand.email) + '</span>' : '') +
        '<span class="foot-place">St Kitts · by appointment</span>' +
      '</div>' +
      '<div class="foot-col">' +
        '<span class="foot-label">PAGES</span>' +
        '<span class="foot-link" data-act="go:services">Services</span>' +
        '<span class="foot-link" data-act="go:gallery">Gallery</span>' +
        '<span class="foot-link" data-act="go:artist">The Artist</span>' +
        '<span class="foot-link" data-act="go:reviews">Reviews</span>' +
        '<span class="foot-link" data-act="go:booking">Booking</span>' +
        '<span class="foot-link" data-act="go:contact">Contact</span>' +
      '</div>' +
      '<div class="foot-col">' +
        '<span class="foot-label">GOOD TO KNOW</span>' +

        '<span class="foot-link" data-act="go:contact#hours">Opening hours</span>' +
      '</div>' +
      '<div class="foot-col">' +
        '<span class="foot-label">STUDIO</span>' +
        '<span class="foot-link gold" data-act="go:admin">Studio login →</span>' +
      '</div>' +
    '</div>' +
  '</footer>' +
  '<div class="copyright"><p>© 2026 ROSÉ Creative Artistry</p></div>';
}

/* =========================================================================
   STUDIO PANEL
   ========================================================================= */

function loginPage() {
  var note;
  if (API.remote && state.loginConfigured === false) {
    note = '<p class="err">No studio password is set yet. In Vercel, add STUDIO_PASSWORD under the project\'s Environment Variables, then redeploy.</p>';
  } else if (state.loginError) {
    note = '<p class="err">' + esc(state.loginError) + '</p>';
  } else if (!API.remote) {
    note = '<p class="form-note">Local copy — any password gets you in. The real password is set in Vercel.</p>';
  } else {
    note = '';
  }
  return '<div class="login page-fade">' +
    '<div class="login-art">' +
      '<div class="login-art-inner">' +
        '<span class="login-art-name">ROSÉ</span>' +
        '<span class="login-art-sub">CREATIVE ARTISTRY · STUDIO ADMIN</span>' +
      '</div>' +
    '</div>' +
    '<div class="login-form">' +
      '<div>' +
        '<h1>Welcome back.</h1>' +
        '<p class="lede">Sign in to manage bookings and update the website.</p>' +
      '</div>' +
      '<div class="info"><span class="info-label">PASSWORD</span>' +
        '<input type="password" id="pw" placeholder="••••••••••••" autocomplete="current-password"></div>' +
      '<span class="btn-signin" data-act="signIn">' + (state.flash === 'signing-in' ? 'SIGNING IN…' : 'SIGN IN') + '</span>' +
      note +
      '<span class="back-link" data-act="go:home">← Back to the website</span>' +
    '</div>' +
  '</div>';
}

function panel() {
  var links = Object.keys(SECTIONS).map(function (k) {
    return '<span class="side-link' + (state.section === k ? ' active' : '') +
      '" data-act="sec:' + k + '">' + esc(SECTIONS[k]) + '</span>';
  }).join('');

  var body = ({
    bookings:     panelBookings,
    availability: panelAvailability,
    services:     panelServices,
    policies:     panelPolicies,
    portfolio:    panelPortfolio,
    pages:        panelPages,
    reviews:      panelReviews,
    clients:      panelClients,
    messages:     panelMessages,
    settings:     panelSettings
  })[state.section] || panelBookings;

  return '<div class="panel-wrap page-fade">' +
    '<aside class="side">' +
      '<div class="side-brand"><span>ROSÉ</span><p>STUDIO ADMIN</p></div>' +
      '<nav class="side-nav">' + links + '</nav>' +
      '<div class="side-spacer"></div>' +
      '<div class="side-foot">' +
        '<span class="view" data-act="go:home">View website →</span>' +
        '<span class="out" data-act="signOut">Sign out</span>' +
      '</div>' +
    '</aside>' +
    '<div class="main">' +
      '<div class="main-head">' +
        '<h1>' + esc(SECTIONS[state.section] || 'Bookings') + '</h1>' +
        (INBOX_SECTIONS[state.section] && API.remote
          ? '<span class="main-note">Checked ' + esc(ago(state.inboxAt)) + '. New bookings appear on their own.</span>' +
            '<span class="refresh-link" data-act="refreshInbox">REFRESH NOW</span>'
          : '<span class="main-note">' + esc(state.saveNote || 'Changes save as you type and show on the website straight away') + '</span>') +
      '</div>' +
      (state.storageError ? '<p class="err panel-err">Nothing can be saved yet: ' + esc(state.storageError) + ' See Settings → Connections.</p>' : '') +
      (flashText('inbox-error') ? '<p class="err panel-err">' + esc(flashText('inbox-error')) + '</p>' : '') +
      body() +
    '</div>' +
  '</div>';
}

function empty(title, text) {
  return '<div class="empty"><div class="empty-inner">' +
    '<span class="empty-title">' + esc(title) + '</span>' +
    '<p class="empty-text">' + esc(text) + '</p>' +
  '</div></div>';
}

/* The client's number, ready for a wa.me link.
   A number typed without a country code (a local one, as most people write it)
   borrows the leading digits from the studio's own WhatsApp number. */
function clientWaNumber(contact) {
  var raw = String(contact || '').trim();
  var digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  if (raw.charAt(0) === '+') return digits;          // already written in full
  /* Pad a national or local number up to the length of the studio's own, so
     a St Kitts 869 555 0188 becomes 1 869 555 0188 rather than being sent as is. */
  var mine = String(state.data.brand.whatsapp || '').replace(/[^\d]/g, '');
  if (mine.length > digits.length) return mine.slice(0, mine.length - digits.length) + digits;
  return digits;
}

/* What to say, matched to where the booking has got to. */
function clientWaMessage(b) {
  var studio = state.data.artist.name || 'ROSÉ Creative Artistry';
  var when = b.date + ' at ' + b.time;
  var sign = '\n\n— ' + studio;
  if (b.status === 'confirmed')
    return 'Hi ' + b.name + '! Your ' + b.service + ' appointment is confirmed for ' + when +
      ' (' + b.place + '). See you then!' + sign;
  if (b.status === 'cancelled')
    return 'Hi ' + b.name + ', I am so sorry but I have had to cancel your ' + b.service +
      ' appointment on ' + when + '. Please get in touch and we will find another date.' + sign;
  if (b.status === 'completed')
    return 'Hi ' + b.name + ', thank you for coming in! It was lovely doing your makeup. ' +
      'If you have a moment, a review on the website would mean a lot.' + sign;
  return 'Hi ' + b.name + '! Thank you for your ' + b.service + ' request for ' + when +
    '. I am just checking the date and will confirm shortly.' + sign;
}

function clientWaButton(b) {
  var num = clientWaNumber(b.contact);
  if (!num) return '';
  var label = b.status === 'confirmed' ? 'SEND CONFIRMATION'
            : b.status === 'cancelled' ? 'LET THEM KNOW'
            : 'WHATSAPP';
  return '<a class="tag tag-wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(num) +
    '?text=' + encodeURIComponent(clientWaMessage(b)) + '">' + label + '</a>';
}

function panelBookings() {
  var bs = state.data.bookings;
  var count = function (st) { return bs.filter(function (b) { return b.status === st; }).length; };

  var rows = bs.map(function (b, i) {
    var actions = '';
    if (b.status === 'pending')   actions += '<span class="tag tag-gold" data-act="bConfirm:' + i + '">CONFIRM</span>';
    if (b.status === 'confirmed') actions += '<span class="tag tag-good" data-act="bComplete:' + i + '">MARK COMPLETE</span>';
    if (b.status === 'completed' || b.status === 'cancelled')
      actions += '<span class="tag tag-plain" data-act="bRemove:' + i + '">REMOVE</span>';
    actions += '<span class="tag tag-bad" data-act="bCancel:' + i + '">CANCEL</span>';
    actions = clientWaButton(b) + actions;

    return '<div class="b-row">' +
      '<div class="b-col"><span class="b-name">' + esc(b.name) + '</span>' +
        '<span class="b-sub">' + esc(b.contact || b.email || '—') + '</span></div>' +
      '<div class="b-col"><span class="b-mid">' + esc(b.service) + '</span>' +
        '<span class="b-sub">' + esc(b.place) + '</span></div>' +
      '<div class="b-col"><span class="b-mid">' + esc(b.date + ' · ' + b.time) + '</span>' +
        '<span class="b-status">' + esc(b.status.toUpperCase()) + '</span></div>' +
      '<div class="b-actions">' + actions + '</div>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<div class="stats">' +
      '<div class="stat"><p>TO CONFIRM</p><span class="gold">' + count('pending') + '</span></div>' +
      '<div class="stat"><p>CONFIRMED</p><span>' + count('confirmed') + '</span></div>' +
      '<div class="stat"><p>COMPLETED</p><span>' + count('completed') + '</span></div>' +
    '</div>' +
    (bs.length
      ? '<div class="stack">' + rows + '</div>' +
        '<span class="btn-wide" data-act="clearCompleted">CLEAR COMPLETED &amp; CANCELLED</span>'
      : empty('No bookings yet',
          'Requests from the booking page land here. Confirm them, message the client on WhatsApp, mark them complete when the appointment is done, then clear them out.')) +
  '</div>';
}

function panelAvailability() {
  var rows = state.data.hours.map(function (h, i) {
    return '<div class="field-row"><span>' + esc(h.day) + '</span>' +
      '<input type="text" value="' + esc(h.open) + '" data-k="hours.' + i + '.open" ' +
      'placeholder="e.g. 9:00 — 18:00, or leave blank"></div>';
  }).join('');

  return '<div class="main-body narrow">' +
    '<p class="empty-text" style="margin-bottom:22px;color:var(--mute-2)">' +
      'Type the hours you are open. Anything you leave blank shows as closed on the contact page.</p>' +
    '<div class="stack">' + rows + '</div>' +
  '</div>';
}

function panelServices() {
  var svcs = state.data.services.map(function (s, i) {
    return '<div class="a-svc">' +
      '<div class="a-col">' +
        '<div class="a-img-lg frame">' + photo(s.img, 'NO PHOTO') + '</div>' +
        '<div class="upload-row">' +
          '<label class="upload">UPLOAD PHOTO' +
            '<input type="file" accept="image/*" data-upload="services.' + i + '.img"></label>' +
          '<span class="remove-link" data-act="clearImg:services.' + i + '.img">REMOVE</span>' +
        '</div>' +
      '</div>' +
      '<div class="a-fields">' +
        '<input type="text" value="' + esc(s.name) + '" data-k="services.' + i + '.name" placeholder="Service name">' +
        '<div class="a-pair">' +
          '<input type="text" value="' + esc(s.dur) + '" data-k="services.' + i + '.dur" placeholder="Length">' +
          '<input type="text" value="' + esc(s.price) + '" data-k="services.' + i + '.price" placeholder="Price, e.g. 150">' +
        '</div>' +
        '<textarea rows="3" data-k="services.' + i + '.desc" ' +
          'placeholder="Description shown on the services page">' + esc(s.desc) + '</textarea>' +
        '<div class="a-toggle-row">' +
          '<span class="a-toggle-label">' + (s.live ? 'On the site' : 'Hidden') + '</span>' +
          '<span class="a-toggle" data-act="toggle:services.' + i + '.live">TOGGLE</span>' +
        '</div>' +
        '<span class="remove-link" data-act="delService:' + i + '">DELETE THIS SERVICE</span>' +
      '</div>' +
    '</div>';
  }).join('');

  var lashes = state.data.lashes.map(function (l, i) {
    return '<div class="lash-admin">' +
      '<div class="a-img-sm frame">' + photo(l.img, 'NO PHOTO') + '</div>' +
      '<input type="text" value="' + esc(l.name) + '" data-k="lashes.' + i + '.name" placeholder="Lash style">' +
      '<input type="text" value="' + esc(l.price) + '" data-k="lashes.' + i + '.price" placeholder="Add-on price">' +
      '<div class="upload-row">' +
        '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="lashes.' + i + '.img"></label>' +
        '<span class="remove-link" data-act="clearImg:lashes.' + i + '.img">REMOVE PHOTO</span>' +
      '</div>' +
      '<span class="remove-link" data-act="delLash:' + i + '">DELETE THIS STYLE</span>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<p class="empty-text" style="margin-bottom:18px;color:var(--mute-2)">' +
      'Add as many services as you like. Anything switched to Hidden stays here but comes off the website.</p>' +
    (state.data.services.length
      ? '<div class="stack-wide">' + svcs + '</div>'
      : empty('No services yet', 'Add your first one below.')) +
    '<span class="btn-wide" data-act="addService">+ ADD A SERVICE</span>' +
    '<p class="eyebrow" style="margin:40px 0 16px;font-size:9px;letter-spacing:.26em">LASHES</p>' +
    (state.data.lashes.length ? '<div class="lash-admin-grid">' + lashes + '</div>' : '') +
    '<span class="btn-wide" style="margin-top:16px" data-act="addLash">+ ADD A LASH STYLE</span>' +
  '</div>';
}

function panelPortfolio() {
  var g = state.data.gallery;
  var names = liveServices().map(function (x) { return x.s.name; });
  var tiles = g.map(function (item, i) {
    /* keep a tag that no longer matches a service, so renaming one does not wipe it */
    var choices = names.slice();
    if (item.tag && choices.indexOf(item.tag) < 0) choices.push(item.tag);
    var opts = ['<option value="">No tag</option>'].concat(choices.map(function (n) {
      return '<option value="' + esc(n) + '"' + (item.tag === n ? ' selected' : '') + '>' + esc(n) + '</option>';
    })).join('');
    return '<div class="gal-admin">' +
      '<div class="frame">' + photo(item.url, '') + '</div>' +
      '<select class="gal-tag-pick" data-k="gallery.' + i + '.tag">' + opts + '</select>' +
      '<span class="gal-remove" data-act="galRemove:' + i + '">REMOVE</span>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<label class="upload-big">+ ADD PHOTOS<input type="file" accept="image/*" data-upload="gallery"></label>' +
    (g.length
      ? '<div class="gal-admin-grid">' + tiles + '</div>'
      : empty('No photos yet', 'Anything you add here appears on the gallery page and in the portfolio strip on the homepage. Tag a photo with a service and visitors can filter by it.')) +
  '</div>';
}

function panelPages() {
  var d = state.data;
  return '<div class="main-body">' +
    '<div class="pages-grid">' +
      '<div class="pages-col">' +
        '<p class="eyebrow">HOMEPAGE</p>' +
        '<div class="field"><span class="field-label">Script line above the headline</span>' +
          '<input type="text" value="' + esc(d.home.script) + '" data-k="home.script" placeholder="Enhancing your"></div>' +
        '<div class="field"><span class="field-label">Headline (shown in capitals)</span>' +
          '<input type="text" value="' + esc(d.home.headline) + '" data-k="home.headline" placeholder="Natural Beauty"></div>' +
        '<div class="field"><span class="field-label">About paragraph</span>' +
          '<textarea rows="3" data-k="home.sub">' + esc(d.home.sub) + '</textarea></div>' +
        '<div class="field"><span class="field-label">Second about paragraph (optional)</span>' +
          '<textarea rows="5" data-k="home.welcome" placeholder="A few more lines about the studio">' + esc(d.home.welcome) + '</textarea></div>' +
        '<div class="field"><span class="field-label">Quick link pictures — round photos or logos, one per circle</span>' +
          '<div class="icon-grid">' + QUICK_LINKS.map(function (q, i) {
            var has = !!(d.home.quickIcons || [])[i];
            return '<div class="icon-cell">' +
              quickIcon(i) +
              '<span class="icon-name">' + q.label + '</span>' +
              '<label class="upload">' + (has ? 'CHANGE' : 'UPLOAD') +
                '<input type="file" accept="image/*" data-upload="home.quickIcons.' + i + '"></label>' +
              (has ? '<span class="remove-link" data-act="clearImg:home.quickIcons.' + i + '">REMOVE</span>' : '') +
            '</div>';
          }).join('') + '</div></div>' +
        '<div class="field"><span class="field-label">Hero portrait — a cut-out photo works best</span>' +
          '<div class="a-img-lg frame">' + photo(d.home.heroImg, 'NO PHOTO') + '</div>' +
          '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="home.heroImg"></label></div>' +
        '<div class="field"><span class="field-label">Book-with-us cut-out</span>' +
          '<div class="a-img-xs frame">' + photo(d.home.ctaImg, 'NO PHOTO') + '</div>' +
          '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="home.ctaImg"></label></div>' +
      '</div>' +
      '<div class="pages-col">' +
        '<p class="eyebrow">THE ARTIST</p>' +
        '<div class="field"><span class="field-label">Your name (shown large at the top of the page)</span>' +
          '<input type="text" value="' + esc(d.artist.name) + '" data-k="artist.name" placeholder="Arianna Franks"></div>' +
        '<div class="field"><span class="field-label">Tagline under your name</span>' +
          '<input type="text" value="' + esc(d.artist.tagline) + '" data-k="artist.tagline" placeholder="Your trusted makeup artist · St Kitts"></div>' +
        '<div class="field"><span class="field-label">Portrait (tall photo, top of the page)</span>' +
          '<div class="a-img-md frame">' + photo(d.artist.portrait, 'NO PHOTO') + '</div>' +
          '<div class="upload-row">' +
            '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="artist.portrait"></label>' +
            (d.artist.portrait ? '<span class="remove-link" data-act="clearImg:artist.portrait">REMOVE</span>' : '') +
          '</div></div>' +
        '<div class="field"><span class="field-label">One line about you (shown on the homepage)</span>' +
          '<input type="text" value="' + esc(d.artist.intro) + '" data-k="artist.intro" placeholder="Bridal, event and editorial makeup in St Kitts"></div>' +
        '<div class="field"><span class="field-label">Her story — three or four sentences</span>' +
          '<textarea rows="6" data-k="artist.story" placeholder="Tell them who you are">' + esc(d.artist.story) + '</textarea></div>' +
        '<div class="field"><span class="field-label">A line in your own words (shown in script under the story)</span>' +
          '<input type="text" value="' + esc(d.artist.quote) + '" data-k="artist.quote" placeholder="Beauty should feel like you."></div>' +
        '<div class="field"><span class="field-label">Story photo (beside the story)</span>' +
          '<div class="a-img-md frame">' + photo(d.artist.storyImg, 'NO PHOTO') + '</div>' +
          '<div class="upload-row">' +
            '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="artist.storyImg"></label>' +
            (d.artist.storyImg ? '<span class="remove-link" data-act="clearImg:artist.storyImg">REMOVE</span>' : '') +
          '</div></div>' +
        '<p class="eyebrow" style="margin-top:12px">HER THREE FAVOURITE LOOKS</p>' +
        (d.artist.looks || []).map(function (l, i) {
          return '<div class="look-admin">' +
            '<span class="look-num">0' + (i + 1) + '</span>' +
            '<div class="a-img-sm frame">' + photo(l.img, 'NO PHOTO') + '</div>' +
            '<input type="text" value="' + esc(l.name) + '" data-k="artist.looks.' + i + '.name" placeholder="Look name">' +
            '<input type="text" value="' + esc(l.note) + '" data-k="artist.looks.' + i + '.note" placeholder="One line about it">' +
            '<div class="upload-row">' +
              '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="artist.looks.' + i + '.img"></label>' +
              (l.img ? '<span class="remove-link" data-act="clearImg:artist.looks.' + i + '.img">REMOVE</span>' : '') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>' +
  '</div>';
}

/* Policies have a section to themselves: they are the one thing every client
   reads, and they were easy to miss at the foot of the website content. */
function panelPolicies() {
  var written = livePolicies().length, all = state.data.policies || [];

  var boxes = all.map(function (p, i) {
    return '<div class="pol-admin">' +
      '<span class="pol-admin-num">' + pad2(i + 1) + '</span>' +
      '<div class="pol-admin-fields">' +
        '<input type="text" value="' + esc(p.title) + '" data-k="policies.' + i + '.title" ' +
          'placeholder="Heading, e.g. Cancellation">' +
        '<textarea rows="3" data-k="policies.' + i + '.text" ' +
          'placeholder="What you want them to know">' + esc(p.text) + '</textarea>' +
        (p.img ? '<div class="a-img-md frame auto">' + photo(p.img, 'NO PHOTO', true) + '</div>' : '') +
        '<div class="upload-row">' +
          '<label class="upload">' + (p.img ? 'CHANGE PICTURE' : 'ADD A PICTURE') +
            '<input type="file" accept="image/*" data-upload="policies.' + i + '.img"></label>' +
          (p.img ? '<span class="remove-link" data-act="clearImg:policies.' + i + '.img">REMOVE PICTURE</span>' : '') +
        '</div>' +
        '<span class="remove-link" data-act="delPolicy:' + i + '">DELETE THIS ONE</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<p class="empty-text" style="margin:0 0 6px;color:var(--mute-2)">' +
      'A client is shown these on the way to the booking form. They are not a page anyone browses, ' +
      'and they are not in the menu.</p>' +
    '<p class="empty-text" style="margin:0 0 18px;color:var(--mute-2)">' +
      'Type each one out, or add a picture of it if you already have it written somewhere \u2014 both is fine. ' +
      '<strong>A heading on its own stays off the website</strong>, so nothing below is shown to anyone yet ' +
      'unless it has words or a picture in it.</p>' +
    '<p class="conn-line" style="margin:0 0 22px">' +
      (written
        ? '<span class="conn-dot on"></span>' + written + ' of ' + all.length +
          ' ready \u2014 clients see those when they go to book. ' +
          '<span class="link-gold" data-act="go:policies">See the page \u2192</span>'
        : '<span class="conn-dot"></span>Nothing written yet, so booking opens straight onto the form.') +
    '</p>' +
    (all.length ? boxes : empty('No policies yet', 'Add your first one below.')) +
    '<span class="btn-wide" style="margin-top:4px" data-act="addPolicy">+ ADD A POLICY</span>' +
  '</div>';
}

function panelReviews() {
  var rs = state.data.reviews;

  var cards = rs.map(function (r, i) {
    return '<div class="r-card">' +
      '<div class="r-head">' +
        '<span class="r-who">' + esc(r.name) + (r.service ? ' · ' + esc(r.service) : '') + '</span>' +
        '<span class="r-state">' +
          (r.published ? (r.featured ? 'Published · featured at the top of the reviews and artist pages' : 'Published') : 'Waiting for you') +
        '</span>' +
      '</div>' +
      (r.img ? '<img class="r-shot" src="' + esc(r.img) + '" alt="">' : '') +
      (r.text ? '<p class="r-text">' + esc(r.text) + '</p>' : '') +
      '<div class="r-actions">' +
        (!r.published ? '<span class="tag tag-gold tag-lg" data-act="rPublish:' + i + '">APPROVE</span>' : '') +
        (r.text ? '<span class="tag tag-plain tag-lg" data-act="rFeature:' + i + '">FEATURE AT THE TOP</span>' : '') +
        '<span class="tag tag-plain tag-lg" data-act="rUnpublish:' + i + '">HIDE</span>' +
        '<span class="tag tag-bad tag-lg" data-act="rRemove:' + i + '">DELETE</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    (rs.length
      ? '<div class="stack-wide">' + cards + '</div>'
      : empty('No reviews yet', 'Reviews and screenshots sent in from the reviews page arrive here. Nothing shows on the site until you approve it.')) +
  '</div>';
}

function panelClients() {
  var bs = state.data.bookings;
  var byName = {};
  bs.forEach(function (b) {
    var key = String(b.name).toLowerCase();
    if (!byName[key]) byName[key] = { name: b.name, contact: b.contact || b.email || '—', visits: 0, last: b.date };
    byName[key].visits += 1;
  });
  var list = Object.keys(byName).map(function (k) { return byName[k]; });

  var rows = list.map(function (c) {
    return '<div class="c-row">' +
      '<span class="c-name">' + esc(c.name) + '</span>' +
      '<span class="c-contact">' + esc(c.contact) + '</span>' +
      '<span class="c-visits">' + c.visits + (c.visits === 1 ? ' booking' : ' bookings') + '</span>' +
      '<span class="c-last">Last: ' + esc(c.last) + '</span>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    (list.length
      ? '<div class="stack">' + rows + '</div>'
      : empty('No clients yet', 'Everyone who books is listed here with how many times they have been in.')) +
  '</div>';
}

function panelMessages() {
  var ms = state.data.messages;

  var cards = ms.map(function (m, i) {
    return '<div class="m-card">' +
      '<div class="m-head">' +
        '<span class="m-topic">' + esc(m.topic || 'No subject') + '</span>' +
        '<span class="m-from">' + esc(m.name) +
          (m.phone ? ' · ' + esc(m.phone) : '') +
          (m.email ? ' · ' + esc(m.email) : '') + '</span>' +
      '</div>' +
      '<p class="m-body">' + esc(m.message) + '</p>' +
      '<span class="m-del" data-act="mRemove:' + i + '">DELETE</span>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    (ms.length
      ? '<div class="stack-wide">' + cards + '</div>'
      : empty('No messages', 'Anything sent through the contact page arrives here.')) +
  '</div>';
}

var LABELS = { metaWhatsapp: 'WhatsApp (Meta)', whatsapp: 'WhatsApp (Twilio)', callmebot: 'WhatsApp (CallMeBot)', push: 'Push', email: 'Email' };

/* what the server has connected, so it is obvious what still needs setting up in Vercel */
function connections() {
  var su = state.setup || {};
  function row(ok, label, hint) {
    return '<div class="conn' + (ok ? ' on' : '') + '"><span class="conn-dot"></span>' +
      '<span class="conn-label">' + label + '</span>' +
      '<span class="conn-hint">' + (ok ? 'Connected' : hint) + '</span></div>';
  }
  var t = state.notifyTest;
  var results = '';
  if (t === 'sending') {
    results = '<p class="form-note" style="margin-top:12px">Sending…</p>';
  } else if (t && t.none) {
    results = '<p class="err" style="margin-top:12px">No alerts are set up yet. Add one of the above, then redeploy.</p>';
  } else if (t && t.error) {
    results = '<p class="err" style="margin-top:12px">' + esc(t.error) + '</p>';
  } else if (t && t.results) {
    results = '<div class="test-results">' + t.results.map(function (r) {
      return '<p class="' + (r.ok ? 'ok' : 'err') + '">' + esc(LABELS[r.channel] || r.channel) + ': ' +
        (r.ok ? 'sent — check your phone' : esc(r.error)) + '</p>';
    }).join('') + '</div>';
  }

  return '<p class="eyebrow" style="margin-top:36px">CONNECTIONS</p>' +
    '<div class="conn-list">' +
      row(su.storage,  'Storage',  'Add Upstash Redis in the Vercel Storage tab') +
      row(su.photos,   'Photos',   'Add Blob in the Vercel Storage tab') +
      row(su.metaWhatsapp, 'WhatsApp', 'Free and official: set META_WA_TOKEN, META_WA_PHONE_ID and WHATSAPP_PHONE') +
      row(su.whatsapp,  'Twilio',   'Paid alternative: the four TWILIO_ and WHATSAPP_PHONE variables') +
      row(su.callmebot, 'CallMeBot', 'Free WhatsApp fallback: WHATSAPP_PHONE and CALLMEBOT_APIKEY') +
      row(su.push,      'Push',      'Set NTFY_TOPIC — phone notifications, no account') +
      row(su.email,     'Email',     'Set RESEND_API_KEY and NOTIFY_EMAIL') +
    '</div>' +
    '<span class="btn-sm" style="margin-top:16px" data-act="testAlert">SEND A TEST ALERT</span>' +
    results;
}

function panelSettings() {
  var d = state.data;
  return '<div class="main-body mid">' +
    '<p class="eyebrow">CONTACT DETAILS ON THE SITE</p>' +
    '<div class="field"><span class="field-label">Instagram</span>' +
      '<input type="text" value="' + esc(d.brand.ig) + '" data-k="brand.ig"></div>' +
    '<div class="field"><span class="field-label">Email</span>' +
      '<input type="text" value="' + esc(d.brand.email) + '" data-k="brand.email" placeholder="hello@…"></div>' +
    '<div class="field"><span class="field-label">Studio address</span>' +
      '<textarea rows="3" data-k="brand.address">' + esc(d.brand.address) + '</textarea></div>' +
    '<div class="field"><span class="field-label">WhatsApp number — clients get a button to message you the booking</span>' +
      '<input type="text" value="' + esc(d.brand.whatsapp) + '" data-k="brand.whatsapp" placeholder="+1 869 555 0100"></div>' +
    (API.remote ? connections() : '') +
    '<div class="danger">' +
      '<p>START FRESH</p>' +
      '<p>Wipes every booking, review, message and photo, and empties all the copy back to a blank site. ' +
        'There is no undo.</p>' +
      '<span class="btn-danger" data-act="resetAll">CLEAR EVERYTHING</span>' +
    '</div>' +
  '</div>';
}

/* =========================================================================
   RENDER
   ========================================================================= */

var lastView = null;

/* Call before render() when a change deserves the page transition again. */
function animateNext() { lastView = null; }

function render() {
  var inAdmin = state.page === 'admin';
  var html = '';

  if (inAdmin) {
    html = state.logged ? panel() : loginPage();
  } else {
    html += nav();
    if (state.page === 'home')     html += homePage();
    if (state.page === 'services') html += servicesPage();
    if (state.page === 'gallery')  html += galleryPage();
    if (state.page === 'artist')   html += artistPage();
    if (state.page === 'reviews')  html += reviewsPage();
    if (state.page === 'booking')  html += bookingPage();
    if (state.page === 'policies') html += policiesPage();
    if (state.page === 'contact')  html += contactPage();
    html += footer();
  }

  /* remember where the caret was, so a re-render mid-typing does not throw the visitor out of the field */
  var active = document.activeElement, key = active && (active.getAttribute('data-k') || active.id), pos = null;
  if (key && typeof active.selectionStart === 'number') pos = [active.selectionStart, active.selectionEnd];

  /* Picking a date or a time re-renders the same page. Replaying the entry
     animation there makes every click look like a page reload, so the
     transition only runs when the view actually changes — and the scroll
     position is put back, since replacing the markup can reset it. */
  var view = state.page + '|' + (inAdmin ? (state.logged ? state.section : 'login') : '');
  var sameView = (view === lastView);
  var y = window.scrollY;
  var appEl = document.getElementById('app');

  appEl.classList.toggle('still', sameView);
  appEl.innerHTML = html;
  lastView = view;
  if (sameView && window.scrollY !== y) window.scrollTo(0, y);

  if (key) {
    var again = document.querySelector('[data-k="' + key + '"]') || document.getElementById(key);
    if (again && again !== document.activeElement) {
      again.focus();
      if (pos && typeof again.setSelectionRange === 'function') { try { again.setSelectionRange(pos[0], pos[1]); } catch (e) {} }
    }
  }

  if (state.page === 'policies') { watchPolicyIndex(); markPolicy(); }
}

/* The index down the side of the policies marks whichever one is being read.
   One listener, added the first time the page is opened and left in place; it
   does nothing when no policy is on screen. */
var polSpy = false;
function watchPolicyIndex() {
  if (polSpy) return;
  polSpy = true;
  window.addEventListener('scroll', markPolicy, { passive: true });
}

function onScreen(el) {
  var r = el.getBoundingClientRect();
  return r.bottom > 80 && r.top < window.innerHeight - 40;
}

function markPolicy() {
  var items = document.querySelectorAll('.pol-item');
  var links = document.querySelectorAll('.pol-index-item');
  if (!items.length || !links.length) return;

  /* One picked from the index stays marked while it is still on screen. In two
     columns there is no single "current" policy to work out from the scroll
     position alone, so otherwise it is whichever heading sits nearest the top
     of the reading area. */
  var at = -1;
  /* the scroll to it is animated, so it is not on screen for the first moment */
  var justPicked = state.polAt != null && Date.now() - state.polAtAt < 1400;
  if (state.polAt != null && items[state.polAt] && (justPicked || onScreen(items[state.polAt]))) {
    at = state.polAt;
  } else {
    state.polAt = null;
    var best = Infinity;
    for (var i = 0; i < items.length; i++) {
      var d = Math.abs(items[i].getBoundingClientRect().top - 160);
      if (d < best) { best = d; at = i; }
    }
  }
  for (var j = 0; j < links.length; j++) links[j].classList.toggle('on', j === at);
}

/* =========================================================================
   ACTIONS  —  wired by data-act="name:argument"
   ========================================================================= */

/* one server call for an inbox item, or the same change made locally */
function inbox(kind, method, payload, apply) {
  if (!API.remote) { apply(); save(); render(); return; }
  API.call(method, '/api/' + kind, payload)
    .then(function () { apply(); render(); })
    .catch(function (e) { flash('inbox-error:' + e.message); });
}

/* A booking went through: clear the form completely and show the confirmation. */
function finishBooking(item) {
  state.booked = item;
  state.data.form = { name: '', contact: '', email: '', occasion: '', notes: '', svc: '', date: '', time: '', place: '' };
  saveForms();
  state.flash = '';
  animateNext();
  render();
  window.scrollTo(0, 0);
}

/* a public form: send it to the server, or keep it here on a local copy */
function submit(path, payload, local, okFlash) {
  if (!API.remote) { local(); save(); flash(okFlash); return; }
  flash('sending');
  API.post(path, payload)
    .then(function () { flash(okFlash); })
    .catch(function (e) { flash('send-error:' + e.message); });
}

var actions = {
  go:      function (p) { var h = p.split('#'); go(h[0], h[1]); },

  /* read, and on to the form */
  policiesRead: function () { state.readPolicies = true; go('booking'); },
  polJump: function (i) {
    var el = document.getElementById('pol-' + Number(i));
    if (!el) return;
    state.polAt = Number(i);
    state.polAtAt = Date.now();
    markPolicy();
    el.scrollIntoView({ behavior: 'smooth' });
  },
  sec:     function (s) { goSection(s); },

  signIn: function () {
    var pw = document.getElementById('pw');
    if (!API.remote) { state.logged = true; render(); window.scrollTo(0, 0); return; }
    state.loginError = '';
    flash('signing-in');
    API.post('/api/session', { password: pw ? pw.value : '' })
      .then(function () { return API.get('/api/session'); })
      .then(function (r) {
        state.logged = true; state.setup = r.setup || null; state.flash = '';
        render(); window.scrollTo(0, 0);
        loadInbox();
        watchInbox();
      })
      .catch(function (e) { state.loginError = e.message; state.flash = ''; render(); });
  },
  signOut: function () {
    clearInterval(inboxTimer); inboxTimer = null;
    if (API.remote) API.del('/api/session').catch(function () {});
    state.logged = false; state.page = 'home';
    state.data.bookings = []; state.data.messages = [];
    if (API.remote) API.get('/api/content').then(function (r) { state.data.reviews = r.reviews || []; render(); }).catch(function () {});
    render(); window.scrollTo(0, 0);
  },

  /* booking flow */
  book: function (i) {
    state.booked = null;
    setPath('form.svc', state.data.services[i].name);
    go('booking');
  },

  bookAnother: function () {
    state.booked = null;
    animateNext();
    render();
    window.scrollTo(0, 0);
  },
  pick:  function (i) { setPath('form.svc', state.data.services[i].name); render(); },
  day:   function (iso) { setPath('form.date', iso); render(); },
  month: function (step) {
    state.calOffset = Math.min(Math.max((state.calOffset || 0) + Number(step), 0), MONTHS_AHEAD);
    render();
  },
  slot:  function (t) { setPath('form.time', t); render(); },
  place: function (p) { setPath('form.place', p); render(); },

  sendBooking: function () {
    var f = state.data.form;
    if (!f.name || !f.contact || !f.svc || !isIso(f.date) || !f.time) { flash('booking-error'); return; }
    if (isoToDate(f.date) < todayStart()) { flash('booking-past'); return; }
    var item = {
      id: 'b' + Date.now(), at: Date.now(),
      name: f.name, contact: f.contact, email: f.email,
      occasion: f.occasion, notes: f.notes, service: f.svc,
      date: prettyDate(f.date), dateISO: f.date, time: f.time,
      place: f.place || 'Studio', status: 'pending'
    };
    if (state.sending) return;
    if (!API.remote) { state.data.bookings.unshift(item); save(); finishBooking(item); return; }
    state.sending = true; state.flash = ''; render();
    API.post('/api/bookings', item)
      .then(function () { state.sending = false; finishBooking(item); })
      .catch(function (e) { state.sending = false; flash('send-error:' + e.message); });
  },

  sendReview: function () {
    var r = state.data.rform;
    if (!r.name || (!r.text && !r.img)) { flash('review-error'); return; }
    var item = {
      id: 'r' + Date.now(), at: Date.now(), name: r.name, service: r.service || '', text: r.text || '', img: r.img || '',
      published: false, featured: false
    };
    submit('/api/reviews', item, function () { state.data.reviews.unshift(item); }, 'review-sent');
    state.data.rform = { name: '', service: '', text: '', img: '' };
    saveForms();
  },

  sendMessage: function () {
    var c = state.data.cform;
    /* a number is the one thing she needs to answer them, so it is not optional */
    if (!c.name || !c.phone || !c.message) { flash('message-error'); return; }
    var item = { id: 'm' + Date.now(), at: Date.now(), name: c.name, phone: c.phone,
      email: c.email, topic: c.topic, message: c.message, read: false };
    submit('/api/messages', item, function () { state.data.messages.unshift(item); }, 'message-sent');
    state.data.cform = { name: '', phone: '', email: '', topic: '', message: '' };
    saveForms();
  },

  /* panel — services and lashes */
  addService: function () {
    state.data.services.push({ name: 'New service', dur: '', price: '', desc: '', img: '', live: true });
    save(); render();
  },
  delService: function (i) {
    var s = state.data.services[Number(i)];
    if (!window.confirm('Delete "' + (s.name || 'this service') + '"? Bookings already taken for it are not affected.')) return;
    state.data.services.splice(Number(i), 1);
    save(); render();
  },
  addPolicy: function () {
    state.data.policies.push({ title: '', text: '', img: '' });
    save(); render();
  },
  delPolicy: function (i) {
    var p = state.data.policies[Number(i)];
    if (!window.confirm('Delete "' + (p.title || p.text || 'this policy') + '"?')) return;
    state.data.policies.splice(Number(i), 1);
    save(); render();
  },
  addLash: function () {
    state.data.lashes.push({ name: 'New lash style', price: '', img: '' });
    save(); render();
  },
  delLash: function (i) {
    var l = state.data.lashes[Number(i)];
    if (!window.confirm('Delete "' + (l.name || 'this style') + '"?')) return;
    state.data.lashes.splice(Number(i), 1);
    save(); render();
  },

  /* panel — content */
  toggle:   function (path) { setPath(path, !getPath(path)); render(); },
  clearImg: function (path) { setPath(path, ''); render(); },
  galRemove: function (i) { state.data.gallery.splice(Number(i), 1); save(); render(); },

  /* panel — bookings */
  bConfirm:  function (i) { setStatus(i, 'confirmed'); },
  bComplete: function (i) { setStatus(i, 'completed'); },
  bCancel:   function (i) { setStatus(i, 'cancelled'); },
  bRemove:   function (i) {
    var b = state.data.bookings[Number(i)];
    inbox('bookings', 'DELETE', { id: b.id }, function () { state.data.bookings.splice(Number(i), 1); });
  },
  clearCompleted: function () {
    inbox('bookings', 'DELETE', { clear: true }, function () {
      state.data.bookings = state.data.bookings.filter(function (b) {
        return b.status !== 'completed' && b.status !== 'cancelled';
      });
    });
  },

  /* panel — reviews */
  rPublish:   function (i) { setPublished(i, true); },
  rUnpublish: function (i) { setPublished(i, false); },
  rFeature:   function (i) {
    var r = state.data.reviews[Number(i)];
    inbox('reviews', 'PATCH', { id: r.id, featured: true }, function () {
      state.data.reviews.forEach(function (x, j) { x.featured = (j === Number(i)); });
      r.published = true;
    });
  },
  rRemove: function (i) {
    var r = state.data.reviews[Number(i)];
    inbox('reviews', 'DELETE', { id: r.id }, function () { state.data.reviews.splice(Number(i), 1); });
  },

  /* panel — messages */
  mRemove: function (i) {
    var m = state.data.messages[Number(i)];
    inbox('messages', 'DELETE', { id: m.id }, function () { state.data.messages.splice(Number(i), 1); });
  },

  /* gallery */
  galFilter: function (t) { state.gal.filter = t; state.gal.i = 0; render(); },
  galOpen:   function (i) { state.gal.open = true; state.gal.i = Number(i); render(); },
  galClose:  function () { state.gal.open = false; render(); },
  galStep:   function (d) {
    var n = galleryShown().length;
    if (n) state.gal.i = ((state.gal.i + Number(d)) % n + n) % n;
    render();
  },

  refreshInbox: function () { loadInbox(); },

  /* panel — settings */
  testAlert: function () {
    state.notifyTest = 'sending';
    render();
    API.post('/api/notify-test')
      .then(function (r) { state.notifyTest = r; render(); })
      .catch(function (e) { state.notifyTest = { error: e.message }; render(); });
  },

  resetAll: function () {
    if (!window.confirm('Clear everything and start fresh? Bookings, reviews, messages, photos and all copy will be wiped.')) return;
    var wipe = function () { state.data = blank(); state.section = 'bookings'; render(); };
    if (!API.remote) { wipe(); save(); return; }
    API.post('/api/reset').then(wipe).catch(function (e) { flash('inbox-error:' + e.message); });
  }
};

function setStatus(i, status) {
  var b = state.data.bookings[Number(i)];
  inbox('bookings', 'PATCH', { id: b.id, status: status }, function () { b.status = status; });
}

function setPublished(i, on) {
  var r = state.data.reviews[Number(i)];
  inbox('reviews', 'PATCH', { id: r.id, published: on }, function () { r.published = on; if (!on) r.featured = false; });
}

/* =========================================================================
   EVENTS
   ========================================================================= */

var app = document.getElementById('app');

app.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var raw = el.getAttribute('data-act');
  var c = raw.indexOf(':');
  var name = c < 0 ? raw : raw.slice(0, c);
  var arg  = c < 0 ? '' : raw.slice(c + 1);
  if (actions[name]) actions[name](arg, el);
});

/* Coming back to the tab is a good moment to check for anything new. */
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && API.remote && state.logged &&
      state.page === 'admin' && INBOX_SECTIONS[state.section]) {
    loadInbox(true);
  }
});

app.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.id === 'pw') actions.signIn();
});

/* The lightbox answers to Escape and the arrow keys. */
document.addEventListener('keydown', function (e) {
  if (!state.gal || !state.gal.open) return;
  if (e.key === 'Escape')     { actions.galClose(); }
  if (e.key === 'ArrowRight') { actions.galStep(1); }
  if (e.key === 'ArrowLeft')  { actions.galStep(-1); }
});

/* Typing saves without re-rendering, so the caret stays put. */
app.addEventListener('input', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-k');
  if (k) setPath(k, e.target.value);
});

/* Leaving a field re-renders, so the site picks up the new text.
   The render waits a tick so focus has already moved to the next field, and stays there. */
app.addEventListener('change', function (e) {
  var t = e.target;
  if (t.type === 'file') { handleUpload(t); return; }
  var k = t.getAttribute && t.getAttribute('data-k');
  if (k) { setPath(k, t.value); setTimeout(render, 0); }
});

/* --- image uploads ------------------------------------------------------ */

/* How big an upload may get once encoded. The server allows more, so this
   leaves room to spare rather than sailing close to the limit. */
var UPLOAD_BUDGET = 1.2 * 1024 * 1024;

function dataUrlBytes(u) {
  var i = u.indexOf(',');
  return i < 0 ? u.length : Math.round((u.length - i - 1) * 0.75);
}

/* Is any part of this picture see-through? Sampled rather than scanned, which
   is plenty to tell a cut-out from an ordinary photograph. */
function isTransparent(canvas) {
  try {
    var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    var step = Math.max(4, Math.floor(d.length / 4 / 20000) * 4);
    for (var i = 3; i < d.length; i += step) if (d[i] < 250) return true;
  } catch (e) { /* a picture the page may not read back; treat it as opaque */ }
  return false;
}

/* Photos are shrunk in the browser before they go anywhere.

   max: longest side in pixels.
   allowPng: this slot can hold a cut-out, so keep transparency IF the picture
   actually has any. A photograph saved as a PNG is opaque, and re-encoding it
   as a PNG makes a file many times larger than an upload allows, which is what
   used to make the hero and cut-out uploads fail. Either way the picture is
   made smaller until it fits, so a big photo from a phone always goes through. */
function shrink(url, done, max, allowPng) {
  var img = new Image();
  img.onload = function () {
    var draw = function (limit) {
      var scale = Math.min(1, limit / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width  = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c;
    };

    var limit = max || 1200;
    var keepPng = allowPng && isTransparent(draw(limit));

    for (var i = 0; i < 7; i++) {
      var c = draw(limit);
      var out = keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', i > 2 ? 0.72 : 0.82);
      if (dataUrlBytes(out) <= UPLOAD_BUDGET || limit <= 360) { done(out); return; }
      limit = Math.round(limit * 0.75);
    }
  };
  img.onerror = function () { done(url); };
  img.src = url;
}

function handleUpload(input) {
  var path = input.getAttribute('data-upload');
  var file = input.files && input.files[0];
  input.value = '';
  if (!file || !path) return;

  var icon = path.indexOf('home.quickIcons.') === 0;
  /* Any PNG may be a cut-out or a logo; whether it really is decides the format. */
  var allowPng = file.type === 'image/png';

  var place = function (url) {
    if (path === 'gallery') { state.data.gallery.unshift({ url: url, tag: '' }); save(); }
    else setPath(path, url);
    render();
  };

  var reader = new FileReader();
  reader.onload = function () {
    shrink(String(reader.result), function (dataUrl) {
      /* a visitor's review picture rides along with the review; everything else goes up now */
      if (!API.remote || path === 'rform.img') { place(dataUrl); return; }
      setSaveNote('Uploading photo…');
      API.post('/api/upload', { data: dataUrl })
        .then(function (r) { setSaveNote('Saved'); place(r.url); })
        .catch(function (e) {
          flash('inbox-error:' + e.message);
          window.scrollTo(0, 0);   // the message sits at the top of the panel
        });
    }, icon ? 320 : path === 'rform.img' ? 900 : 1200, allowPng);
  };
  reader.readAsDataURL(file);
}

/* --- start -------------------------------------------------------------- */

boot();
