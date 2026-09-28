const crypto = require('crypto');

const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h
const COOKIE_NAME = 'itex_admin';

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-change-me';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

/** Builds a `Set-Cookie` value for a fresh admin session, or a clearing cookie when `active` is false. */
function buildCookie(active) {
  if (!active) {
    return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  }
  const expires = Date.now() + MAX_AGE_MS;
  const payload = `${expires}`;
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}; HttpOnly; SameSite=Lax`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function isAdmin(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const [expires, signature] = raw.split('.');
  if (!expires || !signature) return false;
  if (sign(expires) !== signature) return false;
  return Number(expires) > Date.now();
}

module.exports = { buildCookie, isAdmin };
