// Estado QR (RF-QR, RF-SCAN): los mismos cubos de la rana se reordenan en el código.
// Capa de protección: el color de cada cubo se limita para que el QR siga siendo legible,
// y la lectura se comprueba con jsQR sobre la imagen final. Nunca se degrada en silencio.
import { hex } from './voxelize.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const DARK_MAX = 60, LIGHT_MIN = 200;

/** Cubos por lado de módulo para que el QR use aproximadamente los cubos de la rana. */
export function cubesPerModule(nFrog, qr, quiet, relief) {
  let dark = 0;
  for (const row of qr.matrix) for (const d of row) if (d) dark++;
  const M = qr.size + 2 * quiet;
  const perS2 = M * M + dark * relief;
  return Math.max(1, Math.min(5, Math.round(Math.sqrt(nFrog / perS2))));
}

/**
 * Panel vertical que mira hacia -Z (hacia donde mira la rana).
 * Devuelve posiciones de cubo y si cada cubo es de módulo oscuro.
 */
export function buildQRCubes(qr, p, s) {
  const N = qr.size, q = p.quiet, M = N + 2 * q, side = M * s, relief = p.qrRelief | 0;
  const pos = [], dark = [];
  for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
    const mr = r - q, mc = c - q;
    const d = mr >= 0 && mc >= 0 && mr < N && mc < N && qr.matrix[mr][mc];
    for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
      const x = side / 2 - (c * s + a) - 0.5, y = side - (r * s + b) - 0.5 + 1;
      pos.push(x, y, 0.5); dark.push(d ? 1 : 0);
      if (d) for (let l = 1; l <= relief; l++) { pos.push(x, y, 0.5 - l); dark.push(1); }
    }
  }
  return { pos: Float32Array.from(pos), dark: Uint8Array.from(dark), n: dark.length, side, M, s };
}

/** Color final de un cubo del QR a partir del color del cubo de rana que lo ocupa. */
export function qrColor(p, isDark, frogRGB, strength = 1) {
  if (p.qrStyle !== 'tint') {
    let c = hex(isDark ? p.darkColor : p.lightColor);
    const l = lum(c);
    if (isDark && l > DARK_MAX) c = c.map((v) => v * DARK_MAX / l);
    if (!isDark && l < LIGHT_MIN) c = c.map((v) => v + (255 - v) * ((LIGHT_MIN - l) / (255 - l)));
    return c;
  }
  if (!isDark) return hex(p.lightColor).map((v) => Math.max(v, 225));
  const l = lum(frogRGB) || 1, cap = DARK_MAX * strength;
  return l > cap ? frogRGB.map((v) => v * cap / l) : frogRGB;
}

/** Dibuja el QR tal como queda (vista frontal) en un canvas. `cols` = RGB 0-255 por cubo. */
export function rasterQR(state, cols, cell = 4, margin = 2) {
  const { side, pos, n } = state;
  const cv = document.createElement('canvas');
  cv.width = cv.height = (side + margin * 2) * cell;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  const order = [...Array(n).keys()].sort((a, b) => pos[b * 3 + 2] - pos[a * 3 + 2]); // el frente al final
  for (const v of order) {
    const px = Math.round(side / 2 - pos[v * 3] - 0.5), py = Math.round(side - pos[v * 3 + 1] + 0.5);
    ctx.fillStyle = `rgb(${cols[v * 3]},${cols[v * 3 + 1]},${cols[v * 3 + 2]})`;
    ctx.fillRect((px + margin) * cell, (py + margin) * cell, cell, cell);
  }
  return cv;
}

export function scanCanvas(cv, expected) {
  if (typeof jsQR !== 'function') return { ok: false, error: 'jsQR no cargó' };
  const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
  const res = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  return { ok: !!res && res.data === expected, data: res ? res.data : '' };
}
