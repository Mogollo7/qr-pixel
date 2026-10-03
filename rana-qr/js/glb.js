// Conversor GLB → cubos (RF-GLB). Lee un modelo 3D y lo reconstruye como volumen de cubos,
// promediando en cada cubo el color de la textura / color de vértice / material que cae dentro.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Grid, R, voxKey, hex } from './voxelize.js';

const MAX_BYTES = 80 * 1024 * 1024, MAX_TRIS = 2_000_000, MAX_TEX = 1024;

let loader = null;
function getLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/draco/');
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

function imageData(tex) {
  const img = tex && tex.image;
  if (!img || !img.width) return null;
  const s = Math.min(1, MAX_TEX / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  try { ctx.drawImage(img, 0, 0, cv.width, cv.height); return ctx.getImageData(0, 0, cv.width, cv.height); } catch { return null; }
}

function disposeScene(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}

/** Lee el archivo y devuelve los triángulos en espacio de mundo con lo necesario para muestrear su color. */
export async function loadGLB(file) {
  if (!file) throw new Error('No se eligió archivo');
  if (!/\.(glb|gltf)$/i.test(file.name)) throw new Error('El archivo debe ser .glb');
  if (file.size > MAX_BYTES) throw new Error('El modelo supera 80 MB');
  const gltf = await getLoader().parseAsync(await file.arrayBuffer(), '');
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const parts = [], v = new THREE.Vector3(), c = new THREE.Color(), texCache = new Map();
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const g = o.geometry, pa = g.attributes.position, n = pa.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
    const uv = g.attributes.uv ? Float32Array.from(g.attributes.uv.array) : null;
    let vcol = null;
    if (g.attributes.color) {
      vcol = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c.fromBufferAttribute(g.attributes.color, i).convertLinearToSRGB(); vcol[i * 3] = c.r; vcol[i * 3 + 1] = c.g; vcol[i * 3 + 2] = c.b; }
    }
    const index = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i);
    const mats = [].concat(o.material), groups = g.groups.length ? g.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats[gr.materialIndex] || mats[0];
      c.copy(m.color || new THREE.Color(1, 1, 1)).convertLinearToSRGB();
      let img = null;
      if (m.map) { if (!texCache.has(m.map)) texCache.set(m.map, imageData(m.map)); img = texCache.get(m.map); }
      const end = Math.min(index.length, gr.start + gr.count);
      parts.push({ pos, uv: img ? uv : null, vcol: m.vertexColors ? vcol : null, index: index.subarray(gr.start, end), base: [c.r, c.g, c.b], img,
        flipV: m.map ? m.map.flipY : false });
      tris += (end - gr.start) / 3;
    }
  });
  disposeScene(root);
  if (!tris) throw new Error('El GLB no contiene mallas');
  if (tris > MAX_TRIS) throw new Error('El modelo tiene demasiados triángulos (máx. 2 millones)');
  return { parts, tris, name: file.name };
}

function sampleColor(part, i0, i1, i2, w0, w1, w2) {
  let r = part.base[0], g = part.base[1], b = part.base[2];
  if (part.img && part.uv) {
    const uv = part.uv, im = part.img;
    let u = uv[i0 * 2] * w0 + uv[i1 * 2] * w1 + uv[i2 * 2] * w2, t = uv[i0 * 2 + 1] * w0 + uv[i1 * 2 + 1] * w1 + uv[i2 * 2 + 1] * w2;
    u -= Math.floor(u); t -= Math.floor(t);
    if (part.flipV) t = 1 - t;
    const o = (Math.min(im.height - 1, Math.floor(t * im.height)) * im.width + Math.min(im.width - 1, Math.floor(u * im.width))) * 4;
    r *= im.data[o] / 255; g *= im.data[o + 1] / 255; b *= im.data[o + 2] / 255;
  }
  if (part.vcol) {
    const vc = part.vcol;
    r *= vc[i0 * 3] * w0 + vc[i1 * 3] * w1 + vc[i2 * 3] * w2;
    g *= vc[i0 * 3 + 1] * w0 + vc[i1 * 3 + 1] * w1 + vc[i2 * 3 + 1] * w2;
    b *= vc[i0 * 3 + 2] * w0 + vc[i1 * 3 + 2] * w1 + vc[i2 * 3 + 2] * w2;
  }
  return [r * 255, g * 255, b * 255];
}

/**
 * Reconstruye el modelo con `res` cubos en su dimensión horizontal mayor.
 * opts: { rotY, rotX (grados), overrides, colors (0 = todos, n = paleta reducida a n niveles por canal) }
 */
