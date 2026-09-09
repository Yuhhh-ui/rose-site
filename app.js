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
    if (raw) state.data = Object.assign(blank(), JSON.parse(raw));
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

function go(page) {
  state.page = page;
  state.flash = '';
  render();
  window.scrollTo(0, 0);
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
  return '' +
  '<header class="nav">' +
    '<div class="brand" data-act="go:home">' +
      '<span class="brand-name">ROSÉ</span>' +
      '<span class="brand-sub">CREATIVE ARTISTRY</span>' +
    '</div>' +
    '<nav class="nav-links">' +
      '<span class="nav-link" data-act="go:home">HOME</span>' +
      '<span class="nav-link" data-act="go:services">SERVICES</span>' +
      '<span class="nav-link" data-act="go:artist">THE ARTIST</span>' +
      '<span class="nav-link" data-act="go:reviews">REVIEWS</span>' +
      '<span class="nav-link" data-act="go:contact">CONTACT</span>' +
      '<span class="nav-book" data-act="go:booking">BOOK</span>' +
    '</nav>' +
  '</header>';
}

function homePage() {
  var d = state.data, feat = featuredReview();

  var cards = liveServices().map(function (x) {
    return '<article class="svc-card" data-act="go:services">' +
      '<div class="svc-card-img frame">' + photo(x.s.img, 'PHOTO') + '</div>' +
      '<span class="svc-card-name">' + esc(x.s.name) + '</span>' +
      '<span class="svc-card-price">' + esc(money(x.s.price)) + '</span>' +
    '</article>';
  }).join('');

  var portfolio = '';
  if (d.gallery.length) {
    portfolio =
    '<section class="section">' +
      '<div class="section-head">' +
        '<p class="eyebrow">PORTFOLIO</p>' +
        '<span class="link-gold" data-act="go:artist">SEE MORE →</span>' +
      '</div>' +
      '<div class="gallery-grid">' +
        d.gallery.map(function (u) { return '<div class="gallery-tile frame">' + photo(u, '') + '</div>'; }).join('') +
      '</div>' +
    '</section>';
  }

  var kindWords = '';
  if (feat) {
    kindWords =
    '<section class="featured">' +
      '<div class="featured-inner">' +
        '<span class="script">Kind words</span>' +
        '<p class="quote">' + esc(feat.text) + '</p>' +
        '<span class="quote-by">— ' + esc(feat.name) + '</span>' +
        '<span class="quote-link" data-act="go:reviews">ALL REVIEWS</span>' +
      '</div>' +
    '</section>';
  }

  return '<div class="page">' +
    '<section class="hero">' +
      '<div class="hero-copy">' +
        '<span class="script">Rosé</span>' +
        '<h1 class="hero-title">' + esc(d.home.headline) + '</h1>' +
        '<p class="hero-sub">' + esc(d.home.sub) + '</p>' +
        '<div class="row">' +
          '<span class="btn" data-act="go:booking">BOOK APPOINTMENT</span>' +
          '<span class="btn-line" data-act="go:services">VIEW SERVICES</span>' +
        '</div>' +
      '</div>' +
      '<div class="hero-img frame">' + photo(d.home.heroImg, 'HERO IMAGE') + '</div>' +
    '</section>' +

    '<section class="welcome">' +
      '<p class="eyebrow">WELCOME</p>' +
      (d.home.welcome
        ? '<p class="welcome-text">' + esc(d.home.welcome) + '</p>'
        : '<p class="welcome-text empty-hint">Your welcome paragraph will appear here — add it in the studio panel.</p>') +
    '</section>' +

    '<section class="section">' +
      '<p class="eyebrow center" style="margin-bottom:40px">SERVICES</p>' +
      '<div class="svc-grid">' + cards + '</div>' +
    '</section>' +

    portfolio + kindWords +

    '<div class="closing frame">' + photo(d.home.ctaImg, 'CLOSING IMAGE') + '</div>' +
    '<section class="cta-band">' +
      '<h2 class="cta-title">Book with us</h2>' +
      '<span class="btn" data-act="go:booking">GO TO BOOKING</span>' +
    '</section>' +
  '</div>';
}

function servicesPage() {
  var d = state.data;

  var rows = liveServices().map(function (x) {
    var s = x.s;
    return '<section class="svc-row">' +
      '<div class="svc-row-img frame">' + photo(s.img, 'PHOTO') + '</div>' +
      '<div class="svc-row-body">' +
        '<span class="svc-num">0' + (x.i + 1) + '</span>' +
        '<h2 class="svc-name">' + esc(s.name) + '</h2>' +
        (s.desc
          ? '<p class="svc-desc">' + esc(s.desc) + '</p>'
          : '<p class="svc-desc empty-hint">Description to be added.</p>') +
        '<div class="svc-meta">' +
          '<span class="svc-price">' + esc(money(s.price)) + '</span>' +
          '<span class="svc-dur">' + esc(s.dur) + '</span>' +
          '<span class="btn-sm" data-act="book:' + x.i + '">BOOK</span>' +
        '</div>' +
      '</div>' +
    '</section>';
  }).join('');

  var lashes = d.lashes.map(function (l) {
    return '<div class="lash-card">' +
      '<div class="lash-img frame">' + photo(l.img, 'LASH PHOTO') + '</div>' +
      '<span class="lash-name">' + esc(l.name) + '</span>' +
      '<span class="lash-price">' + esc(money(l.price)) + '</span>' +
    '</div>';
  }).join('');

  return '<div class="page">' +
    '<div class="page-head">' +
      '<p class="eyebrow">SERVICES</p>' +
      '<h1>The Menu</h1>' +
    '</div>' +
    rows +
    '<section class="lashes">' +
      '<p class="eyebrow">LASHES</p>' +
      '<h3>Lashes, applied with any look.</h3>' +
      '<div class="lash-grid">' + lashes + '</div>' +
    '</section>' +
    (d.policies
      ? '<section class="policies"><p class="eyebrow">GOOD TO KNOW</p><p>' + esc(d.policies) + '</p></section>'
      : '') +
    '<div class="tail-cta"><span class="btn" data-act="go:booking">BOOK A SERVICE</span></div>' +
  '</div>';
}

