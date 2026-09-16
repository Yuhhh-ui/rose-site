/* ROSÉ Creative Artistry — talking to the server.

   API.remote is true when the site is served by Vercel (or `npm run dev`),
   so content, bookings, reviews and messages live on the server.
   When index.html is opened straight from disk there is no server, and the
   site falls back to the browser's own storage so it can still be tried out. */

var API = {
  remote: location.protocol === 'http:' || location.protocol === 'https:',

  call: function (method, path, data) {
    var opts = { method: method, credentials: 'same-origin', headers: {} };
    if (data !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { error: 'Unexpected reply from the server' }; }
        if (!r.ok) { var err = new Error(j.error || ('Request failed (' + r.status + ')')); err.status = r.status; throw err; }
        return j;
      });
    });
  },

  get:    function (p)    { return API.call('GET', p); },
  post:   function (p, d) { return API.call('POST', p, d); },
  put:    function (p, d) { return API.call('PUT', p, d); },
  patch:  function (p, d) { return API.call('PATCH', p, d); },
  del:    function (p, d) { return API.call('DELETE', p, d); }
};
