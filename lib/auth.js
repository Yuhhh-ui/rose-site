/* Studio login.
   One password, set as STUDIO_PASSWORD in Vercel. A signed cookie keeps the
   session for 30 days. The signing secret is derived from the password, so
   changing the password signs everyone out. */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from './http.js';

const COOKIE = 'rose_studio';
const DAYS = 30;

function secret() {
  return createHash('sha256').update('rose-session|' + (process.env.STUDIO_PASSWORD || '')).digest();
}

function sign(exp) {
  return createHmac('sha256', secret()).update(String(exp)).digest('base64url');
}

export function configured() {
  return !!process.env.STUDIO_PASSWORD;
}

export function checkPassword(given) {
  var want = Buffer.from(createHash('sha256').update(process.env.STUDIO_PASSWORD || '').digest('hex'));
  var got  = Buffer.from(createHash('sha256').update(String(given || '')).digest('hex'));
  return configured() && timingSafeEqual(want, got);
}

export function sessionCookie(res) {
  var exp = Date.now() + DAYS * 864e5;
  var secure = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  res.setHeader('Set-Cookie', COOKIE + '=' + exp + '.' + sign(exp) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (DAYS * 86400) + (secure ? '; Secure' : ''));
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

export function loggedIn(req) {
  var raw = cookies(req)[COOKIE];
  if (!raw || !configured()) return false;
  var i = raw.indexOf('.');
  if (i < 0) return false;
  var exp = raw.slice(0, i), sig = raw.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  var want = Buffer.from(sign(exp)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
