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
    ctaImg: ''                         // cut-out portrait in the "Book with us" band
  },

  artist: { intro: '', story: '', approach: '', portrait: '' },

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

  policies: '',
  gallery: [],

  hours: DAYS.map(function (day) { return { day: day, open: '' }; }),

  brand: { ig: '@makeupbyrose.stkitts', email: '', address: '' },

  // filled in as the site is used
  bookings: [],
  reviews: [],
  messages: [],

  // in-progress form values, kept so a half-filled form survives a refresh
  form:  { name: '', contact: '', email: '', occasion: '', notes: '', svc: '', date: '', time: '', place: '' },
  rform: { name: '', service: '', text: '' },
  cform: { name: '', email: '', topic: '', message: '' }
};
