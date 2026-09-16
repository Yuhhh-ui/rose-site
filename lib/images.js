/* Photos go to Vercel Blob when BLOB_READ_WRITE_TOKEN is set (add Blob from the
   Vercel project's Storage tab). Without it, the picture is kept inline as a
   data URL, which is fine for the dev server and nothing else. */

import { put } from '@vercel/blob';

const MAX_BYTES = 1.5 * 1024 * 1024;

export function blobReady() { return !!process.env.BLOB_READ_WRITE_TOKEN; }

/* dataUrl -> public https URL (or the data URL itself when Blob is not set up) */
export async function storeImage(dataUrl, folder) {
  var m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('Not an image');
  var bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) throw new Error('Image is too large');
  if (!blobReady()) return dataUrl;
  var ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  var blob = await put((folder || 'photos') + '/' + Date.now().toString(36) + '.' + ext, bytes, {
    access: 'public', contentType: m[1], addRandomSuffix: true
  });
  return blob.url;
}
