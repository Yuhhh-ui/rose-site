/* Reviews.
   GET    -> { items }   published ones for everyone, all of them for the studio
   POST   public  { name, text, img }   img is a data URL; text or img is enough
   PATCH  studio  { id, published }  or  { id, featured: true }
   DELETE studio  { id }                                                          */

import { send, fail, body, clean, id } from '../lib/http.js';
import { loggedIn } from '../lib/auth.js';
import { listItems, getItem, putItem, delItem } from '../lib/store.js';
import { storeImage } from '../lib/images.js';
import { notify } from '../lib/notify.js';

export default async function handler(req, res) {
  try {
    var b = body(req), logged = loggedIn(req);

    if (req.method === 'GET') {
      var items = await listItems('reviews');
      if (!logged) items = items.filter(function (r) { return r.published; });
      return send(res, 200, { items: items });
    }

    if (req.method === 'POST') {
      if (b.website) return send(res, 200, { ok: true });
      var item = {
        id: id('r'), at: Date.now(), published: false, featured: false,
        name:    clean(b.name, 120),
        service: clean(b.service, 120),
        text:    clean(b.text, 2000),
        img:     ''
      };
      if (!item.name || (!item.text && !b.img)) return fail(res, 400, 'Add your name and either a few words or a picture.');
      if (b.img) {
        try { item.img = await storeImage(b.img, 'reviews'); }
        catch (e) { return fail(res, 400, e.message); }
      }
      await putItem('reviews', item);
      await notify('New review from ' + item.name + ' is waiting for approval',
        (item.text ? '"' + item.text + '"' : 'A screenshot was sent in.') + '\n\nApprove it in the studio panel.');
      return send(res, 200, { ok: true, id: item.id });
    }

    if (!logged) return fail(res, 401, 'Please sign in.');

    if (req.method === 'PATCH') {
      var cur = await getItem('reviews', String(b.id || ''));
      if (!cur) return fail(res, 404, 'Review not found');
      if (b.featured === true) {
        var all = await listItems('reviews');
        for (var i = 0; i < all.length; i++) {
          if (all[i].featured && all[i].id !== cur.id) { all[i].featured = false; await putItem('reviews', all[i]); }
        }
        cur.featured = true;
        cur.published = true;
      } else if (typeof b.published === 'boolean') {
        cur.published = b.published;
        if (!b.published) cur.featured = false;
      }
      await putItem('reviews', cur);
      return send(res, 200, { ok: true, item: cur });
    }

    if (req.method === 'DELETE') {
      await delItem('reviews', String(b.id || ''));
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return fail(res, 500, e.message);
  }
}
