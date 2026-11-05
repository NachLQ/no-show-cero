/**
 * Nach / Pasta network security helpers.
 * Bind default 127.0.0.1; CORS loopback-only (+ optional NACH_CORS_ORIGINS).
 * Empty env values are treated as unset (never Path('') / bind-all by accident).
 */

/** @param {string} name @param {string} fallback */
export function envOr(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  if (s === '') return fallback;
  return s;
}

/** Host for app.listen. Default 127.0.0.1. Set NACH_BIND=0.0.0.0 to open. */
export function bindHost() {
  return envOr('NACH_BIND', '127.0.0.1');
}

const LOOPBACK_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function allowlist() {
  const raw = envOr('NACH_CORS_ORIGINS', '');
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** @param {string|undefined|null} origin */
export function isAllowedOrigin(origin) {
  if (origin === undefined || origin === null || origin === '') return true;
  if (origin === '*') return false;
  if (LOOPBACK_ORIGIN.test(origin)) return true;
  return allowlist().includes(origin);
}

/**
 * cors package origin callback: allow no-Origin / loopback / NACH_CORS_ORIGINS.
 * Never reflects "*". Rejects private-LAN and arbitrary internet origins.
 * @param {string|undefined} origin
 * @param {(err: Error|null, allow?: boolean) => void} cb
 */
export function corsOriginAllow(origin, cb) {
  if (isAllowedOrigin(origin)) return cb(null, true);
  return cb(null, false);
}

export default { envOr, bindHost, isAllowedOrigin, corsOriginAllow };
