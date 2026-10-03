// «Mis QR»: sin cuentas ni token. Al guardar, el servidor devuelve una clave propia de ese QR; este navegador la
// recuerda y con ella puede borrarlo o reemplazarlo. Los enlaces públicos siguen funcionando aunque se pierda la clave.
const KEY = 'rana-mios';
const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';

export function nuevoId() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join('');
}

export function leerMios() {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(l) ? l.filter((x) => x && typeof x.id === 'string' && typeof x.clave === 'string') : [];
  } catch { return []; }
}
function escribir(l) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 500))); } catch { /* sin almacenamiento */ } }

export async function configSitio() {
  try { const r = await fetch('/api/config'); return r.ok ? await r.json() : {}; } catch { return {}; }
}

async function pedir(method, url, body, cabeceras = {}) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...cabeceras }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}

/** Guarda un QR nuevo (o reemplaza uno propio). Devuelve { id, url }. */
export async function guardarQR(entry, { claveCrear = '' } = {}) {
  const mios = leerMios();
  const previo = mios.find((m) => m.id === entry.id);
  const cab = previo ? { 'X-Clave': previo.clave } : (claveCrear ? { 'X-Clave-Crear': claveCrear } : {});
  const d = await pedir('PUT', '/api/modelos/' + entry.id, entry, cab);
  if (d.clave) mios.unshift({ id: entry.id, label: entry.label, text: entry.text, clave: d.clave, fecha: Date.now() });
  else if (previo) { previo.label = entry.label; previo.text = entry.text; }
  escribir(mios);
  return { id: entry.id, url: `${location.origin}/v/${entry.id}` };
}

export async function borrarQR(id) {
  const m = leerMios().find((x) => x.id === id);
  if (!m) throw new Error('Este QR no se creó desde este navegador.');
  try { await pedir('DELETE', '/api/modelos/' + id, undefined, { 'X-Clave': m.clave }); }
  catch (e) { if (!/No existe|403/.test(e.message) && !/solo quien/i.test(e.message)) throw e; /* ya no existe en el servidor */ }
  escribir(leerMios().filter((x) => x.id !== id));
}
