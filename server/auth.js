// auth.js
// Token local de un solo equipo. Sin PIN ni emparejamiento móvil:
// esta app no tiene flujo de pareja, y no se inventa uno.
// El token se genera con randomBytes, se guarda en server/data/api-token.txt
// con permisos 0o600, y solo se entrega por loopback.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR } from './db.js';
import { bindHost } from './nach_net_security.js';

export { bindHost };
export const TOKEN_PATH = path.join(DATA_DIR, 'api-token.txt');

export function loadOrCreateToken() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(TOKEN_PATH)) {
    const t = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    if (t.length >= 24) {
      try { fs.chmodSync(TOKEN_PATH, 0o600); } catch { /* drvfs / Windows: el modo no siempre aplica */ }
      return t;
    }
  }
  const t = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(TOKEN_PATH, t, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(TOKEN_PATH, 0o600); } catch { /* igual que arriba */ }
  return t;
}

function isLoopbackAddr(addr) {
  if (!addr) return false;
  const a = String(addr).replace('::ffff:', '');
  return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

function clientIp(req) {
  return (req.socket && req.socket.remoteAddress) || '';
}

function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  if (req.headers['x-nach-token']) return String(req.headers['x-nach-token']).trim();
  const cookie = req.headers.cookie || '';
  const m = /(?:^|;\s*)nach_api=([^;]+)/.exec(cookie);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

export function createAuth(apiToken) {
  function requireAuth(req, res, next) {
    const got = extractToken(req);
    if (got && got === apiToken) return next();
    return res.status(401).json({ error: 'no autorizado' });
  }

  function montarRutas(app) {
    app.get('/api/auth/bootstrap', (req, res) => {
      if (!isLoopbackAddr(clientIp(req))) {
        return res.status(403).json({ error: 'bootstrap solo en este equipo' });
      }
      res.setHeader(
        'Set-Cookie',
        `nach_api=${encodeURIComponent(apiToken)}; Path=/; HttpOnly; SameSite=Lax`,
      );
      return res.json({ ok: true, token: apiToken });
    });
  }

  return { requireAuth, montarRutas, bindHost };
}
