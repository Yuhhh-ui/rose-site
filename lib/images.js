/* Photos go to Vercel Blob when BLOB_READ_WRITE_TOKEN is set (add Blob from the
   Vercel project's Storage tab). Without it, the picture is kept inline as a
   data URL, which is fine for the dev server and nothing else. */

import { put } from '@vercel/blob';

/* The browser shrinks a picture to well under this before sending it, so this
   is a backstop rather than a limit anyone should meet. Vercel caps a request
   body at 4.5 MB and base64 adds about a third, so 3 MB stays clear. */
const MAX_BYTES = 3 * 1024 * 1024;

export function blobReady() { return !!process.env.BLOB_READ_WRITE_TOKEN; }

/* Only the dev server keeps pictures inline. On a real deployment a missing
   Blob store is reported rather than worked around: inlined photos would be
   written into the content document, which fills up after a handful of them
   and then refuses to save at all. */
function mayInline() { return !!process.env.ROSE_INLINE_PHOTOS; }

/* dataUrl -> public https URL (or the data URL itself when Blob is not set up) */
export async function storeImage(dataUrl, folder) {
  var m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('Not an image');
  var bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) throw new Error('That picture is too large even after shrinking. Try one under 3 MB.');
  if (!blobReady()) {
    if (mayInline()) return dataUrl;
    throw new Error('Photo storage is not connected. Add Blob in the Vercel Storage tab, then redeploy.');
  }
  var ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  var blob = await put((folder || 'photos') + '/' + Date.now().toString(36) + '.' + ext, bytes, {
    access: 'public', contentType: m[1], addRandomSuffix: true
  });
  return blob.url;
}