function artistPage() {
  var d = state.data;

  var work = '';
  if (d.gallery.length) {
    work = '<section class="work">' +
      '<p class="eyebrow">SELECTED WORK</p>' +
      '<div class="work-grid">' +
        d.gallery.map(function (u) { return '<div class="work-tile frame">' + photo(u, '') + '</div>'; }).join('') +
      '</div>' +
    '</section>';
  }

  return '<div class="page">' +
    '<section class="artist-hero">' +
      '<div class="artist-portrait frame">' + photo(d.artist.portrait, 'PORTRAIT') + '</div>' +
      '<div class="artist-body">' +
        '<span class="artist-label">MEET YOUR ARTIST</span>' +
        '<h1 class="artist-name">Rosé</h1>' +
        '<span class="script">Your trusted makeup artist</span>' +
        (d.artist.story
          ? '<p class="artist-story">' + esc(d.artist.story) + '</p>'
          : '<p class="artist-story empty-hint">Your story will appear here — add it in the studio panel.</p>') +
      '</div>' +
    '</section>' +
    (d.artist.approach
      ? '<section class="approach"><p class="eyebrow">HOW I WORK</p><p>' + esc(d.artist.approach) + '</p></section>'
      : '') +
    work +
    '<section class="artist-tail">' +
      '<h2>I would love to do your makeup.</h2>' +
      '<span class="btn" data-act="go:booking">BOOK WITH ROSÉ</span>' +
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
        '<div class="info"><span class="info-label">STUDIO HOURS</span>' + hours + '</div>' +
      '</div>' +
    '</section>' +
  '</div>';
}

function footer() {
  var d = state.data;
  return '' +
  '<footer class="footer">' +
    '<div class="foot-col brand-col">' +
      '<span class="foot-name">ROSÉ</span>' +
      '<span class="foot-sub">CREATIVE ARTISTRY</span>' +
      '<p class="foot-place">St Kitts · by appointment</p>' +
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
      '<span class="foot-label">ELSEWHERE</span>' +
      '<span class="foot-link">' + esc(d.brand.ig || 'Instagram to be added') + '</span>' +
      '<span class="foot-link">' + esc(d.brand.email || 'Email to be added') + '</span>' +
    '</div>' +
    '<div class="foot-col">' +
      '<span class="foot-label">STUDIO</span>' +
      '<span class="foot-link gold" data-act="go:admin">Studio login →</span>' +
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
        '<div class="field"><span class="field-label">Headline</span>' +
          '<input type="text" value="' + esc(d.home.headline) + '" data-k="home.headline"></div>' +
        '<div class="field"><span class="field-label">Sub-headline</span>' +
          '<textarea rows="3" data-k="home.sub">' + esc(d.home.sub) + '</textarea></div>' +
        '<div class="field"><span class="field-label">Welcome paragraph</span>' +
          '<textarea rows="6" data-k="home.welcome" placeholder="A few lines about the studio">' + esc(d.home.welcome) + '</textarea></div>' +
        '<div class="field"><span class="field-label">Hero image</span>' +
          '<div class="a-img-lg frame">' + photo(d.home.heroImg, 'NO PHOTO') + '</div>' +
          '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="home.heroImg"></label></div>' +
        '<div class="field"><span class="field-label">Closing image</span>' +
          '<div class="a-img-xs frame">' + photo(d.home.ctaImg, 'NO PHOTO') + '</div>' +
          '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="home.ctaImg"></label></div>' +
      '</div>' +
      '<div class="pages-col">' +
        '<p class="eyebrow">THE ARTIST</p>' +
        '<div class="field"><span class="field-label">Portrait</span>' +
          '<div class="a-img-md frame">' + photo(d.artist.portrait, 'NO PHOTO') + '</div>' +
          '<label class="upload">UPLOAD<input type="file" accept="image/*" data-upload="artist.portrait"></label></div>' +
        '<div class="field"><span class="field-label">Your story</span>' +
          '<textarea rows="7" data-k="artist.story" placeholder="Tell them who you are">' + esc(d.artist.story) + '</textarea></div>' +
        '<div class="field"><span class="field-label">How you work</span>' +
          '<textarea rows="4" data-k="artist.approach">' + esc(d.artist.approach) + '</textarea></div>' +
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
  go:      function (p) { go(p); },
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
function shrink(url, done) {
  var img = new Image();
  img.onload = function () {
    var max = 1200;
    var scale = Math.min(1, max / Math.max(img.width, img.height));
    var c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    done(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = function () { done(url); };
  img.src = url;
}

function handleUpload(input) {
  var path = input.getAttribute('data-upload');
  var file = input.files && input.files[0];
  input.value = '';
  if (!file || !path) return;

  var reader = new FileReader();
  reader.onload = function () {
    shrink(String(reader.result), function (url) {
      if (path === 'gallery') state.data.gallery.unshift(url);
      else setPath(path, url);
      save();
      render();
    });
  };
  reader.readAsDataURL(file);
}

/* --- start -------------------------------------------------------------- */

load();
render();
