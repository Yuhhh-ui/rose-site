/* ROSÉ Creative Artistry — starting content.
   Edit anything here to change what a fresh site says.
   Once the studio panel has been used, saved data in the browser wins;
   use Settings → Clear everything to fall back to this file again. */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TIME_SLOTS = ['9:00 am', '11:30 am', '2:00 pm', '4:30 pm'];

const DEFAULT_CONTENT = {
  home: {
    script: 'Enhancing your',          // small script line above the headline
    headline: 'Natural Beauty',        // shown in capitals
    sub: 'An elevated beauty studio experience. Curated for the woman who values quality, detail & intention.',
    welcome: '',                       // optional second "About" paragraph
    heroImg: '',                       // cut-out portrait beside the headline
    ctaImg: '',                        // cut-out portrait in the "Book with us" band
    quickIcons: ['', '', '', '', '', '']  // optional pictures for the six quick-link circles
  },

  artist: {
    name: 'Arianna Franks',
    tagline: 'Your trusted makeup artist · St Kitts',
    intro: '',            // one line on the homepage
    story: '',            // "Her story" paragraph
    quote: '',            // script line in her own words
    portrait: '',         // tall portrait at the top of the page
    storyImg: '',         // photo beside the story
    looks: [              // "Her three favourite looks"
      { name: '', note: '', img: '' },
      { name: '', note: '', img: '' },
      { name: '', note: '', img: '' }
    ]
  },

  services: [
    { name: 'Bridal',        dur: '90 min',  price: '', desc: '', img: '', live: true },
    { name: 'Special Event', dur: '60 min',  price: '', desc: '', img: '', live: true },
    { name: 'Soft Glam',     dur: '45 min',  price: '', desc: '', img: '', live: true },
    { name: '1:1 Lesson',    dur: '120 min', price: '', desc: '', img: '', live: true }
  ],

  lashes: [
    { name: 'Classic strip',        price: '', img: '' },
    { name: 'Wispy natural',        price: '', img: '' },
    { name: 'Individual clusters',  price: '', img: '' },
    { name: 'Dramatic volume',      price: '', img: '' }
  ],

  /* Each one is { title, text }. The panel adds and deletes them, so the
     number of policies is not fixed. An entry with no text stays off the site. */
  policies: [
    { title: 'Deposits',      text: '' },
    { title: 'Cancellations', text: '' },
    { title: 'Travel',        text: '' },
    { title: 'How to prep',   text: '' }
  ],

  // each photo is { url, tag } — the tag is a service name, used by the gallery filters
  gallery: [],

  hours: DAYS.map(function (day) { return { day: day, open: '' }; }),

  brand: { ig: '@makeupbyrose.stkitts', email: '', address: '', whatsapp: '' },

  // filled in as the site is used
  bookings: [],
  reviews: [],
  messages: [],

  // in-progress form values, kept so a half-filled form survives a refresh
  form:  { name: '', contact: '', email: '', occasion: '', notes: '', svc: '', date: '', time: '', place: '' },
  rform: { name: '', service: '', text: '', img: '' },
  cform: { name: '', email: '', topic: '', message: '' }
};
