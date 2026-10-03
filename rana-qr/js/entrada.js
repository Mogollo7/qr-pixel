// Entrada del sitio a partir de un modelo ya cubizado y un enlace (RF-QR, RF-SCAN, RF-PUB). Solo necesita DOM para el raster de comprobación.
// Empareja cada cubo de la figura con un cubo del QR y comprueba la lectura con jsQR; si el color de la figura
// impide leerlo, oscurece por pasos. Nunca devuelve un QR que no se lee como si estuviera bien.
import { makeQR } from './qr.js';
import { cubesPerModule, buildQRCubes, qrColor, rasterQR, scanCanvas } from './qrstate.js';
import { makeEntry } from './sitio.js';
import { BASE } from './params.js';

const byte = (x) => Math.max(0, Math.min(255, Math.round(x)));

function emparejar(model, qrState, p, strength) {
  const fi = model.opI, fc = model.opC, qp = qrState.pos, nF = fi.length / 3, nQ = qrState.n, n = Math.max(nF, nQ);
  const fOrder = Array.from({ length: nF }, (_, v) => v).sort((a, b) => (fi[b * 3] - fi[a * 3]) || (fi[a * 3 + 1] - fi[b * 3 + 1]));
  const qOrder = Array.from({ length: nQ }, (_, v) => v).sort((a, b) => (qp[b * 3] - qp[a * 3]) || (qp[a * 3 + 1] - qp[b * 3 + 1]));
  const frog = new Int16Array(n * 3), frogRgb = new Uint8Array(n * 3), qr3 = new Int16Array(n * 3), qrRgb = new Uint8Array(n * 3);
  const rnd = new Uint8Array(n), flags = new Uint8Array(n), qrCols = new Uint8Array(nQ * 3);
  let prevQ = -1;
  for (let r = 0; r < n; r++) {
    const f = fOrder[r < nF ? r : (r * 7919) % nF];
    const qi = nQ >= nF ? r : Math.floor(r * nQ / nF);
    const realQ = qi !== prevQ; prevQ = qi;
    const q = qOrder[qi];
    for (let a = 0; a < 3; a++) { frog[r * 3 + a] = fi[f * 3 + a]; qr3[r * 3 + a] = Math.round(qp[q * 3 + a] * 2); }
    const frgb = [fc[f * 3], fc[f * 3 + 1], fc[f * 3 + 2]];
    frogRgb.set(frgb, r * 3);
    const qc = qrColor(p, qrState.dark[q] === 1, frgb, strength).map(byte);
    if (realQ) qrCols.set(qc, q * 3);
    qrRgb.set(qc, r * 3);
    rnd[r] = Math.floor(Math.random() * 256);
    flags[r] = (r < nF ? 1 : 0) | (realQ ? 2 : 0);
  }
  return { frog, frogRgb, qr: qr3, qrRgb, rnd, flags, qrCols };
}

/**
 * @param model  resultado de voxelizeGLB (opI, opC, L, height)
 * @param enlace texto o URL que llevará el QR
 * @param label  nombre del enlace
 * @returns { entry, legible, nota, version, modulos, cubos }
 */
export function crearEntrada(model, enlace, label) {
  const p = { ...BASE, text: enlace };
  const qr = makeQR(p.text, p.ecc, p.minVersion);
  const nF = model.opI.length / 3;
  if (!nF) throw new Error('El modelo no tiene cubos visibles');
  const qrState = buildQRCubes(qr, p, cubesPerModule(nF, qr, p.quiet, p.qrRelief));
  let legible = false, nota = '', par = null;
  for (const strength of [1, 0.6, 0.3, 0]) {
    qrState.strength = strength;
    par = emparejar(model, qrState, p, strength);
    const r = scanCanvas(rasterQR(qrState, par.qrCols), p.text);
    if (r.error) { nota = r.error; break; }
    if (r.ok) { legible = true; nota = strength < 1 ? 'Colores oscurecidos para que el QR se lea' : ''; break; }
  }
  const entry = makeEntry({ label, text: p.text, L: model.L, H: model.height, side: qrState.side, ...par });
  return { entry, legible, nota, version: qr.version, modulos: qr.size, cubos: Math.max(nF, qrState.n) };
}
