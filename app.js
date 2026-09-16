/* ==========================================================================
   ROSÉ Creative Artistry — app logic
   Plain JavaScript. No build step, no libraries.

   How it works
   ------------
   state          current page + all saved content
   render()       rebuilds #app from state, called after every change
   localStorage   everything the studio panel edits is saved under KEY

   Adding a page:  write a xxxPage() function, then add it to render().
   Adding a panel section:  add it to SECTIONS and write a section function.
   ========================================================================== */

var KEY = 'rose-studio-v1';

var SECTIONS = {
  bookings:     'Bookings',
  availability: 'Availability',
  services:     'Services & prices',
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
  flash: ''            // transient confirmation message
};

/* --- storage ------------------------------------------------------------ */

function blank() { return JSON.parse(JSON.stringify(DEFAULT_CONTENT)); }

function load() {
  state.data = blank();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var saved = JSON.parse(raw);
      state.data = Object.assign(blank(), saved);
      /* nested objects are merged too, so fields added later still get their defaults */
      ['home', 'artist', 'brand'].forEach(function (k) {
        if (saved[k]) state.data[k] = Object.assign(blank()[k], saved[k]);
      });
    }
  } catch (e) { /* private browsing, corrupt data — start blank */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state.data)); } catch (e) {}
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

/* photo frame contents: the image, or a labelled placeholder */
function photo(url, label) {
  if (url) return '<div class="fill" style="background-image:url(' + String(url).replace(/["()]/g, '') + ')"></div>';
  return '<div class="ph"><span class="ph-label">' + esc(label || '') + '</span></div>';
}

function getPath(path) {
  return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state.data);
}

function setPath(path, val) {
  var ks = path.split('.'), o = state.data;
  for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
  save();
}

function monthMeta() {
  var now = new Date();
  return {
    label: MONTHS[now.getMonth()] + ' ' + now.getFullYear(),
    days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  };
}

function flash(msg) {
  state.flash = msg;
  render();
  setTimeout(function () {
    if (state.flash === msg) { state.flash = ''; render(); }
  }, 2600);
}

/* go('services', 'policies') opens the page and scrolls to the element with that id */
function go(page, anchor) {
  state.page = page;
  state.flash = '';
  render();
  var el = anchor ? document.getElementById(anchor) : null;
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}

function goSection(sec) {
  state.section = sec;
  state.flash = '';
  render();
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
  { to: 'artist#work',  label: 'PORTFOLIO',
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
  var tiles = d.gallery.slice(0, 6);
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
          '<div class="hero-portrait cutout' + (h.heroImg ? ' has-img' : '') + '">' +
            (h.heroImg
              ? photo(h.heroImg, '')
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
          '<div class="bookband-cutout cutout' + (h.ctaImg ? ' has-img' : '') + '">' + photo(h.ctaImg, 'CUT-OUT PORTRAIT') + '</div>' +
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
        '<span class="btn-ghost" data-act="go:artist#work">SEE THE FULL GALLERY</span>' +
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

    '<section class="policy-band" data-act="go:services#policies">' +
      '<div class="policy-band-copy">' +
        '<span class="policy-band-label">BEFORE YOU BOOK</span>' +
        '<h3>Deposits, timing, travel and touch-ups.</h3>' +
      '</div>' +
      '<span class="policy-band-link">READ THE POLICIES →</span>' +
    '</section>' +

    '<section class="policies" id="policies">' +
      '<p class="eyebrow">GOOD TO KNOW</p>' +
      (d.policies
        ? '<p>' + esc(d.policies) + '</p>'
        : '<p class="empty-hint">Your policies will appear here — add them in the studio panel under Website content.</p>') +
    '</section>' +

    '<div class="tail-cta"><span class="btn" data-act="go:booking">BOOK A SERVICE</span></div>' +
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

  var work = '';
  if (d.gallery.length) {
    work = '<section class="work" id="work">' +
      '<div class="work-head">' +
        '<h2>Selected work</h2>' +
        '<span class="eyebrow">' + d.gallery.length + (d.gallery.length === 1 ? ' PHOTO' : ' PHOTOS') + '</span>' +
      '</div>' +
      '<div class="work-grid">' +
        d.gallery.map(function (u) { return '<div class="work-tile frame">' + photo(u, '') + '</div>'; }).join('') +
      '</div>' +
    '</section>';
  }

  return '<div class="page artist">' +

    '<section class="artist-hero">' +
      '<div class="artist-hero-copy">' +
        '<span class="artist-script">Meet your artist</span>' +
        '<h1 class="artist-name">' + esc(a.name || 'Rosé') + '</h1>' +
        '<div class="band-rule"></div>' +
        '<span class="artist-tagline">' + esc(a.tagline || 'Your trusted makeup artist · St Kitts') + '</span>' +
      '</div>' +
      '<div class="artist-figure">' +
        '<div class="artist-frame">' +
          '<div class="artist-portrait">' + photo(a.portrait, 'PORTRAIT') + '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="story">' +
      '<div class="story-img frame">' + photo(a.storyImg, 'PHOTO') + '</div>' +
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

    work +

    '<section class="artist-tail">' +
      '<h2>I would love to do your makeup.</h2>' +
      '<span class="btn" data-act="go:booking">BOOK WITH ' + esc(first) + '</span>' +
    '</section>' +
  '</div>';
}

function reviewsPage() {
  var d = state.data;
  var pub = d.reviews.filter(function (r) { return r.published; });

  var list = pub.length
    ? '<div class="review-list">' + pub.map(function (r) {
        return '<article class="review">' +
          '<div class="review-head">' +
            '<span class="review-name">' + esc(r.name) + '</span>' +
            '<span class="review-meta">' + esc(r.service ? r.service.toUpperCase() : 'ROSÉ CLIENT') + '</span>' +
          '</div>' +
          '<p class="review-text">' + esc(r.text) + '</p>' +
        '</article>';
      }).join('') + '</div>'
    : '<div class="review-none"><p class="empty-hint">No reviews published yet. ' +
      'If you have been in the chair, leave the first one.</p></div>';

  return '<div class="page">' +
    '<div class="page-head">' +
      '<p class="eyebrow">REVIEWS</p>' +
      '<h1>Kind words</h1>' +
      '<p class="review-count">' +
        (pub.length ? pub.length + (pub.length === 1 ? ' REVIEW' : ' REVIEWS') : 'NO REVIEWS YET') +
      '</p>' +
    '</div>' +
    list +
    '<section class="review-form">' +
      '<h2>Leave a review</h2>' +
      '<input type="text" value="' + esc(d.rform.name) + '" data-k="rform.name" placeholder="Your name">' +
      '<input type="text" value="' + esc(d.rform.service) + '" data-k="rform.service" placeholder="Which service?">' +
      '<textarea rows="4" data-k="rform.text" placeholder="How was it?">' + esc(d.rform.text) + '</textarea>' +
      '<div class="form-foot">' +
        '<span class="form-note">Rosé approves reviews before they appear.</span>' +
        '<span class="btn-send" data-act="sendReview">SEND REVIEW</span>' +
      '</div>' +
      (state.flash === 'review-sent' ? '<p class="ok">Thank you — sent to Rosé for approval.</p>' : '') +
    '</section>' +
  '</div>';
}

function bookingPage() {
  var d = state.data, mm = monthMeta();

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

  var days = '';
  for (var i = 1; i <= mm.days; i++) {
    days += '<span class="cal-day' + (d.form.date === String(i) ? ' sel' : '') + '" data-act="day:' + i + '">' + i + '</span>';
  }

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
        '<p class="month">' + esc(mm.label) + '</p>' +
        '<div class="cal">' + days + '</div>' +
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
        '<input type="text" value="' + esc(d.form.name) + '" data-k="form.name" placeholder="Full name">' +
        '<input type="text" value="' + esc(d.form.contact) + '" data-k="form.contact" placeholder="Phone / WhatsApp">' +
        '<input type="text" value="' + esc(d.form.email) + '" data-k="form.email" placeholder="Email">' +
        '<input type="text" value="' + esc(d.form.occasion) + '" data-k="form.occasion" placeholder="Occasion">' +
      '</div>' +
      '<textarea rows="3" data-k="form.notes" style="margin-top:16px" ' +
        'placeholder="Anything I should know? Allergies, inspiration, where you&#39;ll be getting ready">' +
        esc(d.form.notes) + '</textarea>' +
    '</section>' +

    '<section class="confirm">' +
      '<div>' +
        '<div class="step-head"><span class="step-num">STEP 04</span><h2 class="step-title">Confirm</h2></div>' +
        '<p class="confirm-copy">Your request goes straight to Rosé\'s studio panel. ' +
          'She confirms it, and you get a note back.</p>' +
      '</div>' +
      '<div class="summary">' +
        '<div class="sum-row"><span>Service</span><span>' + esc(d.form.svc || '—') + '</span></div>' +
        '<div class="sum-row"><span>Date</span><span>' + esc(d.form.date ? d.form.date + ' ' + mm.label : '—') + '</span></div>' +
        '<div class="sum-row"><span>Time</span><span>' + esc(d.form.time || '—') + '</span></div>' +
        '<div class="sum-row"><span>Location</span><span>' + esc(d.form.place || '—') + '</span></div>' +
        '<div class="rule"></div>' +
        '<span class="btn-confirm" data-act="sendBooking">REQUEST THIS APPOINTMENT</span>' +
        (state.flash === 'booking-sent'
          ? '<p class="ok">Sent. It is now waiting in the studio panel as a pending booking.</p>' : '') +
        (state.flash === 'booking-error'
          ? '<p class="err">Add your name, a service, a date and a time first.</p>' : '') +
      '</div>' +
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
        '<input type="text" value="' + esc(d.cform.name) + '" data-k="cform.name" placeholder="Your name">' +
        '<input type="text" value="' + esc(d.cform.email) + '" data-k="cform.email" placeholder="Email or WhatsApp">' +
        '<input type="text" value="' + esc(d.cform.topic) + '" data-k="cform.topic" placeholder="What can I help with?">' +
        '<textarea rows="5" data-k="cform.message" placeholder="Your message">' + esc(d.cform.message) + '</textarea>' +
        '<span class="btn-msg" data-act="sendMessage">SEND MESSAGE</span>' +
        (state.flash === 'message-sent' ? '<p class="ok">Sent — it is in the studio inbox.</p>' : '') +
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
        '<span class="foot-link" data-act="go:artist">The Artist</span>' +
        '<span class="foot-link" data-act="go:reviews">Reviews</span>' +
        '<span class="foot-link" data-act="go:booking">Booking</span>' +
        '<span class="foot-link" data-act="go:contact">Contact</span>' +
      '</div>' +
      '<div class="foot-col">' +
        '<span class="foot-label">GOOD TO KNOW</span>' +
        '<span class="foot-link" data-act="go:services#policies">Policies</span>' +
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
  return '<div class="login page-fade">' +
    '<div class="login-art">' +
      '<div class="login-art-inner">' +
        '<span class="login-art-name">ROSÉ</span>' +
        '<span class="login-art-sub">CREATIVE ARTISTRY · STUDIO ADMIN</span>' +
      '</div>' +
    '</div>' +
    '<div class="login-form">' +
      '<div>' +
        '<h1>Welcome back, Rosé.</h1>' +
        '<p class="lede">Sign in to manage bookings and update the website.</p>' +
      '</div>' +
      '<div class="info"><span class="info-label">EMAIL</span>' +
        '<input type="text" placeholder="rose@rosecreativeartistry.com"></div>' +
      '<div class="info"><span class="info-label">PASSWORD</span>' +
        '<input type="password" placeholder="••••••••••••"></div>' +
      '<span class="btn-signin" data-act="signIn">SIGN IN</span>' +
      '<div class="demo-box">' +
        '<p class="t">DEMO LOGIN</p>' +
        '<p class="b">Email <strong>rose@rosecreativeartistry.com</strong><br>' +
          'Password <strong>RoseStudio2026</strong></p>' +
        '<p class="s">A demo sign-in — any details get you in. Real passwords come with the live build.</p>' +
      '</div>' +
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
        '<span class="main-note">Changes save as you type and show on the website straight away</span>' +
      '</div>' +
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
          'Requests from the booking page land here. Confirm them, mark them complete when the appointment is done, then clear them out.')) +
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
        '<span class="remove-link" data-act="clearImg:lashes.' + i + '.img">REMOVE</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<div class="stack-wide">' + svcs + '</div>' +
    '<p class="eyebrow" style="margin:40px 0 16px;font-size:9px;letter-spacing:.26em">LASHES</p>' +
    '<div class="lash-admin-grid">' + lashes + '</div>' +
  '</div>';
}

function panelPortfolio() {
  var g = state.data.gallery;
  var tiles = g.map(function (u, i) {
    return '<div class="gal-admin">' +
      '<div class="frame">' + photo(u, '') + '</div>' +
      '<span class="gal-remove" data-act="galRemove:' + i + '">REMOVE</span>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    '<label class="upload-big">+ ADD PHOTOS<input type="file" accept="image/*" data-upload="gallery"></label>' +
    (g.length
      ? '<div class="gal-admin-grid">' + tiles + '</div>'
      : empty('No photos yet', 'Anything you add here appears in the portfolio on the homepage and the artist page.')) +
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
        '<p class="eyebrow" style="margin-top:12px">SERVICES PAGE — GOOD TO KNOW</p>' +
        '<textarea rows="5" data-k="policies" ' +
          'placeholder="Deposits, cancellations, travel, how to prep">' + esc(d.policies) + '</textarea>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function panelReviews() {
  var rs = state.data.reviews;

  var cards = rs.map(function (r, i) {
    return '<div class="r-card">' +
      '<div class="r-head">' +
        '<span class="r-who">' + esc(r.name) + ' · ' + esc(r.service || '—') + '</span>' +
        '<span class="r-state">' +
          (r.published ? (r.featured ? 'Published · featured on homepage' : 'Published') : 'Waiting for you') +
        '</span>' +
      '</div>' +
      '<p class="r-text">' + esc(r.text) + '</p>' +
      '<div class="r-actions">' +
        (!r.published ? '<span class="tag tag-gold tag-lg" data-act="rPublish:' + i + '">APPROVE</span>' : '') +
        '<span class="tag tag-plain tag-lg" data-act="rFeature:' + i + '">FEATURE ON HOMEPAGE</span>' +
        '<span class="tag tag-plain tag-lg" data-act="rUnpublish:' + i + '">HIDE</span>' +
        '<span class="tag tag-bad tag-lg" data-act="rRemove:' + i + '">DELETE</span>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="main-body">' +
    (rs.length
      ? '<div class="stack-wide">' + cards + '</div>'
      : empty('No reviews yet', 'Reviews left on the reviews page arrive here. Nothing shows on the site until you approve it.')) +
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
        '<span class="m-from">' + esc(m.name) + ' · ' + esc(m.email || '—') + '</span>' +
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

function render() {
  var inAdmin = state.page === 'admin';
  var html = '';

  if (inAdmin) {
    html = state.logged ? panel() : loginPage();
  } else {
    html += nav();
    if (state.page === 'home')     html += homePage();
    if (state.page === 'services') html += servicesPage();
    if (state.page === 'artist')   html += artistPage();
    if (state.page === 'reviews')  html += reviewsPage();
    if (state.page === 'booking')  html += bookingPage();
    if (state.page === 'contact')  html += contactPage();
    html += footer();
  }

  document.getElementById('app').innerHTML = html;
}

/* =========================================================================
   ACTIONS  —  wired by data-act="name:argument"
   ========================================================================= */

var actions = {
  go:      function (p) { var h = p.split('#'); go(h[0], h[1]); },
  sec:     function (s) { goSection(s); },
  signIn:  function () { state.logged = true; render(); window.scrollTo(0, 0); },
  signOut: function () { state.logged = false; state.page = 'home'; render(); window.scrollTo(0, 0); },

  /* booking flow */
  book: function (i) {
    setPath('form.svc', state.data.services[i].name);
    go('booking');
  },
  pick:  function (i) { setPath('form.svc', state.data.services[i].name); render(); },
  day:   function (n) { setPath('form.date', String(n)); render(); },
  slot:  function (t) { setPath('form.time', t); render(); },
  place: function (p) { setPath('form.place', p); render(); },

  sendBooking: function () {
    var f = state.data.form;
    if (!f.name || !f.svc || !f.date || !f.time) { flash('booking-error'); return; }
    state.data.bookings.unshift({
      id: 'b' + Date.now(),
      name: f.name, contact: f.contact, email: f.email,
      occasion: f.occasion, notes: f.notes, service: f.svc,
      date: f.date + ' ' + monthMeta().label, time: f.time,
      place: f.place || 'Studio', status: 'pending'
    });
    f.name = ''; f.contact = ''; f.email = ''; f.occasion = ''; f.notes = '';
    save();
    flash('booking-sent');
  },

  sendReview: function () {
    var r = state.data.rform;
    if (!r.name || !r.text) return;
    state.data.reviews.unshift({
      id: 'r' + Date.now(), name: r.name, service: r.service, text: r.text,
      published: false, featured: false
    });
    state.data.rform = { name: '', service: '', text: '' };
    save();
    flash('review-sent');
  },

  sendMessage: function () {
    var c = state.data.cform;
    if (!c.name || !c.message) return;
    state.data.messages.unshift({
      id: 'm' + Date.now(), name: c.name, email: c.email,
      topic: c.topic, message: c.message, read: false
    });
    state.data.cform = { name: '', email: '', topic: '', message: '' };
    save();
    flash('message-sent');
  },

  /* panel — content */
  toggle:   function (path) { setPath(path, !getPath(path)); render(); },
  clearImg: function (path) { setPath(path, ''); render(); },
  galRemove: function (i) { state.data.gallery.splice(Number(i), 1); save(); render(); },

  /* panel — bookings */
  bConfirm:  function (i) { setPath('bookings.' + i + '.status', 'confirmed'); render(); },
  bComplete: function (i) { setPath('bookings.' + i + '.status', 'completed'); render(); },
  bCancel:   function (i) { setPath('bookings.' + i + '.status', 'cancelled'); render(); },
  bRemove:   function (i) { state.data.bookings.splice(Number(i), 1); save(); render(); },
  clearCompleted: function () {
    state.data.bookings = state.data.bookings.filter(function (b) {
      return b.status !== 'completed' && b.status !== 'cancelled';
    });
    save(); render();
  },

  /* panel — reviews */
  rPublish:   function (i) { setPath('reviews.' + i + '.published', true); render(); },
  rUnpublish: function (i) { setPath('reviews.' + i + '.published', false); render(); },
  rFeature:   function (i) {
    state.data.reviews.forEach(function (r, j) { r.featured = (j === Number(i)); });
    state.data.reviews[Number(i)].published = true;
    save(); render();
  },
  rRemove: function (i) { state.data.reviews.splice(Number(i), 1); save(); render(); },

  /* panel — messages */
  mRemove: function (i) { state.data.messages.splice(Number(i), 1); save(); render(); },

  /* panel — settings */
  resetAll: function () {
    if (!window.confirm('Clear everything and start fresh? Bookings, reviews, messages, photos and all copy will be wiped.')) return;
    state.data = blank();
    state.section = 'bookings';
    save(); render();
  }
};

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

/* Typing saves without re-rendering, so the caret stays put. */
app.addEventListener('input', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-k');
  if (k) setPath(k, e.target.value);
});

/* Leaving a field re-renders, so the site picks up the new text. */
app.addEventListener('change', function (e) {
  var t = e.target;
  if (t.type === 'file') { handleUpload(t); return; }
  var k = t.getAttribute && t.getAttribute('data-k');
  if (k) { setPath(k, t.value); render(); }
});

/* --- image uploads ------------------------------------------------------ */

/* Photos are stored in the browser as data URLs, so they are shrunk first
   to keep localStorage from filling up. */
/* max: longest side in px. png: keep transparency (logos, cut-outs) instead of flattening to jpeg */
function shrink(url, done, max, png) {
  var img = new Image();
  img.onload = function () {
    var scale = Math.min(1, (max || 1200) / Math.max(img.width, img.height));
    var c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    done(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82));
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
  var png  = file.type === 'image/png';

  var reader = new FileReader();
  reader.onload = function () {
    shrink(String(reader.result), function (url) {
      if (path === 'gallery') state.data.gallery.unshift(url);
      else setPath(path, url);
      save();
      render();
    }, icon ? 320 : 1200, png);
  };
  reader.readAsDataURL(file);
}

/* --- start -------------------------------------------------------------- */

load();
render();
