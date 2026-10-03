// Foto de referencia de una rana real (RF-FOTO): muestreo, proyección y paleta

const MAX_SIDE = 512;

export async function loadPhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen supera 15 MB');
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * s));
  canvas.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, data, aspect: canvas.width / canvas.height };
}

/** Devuelve un muestreador (X,Z) -> [r,g,b] | null según la transformación. */
export function makeSampler(photo, L, t) {
  const spanZ = L * t.scale * 1.8, spanX = spanZ * photo.aspect;
  const { width, height, data } = photo.data;
  const mask = photo.sil && photo.sil.ok ? photo.sil.mask : null;
  return (X, Z) => {
    const u = X / spanX + 0.5 + t.offX * 0.5, v = Z / spanZ + 0.5 + t.offZ * 0.5;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    const pi = Math.floor(v * height) * width + Math.floor(u * width), o = pi * 4;
    if (mask && !mask[pi]) return null; // fondo de la foto: ese cubo conserva el color del molde
    return [data[o], data[o + 1], data[o + 2]];
  };
}

/** Corte mediano: devuelve hasta n colores [{rgb, count}] ordenados por frecuencia. */
export function extractPalette(photo, n = 6, mask = null) {
  const { width, height, data } = photo.data;
  const px = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4000)));
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const o = (y * width + x) * 4;
    if (data[o + 3] > 200 && (!mask || mask[y * width + x])) px.push([data[o], data[o + 1], data[o + 2]]);
  }
  let boxes = [px];
  while (boxes.length < n) {
    boxes.sort((a, b) => b.length - a.length);
    const box = boxes.shift();
    if (!box || box.length < 2) { if (box) boxes.push(box); break; }
    const rng = [0, 1, 2].map((ch) => { let lo = 255, hi = 0; for (const p of box) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; } return hi - lo; });
    const ch = rng.indexOf(Math.max(...rng));
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.push(box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length).map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return { rgb: s.map((v) => Math.round(v / b.length)), count: b.length };
  }).sort((a, b) => b.count - a.count);
}

export const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };

/** Asignación automática a la paleta de la rana a partir de los colores extraídos. */
export function autoAssign(colors) {
  const cs = colors.map((c) => c.rgb);
  if (!cs.length) return {};
  const byLum = [...cs].sort((a, b) => lum(a) - lum(b));
  const darkest = byLum[0], lightest = byLum[byLum.length - 1];
  const rest = cs.filter((c) => c !== darkest && c !== lightest);
  const back = rest[0] || cs[0], back2 = rest[1] || back;
  const vivid = [...cs].sort((a, b) => sat(b) - sat(a))[0];
  return {
    cBack: toHex(back), cBack2: toHex(back2), cBelly: toHex(lightest), cFlank: toHex(back2),
    cLine: toHex(darkest), cSpot: toHex(vivid), cIris: toHex(vivid), cToe: toHex(back2), cPad: toHex(lightest),
    cGland: toHex(darkest), cWart: toHex(darkest),
  };
}

/**
 * Separa la rana del fondo (color dominante del borde) y mide su silueta.
 * Se asume vista cenital con la cabeza hacia arriba. Todas las medidas son relativas.
 */
export function analyzeSilhouette(photo) {
  const { width: w, height: h, data } = photo.data;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const med = (ch) => { const a = border.map((i) => data[i * 4 + ch]).sort((p, q) => p - q); return a[a.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const dist = (i) => Math.hypot(data[i * 4] - bg[0], data[i * 4 + 1] - bg[1], data[i * 4 + 2] - bg[2]);
  const spread = border.reduce((s, i) => s + dist(i), 0) / border.length;
  const thr = Math.max(38, spread * 2.5);
  const mask = new Uint8Array(w * h);
  let n = 0, sx = 0;
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 200 && dist(i) > thr) { mask[i] = 1; n++; sx += i % w; }
  const cover = n / (w * h);
  const bad = { ok: false, mask, cover };
  if (cover < 0.03 || cover > 0.9) return bad;
  const cxPx = Math.round(sx / n);
  // tramo contiguo que pasa por el eje del cuerpo: descarta patas separadas del tronco
  const run = new Int32Array(h);
  let y0 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    if (!mask[y * w + cxPx]) continue;
    let a = cxPx, b = cxPx;
    while (a > 0 && mask[y * w + a - 1]) a--;
    while (b < w - 1 && mask[y * w + b + 1]) b++;
    run[y] = b - a + 1;
    if (y0 < 0) y0 = y;
    y1 = y;
  }
  const len = y1 - y0 + 1;
  if (y0 < 0 || len < 8) return bad;
  const seg = (f0, f1) => { const a = []; for (let y = y0 + Math.floor(len * f0); y <= y0 + Math.floor(len * f1) && y <= y1; y++) if (run[y]) a.push(run[y]); return a.sort((p, q) => p - q); };
  const mid = (a) => (a.length ? a[a.length >> 1] : 1);
  const trunk = mid(seg(0.4, 0.75)), head = mid(seg(0.12, 0.3)), snout = mid(seg(0.02, 0.08)), waist = (seg(0.72, 0.9)[0] || trunk);
  return {
    ok: true, mask, cover,
    cx: cxPx / w, bodyH: len / h, bodyCy: (y0 + y1 + 1) / 2 / h,
    trunkRel: trunk / len,
    headRel: head / trunk, snoutRel: Math.min(1, snout / head), waistRel: Math.min(1, waist / trunk),
  };
}