export function voxelizeGLB(src, res, opts = {}) {
  const L = Math.max(12, res | 0);
  const rot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(opts.rotX || 0), THREE.MathUtils.degToRad(opts.rotY || 0), 0, 'YXZ'));
  const e = rot.elements;
  const tx = (p, i, out) => {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    out[0] = e[0] * x + e[4] * y + e[8] * z; out[1] = e[1] * x + e[5] * y + e[9] * z; out[2] = e[2] * x + e[6] * y + e[10] * z;
  };
  // caja envolvente tras girar
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], t = [0, 0, 0];
  for (const part of src.parts) for (const i of part.index) { tx(part.pos, i, t); for (let a = 0; a < 3; a++) { if (t[a] < mn[a]) mn[a] = t[a]; if (t[a] > mx[a]) mx[a] = t[a]; } }
  const size = Math.max(mx[0] - mn[0], mx[2] - mn[2], (mx[1] - mn[1]) * 0.999) || 1, sc = L / size;
  const off = [-(mn[0] + mx[0]) / 2 * sc, -mn[1] * sc, -(mn[2] + mx[2]) / 2 * sc];
  const ox = Math.ceil((mx[0] - mn[0]) * sc / 2) + 3, oz = Math.ceil((mx[2] - mn[2]) * sc / 2) + 3, ny = Math.ceil((mx[1] - mn[1]) * sc) + 4;
  const g = new Grid(ox, oz, ny);
  const acc = new Map(); // voxKey -> [r, g, b, n]
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  for (const part of src.parts) {
    const idx = part.index;
    for (let f = 0; f + 2 < idx.length; f += 3) {
      const i0 = idx[f], i1 = idx[f + 1], i2 = idx[f + 2];
      tx(part.pos, i0, a); tx(part.pos, i1, b); tx(part.pos, i2, c);
      for (let k = 0; k < 3; k++) { a[k] = a[k] * sc + off[k]; b[k] = b[k] * sc + off[k]; c[k] = c[k] * sc + off[k]; }
      const lab = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), lac = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), lbc = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]);
      const steps = Math.min(400, Math.max(1, Math.ceil(Math.max(lab, lac, lbc) / 0.45)));
      for (let p = 0; p <= steps; p++) for (let q = 0; q <= steps - p; q++) {
        const w1 = p / steps, w2 = q / steps, w0 = 1 - w1 - w2;
        const i = Math.floor(a[0] * w0 + b[0] * w1 + c[0] * w2), j = Math.floor(a[1] * w0 + b[1] * w1 + c[1] * w2), k = Math.floor(a[2] * w0 + b[2] * w1 + c[2] * w2);
        if (!g.inb(i, j, k)) continue;
        const key = voxKey(i, j, k), col = sampleColor(part, i0, i1, i2, w0, w1, w2);
        const cur = acc.get(key);
        if (cur) { cur[0] += col[0]; cur[1] += col[1]; cur[2] += col[2]; cur[3]++; } else { acc.set(key, [col[0], col[1], col[2], 1]); g.set(i, j, k, R.MODEL); }
      }
    }
  }
  const ov = opts.overrides && opts.overrides.size ? opts.overrides : null;
  if (ov) {
    for (let i = g.imin; i <= g.imax; i++) for (let k = g.kmin; k <= g.kmax; k++) for (let j = 0; j < ny; j++) {
      const key = voxKey(i, j, k);
      if (ov.has(key)) g.set(i, j, k, ov.get(key) === 0 ? R.EMPTY : R.CUSTOM);
    }
  }
  const lv = opts.colors > 1 ? opts.colors - 1 : 0, quant = (x) => (lv ? Math.round(x / 255 * lv) / lv * 255 : x);
  const opI = [], opC = [];
  let maxJ = 0;
  for (let i = g.imin; i <= g.imax; i++) for (let k = g.kmin; k <= g.kmax; k++) for (let j = 0; j < ny; j++) {
    const reg = g.d[g.idx(i, j, k)];
    if (!reg) continue;
    // cubos totalmente rodeados no se emiten
    if (g.get(i + 1, j, k) && g.get(i - 1, j, k) && g.get(i, j + 1, k) && g.get(i, j - 1, k) && g.get(i, j, k + 1) && g.get(i, j, k - 1)) continue;
    let rgb;
    if (reg === R.CUSTOM) rgb = hex(ov.get(voxKey(i, j, k)));
    else { const s = acc.get(voxKey(i, j, k)); rgb = [quant(s[0] / s[3]), quant(s[1] / s[3]), quant(s[2] / s[3])]; }
    opI.push(i, j, k); opC.push(Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]));
    if (j > maxJ) maxJ = j;
  }
  return { L, grid: g, height: maxJ + 1, opI: Int16Array.from(opI), opC: Uint8Array.from(opC), glI: new Int16Array(0), glC: new Uint8Array(0), count: opI.length / 3 };
}
