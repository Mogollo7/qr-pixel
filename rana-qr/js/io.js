// Proyecto JSON (RF-EXP) y malla fusionada para GLB. Validación estricta al cargar (RFNO-SEG).
import * as THREE from 'three';
import { BASE, CONTROL_INDEX } from './params.js';

const MAX_OVERRIDES = 200000;
const HEX = /^#[0-9a-fA-F]{6}$/;

export function serialize(p, overrides) {
  return JSON.stringify({
    format: 'rana-qr', version: 1, params: p,
    overrides: [...overrides].map(([k, v]) => [k, v]),
  });
}

/** Devuelve { params, overrides } validados y recortados a los rangos del esquema. */
export function deserialize(json) {
  let o;
  try { o = JSON.parse(json); } catch { throw new Error('JSON inválido'); }
  if (!o || o.format !== 'rana-qr' || typeof o.params !== 'object' || o.params === null) throw new Error('No es un proyecto rana-qr');
  const params = { ...BASE };
  for (const [k, def] of Object.entries(BASE)) {
    const v = o.params[k];
    if (v === undefined) continue;
    const ctl = CONTROL_INDEX[k];
    if (typeof def === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      params[k] = ctl && ctl.min !== undefined ? Math.min(ctl.max, Math.max(ctl.min, v)) : v;
    } else if (typeof def === 'string') {
      if (typeof v !== 'string') continue;
      if (def[0] === '#') { if (HEX.test(v)) params[k] = v; }
      else if (k === 'text') params[k] = v.slice(0, 1200);
      else if (ctl && ctl.opts) { if (ctl.opts.some(([val]) => val === v)) params[k] = v; }
    }
  }
  const overrides = new Map();
  if (Array.isArray(o.overrides)) {
    for (const e of o.overrides.slice(0, MAX_OVERRIDES)) {
      if (Array.isArray(e) && Number.isFinite(e[0]) && (e[1] === 0 || (typeof e[1] === 'string' && HEX.test(e[1])))) overrides.set(e[0], e[1]);
    }
  }
  return { params, overrides };
}

/** Malla fusionada solo con caras expuestas, para exportar a GLB. */
export function mergedGeometry(model, idxArr, colArr, occupied) {
  const n = idxArr.length / 3, pos = [], col = [], nor = [];
  const tmp = new THREE.Color();
  const faces = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [0, 1, 0, [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
    [0, -1, 0, [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]],
    [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]],
    [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  const idx = [];
  for (let v = 0; v < n; v++) {
    const i = idxArr[v * 3], j = idxArr[v * 3 + 1], k = idxArr[v * 3 + 2];
    tmp.setRGB(colArr[v * 3] / 255, colArr[v * 3 + 1] / 255, colArr[v * 3 + 2] / 255, THREE.SRGBColorSpace);
    for (const [dx, dy, dz, quad] of faces) {
      if (occupied(i + dx, j + dy, k + dz)) continue;
      const base = pos.length / 3;
      for (const [qx, qy, qz] of quad) {
        pos.push(i + qx, j + qy, k + qz); nor.push(dx, dy, dz); col.push(tmp.r, tmp.g, tmp.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export function download(blobOrUrl, name) {
  const a = document.createElement('a');
  const isBlob = blobOrUrl instanceof Blob;
  a.href = isBlob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Exporta a MagicaVoxel (.vox): formato nativo de cubos, con paleta de 255 colores (corte mediano). */
export function toVox(model) {
  const { opI, opC } = model, n = opI.length / 3;
  if (!n) throw new Error('No hay cubos que exportar');
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let v = 0; v < n; v++) {
    const i = opI[v * 3], j = opI[v * 3 + 1], k = opI[v * 3 + 2];
    if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; if (k < z0) z0 = k; if (k > z1) z1 = k;
  }
  const sx = x1 - x0 + 1, sy = z1 - z0 + 1, sz = y1 - y0 + 1; // .vox: Z es arriba
  if (Math.max(sx, sy, sz) > 256) throw new Error('El modelo supera 256 cubos por lado; baja la resolución');
  let boxes = [Array.from({ length: n }, (_, v) => v)];
  while (boxes.length < 255) {
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift();
    if (box.length < 2) { boxes.push(box); break; }
    const rng = [0, 1, 2].map((ch) => { let lo = 255, hi = 0; for (const v of box) { const c = opC[v * 3 + ch]; if (c < lo) lo = c; if (c > hi) hi = c; } return hi - lo; });
    const ch = rng.indexOf(Math.max(...rng));
    box.sort((a, b) => opC[a * 3 + ch] - opC[b * 3 + ch]);
    boxes.push(box.slice(0, box.length >> 1), box.slice(box.length >> 1));
  }
  const pal = new Uint8Array(1024), cls = new Uint8Array(n);
  boxes.forEach((box, bi) => {
    let r = 0, g = 0, b = 0;
    for (const v of box) { r += opC[v * 3]; g += opC[v * 3 + 1]; b += opC[v * 3 + 2]; cls[v] = bi + 1; }
    pal.set([Math.round(r / box.length), Math.round(g / box.length), Math.round(b / box.length), 255], bi * 4);
  });
  const out = new Uint8Array(8 + 12 + 24 + 12 + 4 + n * 4 + 12 + 1024), dv = new DataView(out.buffer);
  let o = 0;
  const str = (s) => { for (const ch of s) out[o++] = ch.charCodeAt(0); };
  const u32 = (x) => { dv.setUint32(o, x, true); o += 4; };
  str('VOX '); u32(150);
  str('MAIN'); u32(0); u32(out.length - 20);
  str('SIZE'); u32(12); u32(0); u32(sx); u32(sy); u32(sz);
  str('XYZI'); u32(4 + n * 4); u32(0); u32(n);
  for (let v = 0; v < n; v++) { out[o++] = opI[v * 3] - x0; out[o++] = opI[v * 3 + 2] - z0; out[o++] = opI[v * 3 + 1] - y0; out[o++] = cls[v]; }
  str('RGBA'); u32(1024); u32(0);
  out.set(pal, o);
  return new Blob([out], { type: 'application/octet-stream' });
}
