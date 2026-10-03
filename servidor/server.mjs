// Servidor de Rana QR: página para crear, página pública de cada QR y API con base de datos SQLite.
// Sin dependencias: usa node:sqlite (Node 22.13 o superior).
//
// Sin cuentas ni token: cada QR guardado devuelve una clave propia que solo ese navegador conoce y que
// sirve para borrarlo o reemplazarlo. Si algún día quieres cerrar la creación, define CLAVE_CREAR.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(here, 'publico');
const ADMIN = path.resolve(process.env.ADMIN_DIR || path.join(here, '..', 'rana-qr'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, 'datos'));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // detrás de un túnel o proxy: usa la IP real que él informa
const CLAVE_CREAR = process.env.CLAVE_CREAR || ''; // opcional: si se define, crear exige esta clave
const MAX_MODELOS = Number(process.env.MAX_MODELOS) || 300;
const LIMITE_HORA = Number(process.env.LIMITE_HORA) || 30; // creaciones por IP y hora
const DESTINOS = (process.env.DESTINOS_PERMITIDOS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const MAX_BODY = 8 * 1024 * 1024, MAX_CUBOS = 80000;

// .env opcional (KEY=VALOR por línea, junto al servidor); las variables del entorno tienen prioridad
try {
  for (const line of fs.readFileSync(path.join(here, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* sin .env */ }

const sha = (s) => crypto.createHash('sha256').update(String(s));
const iguales = (a, b) => crypto.timingSafeEqual(sha(a).digest(), sha(b).digest());

// ---------------------------------------------------------------- base de datos
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'rana.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS modelos (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, text TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0,
    l REAL NOT NULL, h REAL NOT NULL, side REAL NOT NULL, n INTEGER NOT NULL,
    frog TEXT NOT NULL, frog_rgb TEXT NOT NULL, qr TEXT NOT NULL, qr_rgb TEXT NOT NULL, misc TEXT NOT NULL,
    clave_hash TEXT,
    creado TEXT NOT NULL DEFAULT (datetime('now')), actualizado TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// bases creadas con versiones anteriores: añadir la columna de clave si falta
if (!db.prepare('PRAGMA table_info(modelos)').all().some((c) => c.name === 'clave_hash')) db.exec('ALTER TABLE modelos ADD COLUMN clave_hash TEXT');
const q = {
  uno: db.prepare('SELECT * FROM modelos WHERE id = ?'),
  clave: db.prepare('SELECT clave_hash FROM modelos WHERE id = ?'),
  cuenta: db.prepare('SELECT COUNT(*) AS c FROM modelos'),
  insertar: db.prepare(`INSERT INTO modelos (id, label, text, l, h, side, n, frog, frog_rgb, qr, qr_rgb, misc, clave_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  actualizar: db.prepare(`UPDATE modelos SET label=?, text=?, l=?, h=?, side=?, n=?, frog=?, frog_rgb=?, qr=?, qr_rgb=?, misc=?, actualizado=datetime('now') WHERE id=?`),
  borrar: db.prepare('DELETE FROM modelos WHERE id = ?'),
};

const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const b64Bytes = (s) => (B64_RE.test(s) && s.length % 4 === 0 ? (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0) : -1);
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Valida la entrada completa; devuelve texto de error o null. */
function validarEntrada(id, e) {
  if (!e || typeof e !== 'object') return 'El cuerpo debe ser un objeto JSON';
  if (!ID_RE.test(id)) return 'Identificador no válido (minúsculas, números y guiones; máx. 40)';
  if (typeof e.label !== 'string' || !e.label.trim() || e.label.length > 60) return 'label debe tener entre 1 y 60 caracteres';
  if (typeof e.text !== 'string' || !e.text.length || e.text.length > 1200) return 'text debe tener entre 1 y 1200 caracteres';
  if (!num(e.L, 1, 4000) || !num(e.H, 1, 4000) || !num(e.side, 1, 4000)) return 'L, H y side deben ser números válidos';
  if (!Number.isInteger(e.n) || e.n < 1 || e.n > MAX_CUBOS) return `n debe ser un entero entre 1 y ${MAX_CUBOS}`;
  const need = { frog: e.n * 6, frogRgb: e.n * 3, qr: e.n * 6, qrRgb: e.n * 3, misc: e.n * 2 };
  for (const [k, bytes] of Object.entries(need)) {
    if (typeof e[k] !== 'string' || b64Bytes(e[k]) !== bytes) return `${k} no tiene el tamaño esperado para ${e.n} cubos`;
  }
  if (DESTINOS.length) {
    let host = '';
    try { const u = new URL(e.text); if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname.toLowerCase(); } catch { /* no es URL */ }
    if (!host || !DESTINOS.some((d) => host === d || host.endsWith('.' + d))) return `El enlace debe ser de: ${DESTINOS.join(', ')}`;
  }
  return null;
}

const fila = (r) => ({ id: r.id, label: r.label, text: r.text, L: r.l, H: r.h, side: r.side, n: r.n, frog: r.frog, frogRgb: r.frog_rgb, qr: r.qr, qrRgb: r.qr_rgb, misc: r.misc });

// ---------------------------------------------------------------- utilidades HTTP
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json' };
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };
const CSP_PUBLICO = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const CSP_ADMIN = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' blob: https://cdn.jsdelivr.net; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

const send = (res, code, body, headers = {}) => { res.writeHead(code, { ...BASE_HEADERS, ...headers }); res.end(body); };
const json = (res, code, obj, extra = {}) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache', ...extra });

function ipDe(req) {
  if (TRUST_PROXY) {
    const h = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (h) return h;
  }
  return req.socket.remoteAddress || '?';
}

// límites por IP (en memoria): creaciones por hora y claves erróneas
const creaciones = new Map(), fallos = new Map();
const ventana = (mapa, ip, ms) => { const ahora = Date.now(), l = (mapa.get(ip) || []).filter((t) => ahora - t < ms); mapa.set(ip, l); return l; };
setInterval(() => { const ahora = Date.now(); for (const m of [creaciones, fallos]) for (const [k, v] of m) if (!v.some((t) => ahora - t < 3600e3)) m.delete(k); }, 600e3).unref();

function limitarCreacion(req, res) {
  const ip = ipDe(req), l = ventana(creaciones, ip, 3600e3);
  if (l.length >= LIMITE_HORA) { json(res, 429, { error: 'Demasiados QR creados desde tu conexión. Inténtalo más tarde.' }, { 'Retry-After': '3600' }); return false; }
  l.push(Date.now()); return true;
}

/** Comprueba la clave del QR (cabecera X-Clave). Devuelve true o responde con error. */
function esDueño(req, res, id) {
  const ip = ipDe(req), l = ventana(fallos, ip, 600e3);
  if (l.length >= 10) { json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' }, { 'Retry-After': '600' }); return false; }
  const row = q.clave.get(id), dada = String(req.headers['x-clave'] || '');
  if (row && row.clave_hash && dada && iguales(sha(dada).digest('hex'), row.clave_hash)) return true;
  l.push(Date.now());
  json(res, 403, { error: 'Solo quien creó este QR puede cambiarlo o borrarlo.' });
  return false;
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const parts = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Cuerpo demasiado grande'), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch { reject(Object.assign(new Error('JSON no válido'), { code: 400 })); } });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- API
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (p === '/api/salud' && m === 'GET') return json(res, 200, { ok: true, modelos: q.cuenta.get().c });
  if (p === '/api/config' && m === 'GET') return json(res, 200, { requiereClave: !!CLAVE_CREAR, destinos: DESTINOS });
  const mt = /^\/api\/modelos\/([a-z0-9-]{1,40})$/.exec(p);
  if (!mt) return json(res, 404, { error: 'Ruta no encontrada' });
  const id = mt[1];
  if (m === 'GET') { const r = q.uno.get(id); return r ? json(res, 200, fila(r)) : json(res, 404, { error: 'No existe ese modelo' }); }
  if (m === 'PUT') {
    const existe = !!q.clave.get(id);
    if (existe && !esDueño(req, res, id)) return;
    if (!existe) {
      if (CLAVE_CREAR && !iguales(req.headers['x-clave-crear'] || '', CLAVE_CREAR)) return json(res, 401, { error: 'Se necesita la clave para crear QR en este sitio.' });
      if (!limitarCreacion(req, res)) return;
      if (q.cuenta.get().c >= MAX_MODELOS) return json(res, 409, { error: 'El sitio alcanzó su límite de QR guardados.' });
    }
    const body = await leerCuerpo(req);
    const err = validarEntrada(id, body);
    if (err) return json(res, 400, { error: err });
    if (existe) { q.actualizar.run(body.label.trim(), body.text, body.L, body.H, body.side, body.n, body.frog, body.frogRgb, body.qr, body.qrRgb, body.misc, id); return json(res, 200, { ok: true, id }); }
    const clave = crypto.randomBytes(18).toString('base64url');
    q.insertar.run(id, body.label.trim(), body.text, body.L, body.H, body.side, body.n, body.frog, body.frogRgb, body.qr, body.qrRgb, body.misc, sha(clave).digest('hex'));
    return json(res, 200, { ok: true, id, clave });
  }
  if (m === 'DELETE') {
    if (!esDueño(req, res, id)) return;
    q.borrar.run(id);
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'Método no permitido' }, { Allow: 'GET, PUT, DELETE' });
}

// ---------------------------------------------------------------- archivos estáticos
function estatico(req, res, base, rel, csp, permitidas) {
  let r = rel;
  if (r === '' || r.endsWith('/')) r += 'index.html';
  const file = path.resolve(base, '.' + path.sep + path.normalize('/' + r));
  const ext = path.extname(file).toLowerCase();
  if (!file.startsWith(base + path.sep) || !MIME[ext] || (permitidas && !permitidas.test(path.relative(base, file).split(path.sep).join('/')))) return send(res, 404, 'No encontrado');
  let st;
  try { st = fs.statSync(file); } catch { return send(res, 404, 'No encontrado'); }
  if (!st.isFile()) return send(res, 404, 'No encontrado');
  res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': MIME[ext], 'Content-Security-Policy': csp, 'Content-Length': st.size, 'Cache-Control': r.includes('three.min') ? 'public, max-age=86400' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método no permitido', { Allow: 'GET, HEAD' });
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/admin') return send(res, 301, '', { Location: '/admin/' });
    if (pathname.startsWith('/admin/')) return estatico(req, res, ADMIN, pathname.slice(7), CSP_ADMIN, /^(index\.html|css\/|js\/)/);
    // /v/<id>: página pública de un QR guardado (política estricta)
    if (/^\/v\/[a-z0-9-]{1,40}\/?$/.test(pathname)) return estatico(req, res, PUBLICO, 'ver.html', CSP_PUBLICO);
    // la página de crear carga módulos y librerías de CDN, igual que el editor
    return estatico(req, res, PUBLICO, pathname.slice(1), pathname === '/' || pathname === '/index.html' ? CSP_ADMIN : CSP_PUBLICO);
  } catch (e) {
    if (e && e.code === 413) return json(res, 413, { error: e.message });
    if (e && e.code === 400) return json(res, 400, { error: e.message });
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Error interno' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Rana QR en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Base de datos: ${path.join(DATA_DIR, 'rana.db')} · ${q.cuenta.get().c} QR guardado(s)`);
  console.log(`Crear: ${CLAVE_CREAR ? 'con clave (CLAVE_CREAR)' : 'abierto'} · máx. ${LIMITE_HORA} por IP y hora · tope ${MAX_MODELOS} QR` + (DESTINOS.length ? ` · destinos: ${DESTINOS.join(', ')}` : ' · cualquier destino http(s)'));
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); });
