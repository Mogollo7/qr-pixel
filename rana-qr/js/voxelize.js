// Generador de la rana (RF-MOL, RF-PER). Sin dependencias de three.
// La rana no tiene voxels: la rana ES los voxels. Cada parte anatómica es un volumen de cubos.
// Ejes: X derecha, Y arriba, Z hacia atrás (el hocico apunta a -Z). Unidad = 1 cubo.
// L = longitud hocico-cloaca en cubos (resolución global).

export const R = {
  EMPTY: 0, TORSO: 1, HEAD: 2, LIMB: 3, TOE: 4, PAD: 5, IRIS: 6, PUPIL: 7, GLAND: 8, CREST: 9,
  WART: 10, GLASS: 11, HEART: 12, LIVER: 13, GUT: 14, NOSTRIL: 15, WEB: 16, CUSTOM: 17, GLINT: 18, LID: 19, MODEL: 20,
};
export const PART_NAMES = ['', 'tronco', 'cabeza', 'extremidad', 'dedo', 'disco adhesivo', 'iris', 'pupila', 'parotoide', 'cresta craneal',
  'verruga', 'piel translúcida', 'corazón', 'hígado', 'intestino', 'narina', 'membrana', 'editado a mano', 'brillo del ojo', 'párpado', 'modelo importado'];

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mix = lerp3;

export function hex(h) {
  const n = parseInt(String(h).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hash3(a, b, c, s) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const voxKey = (i, j, k) => ((i + 4096) * 8192 + (k + 4096)) * 512 + j;

// curva suave por estaciones [t, valor] (Hermite con tangentes por diferencias finitas)
function hermite(st) {
  const n = st.length, m = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = st[Math.max(0, i - 1)], b = st[Math.min(n - 1, i + 1)];
    m[i] = (b[1] - a[1]) / (b[0] - a[0] || 1);
  }
  return (t) => {
    if (t <= st[0][0]) return st[0][1];
    if (t >= st[n - 1][0]) return st[n - 1][1];
    let i = 1;
    while (st[i][0] < t) i++;
    const [t0, v0] = st[i - 1], [t1, v1] = st[i], d = t1 - t0, u = (t - t0) / d, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * d * m[i - 1] + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * d * m[i];
  };
}

export class Grid {
  constructor(ox, oz, ny) {
    this.ox = ox; this.oz = oz; this.ny = ny; this.nx = 2 * ox; this.nz = 2 * oz;
    this.d = new Uint8Array(this.nx * this.nz * ny);
    this.imin = -ox; this.imax = ox - 1; this.kmin = -oz; this.kmax = oz - 1;
  }
  idx(i, j, k) { return ((i + this.ox) * this.nz + (k + this.oz)) * this.ny + j; }
  inb(i, j, k) { return i >= this.imin && i <= this.imax && k >= this.kmin && k <= this.kmax && j >= 0 && j < this.ny; }
  get(i, j, k) { return this.inb(i, j, k) ? this.d[this.idx(i, j, k)] : 0; }
  set(i, j, k, v) { if (this.inb(i, j, k)) this.d[this.idx(i, j, k)] = v; }
}

// recorre los cubos cuyo centro cae en la caja [x0,x1,y0,y1,z0,z1]
function iter(g, b, fn) {
  const i0 = Math.max(g.imin, Math.floor(b[0])), i1 = Math.min(g.imax, Math.ceil(b[1]));
  const j0 = Math.max(0, Math.floor(b[2])), j1 = Math.min(g.ny - 1, Math.ceil(b[3]));
  const k0 = Math.max(g.kmin, Math.floor(b[4])), k1 = Math.min(g.kmax, Math.ceil(b[5]));
  for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) fn(i + 0.5, j + 0.5, k + 0.5, i, j, k);
}

function ellipsoid(g, cx, cy, cz, rx, ry, rz, region, only) {
  iter(g, [cx - rx, cx + rx, cy - ry, cy + ry, cz - rz, cz + rz], (X, Y, Z, i, j, k) => {
    const a = (X - cx) / rx, b = (Y - cy) / ry, d = (Z - cz) / rz;
    if (a * a + b * b + d * d <= 1 && (!only || only(g.get(i, j, k)))) g.set(i, j, k, region);
  });
}

function capsule(g, A, B, ra, rb, region) {
  const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const m = Math.max(ra, rb);
  iter(g, [Math.min(A[0], B[0]) - m, Math.max(A[0], B[0]) + m, Math.min(A[1], B[1]) - m, Math.max(A[1], B[1]) + m,
    Math.min(A[2], B[2]) - m, Math.max(A[2], B[2]) + m], (X, Y, Z, i, j, k) => {
    const px = X - A[0], py = Y - A[1], pz = Z - A[2];
    const t = clamp((px * ab[0] + py * ab[1] + pz * ab[2]) / len2, 0, 1);
    const r = lerp(ra, rb, t);
    const dx = px - t * ab[0], dy = py - t * ab[1], dz = pz - t * ab[2];
    if (dx * dx + dy * dy + dz * dz <= r * r) g.set(i, j, k, region);
  });
}

// dedos en abanico desde la muñeca/tobillo; `lens` da el largo relativo de cada dedo
function toes(g, base, ang0, lens, spread, len, rad, padR) {
  const n = lens.length;
  for (let d = 0; d < n; d++) {
    const a = ang0 + (d - (n - 1) / 2) * spread, l = len * lens[d];
    const y = Math.max(rad, 0.55);
    const tip = [base[0] + Math.sin(a) * l, y, base[2] - Math.cos(a) * l];
    capsule(g, [base[0], Math.max(y, base[1]), base[2]], tip, rad, rad * 0.8, R.TOE);
    if (padR >= 0.75) ellipsoid(g, tip[0], Math.max(y, padR * 0.6), tip[2], padR * 1.2, Math.max(0.8, padR * 0.7), padR * 1.2, R.PAD);
  }
}

function web(g, base, ang0, span, radius) {
  iter(g, [base[0] - radius, base[0] + radius, 0, 1, base[2] - radius, base[2] + radius], (X, Y, Z, i, j, k) => {
    if (j > 0 || g.get(i, j, k)) return;
    const dx = X - base[0], dz = Z - base[2];
    if (Math.hypot(dx, dz) <= radius && Math.abs(Math.atan2(dx, -dz) - ang0) <= span) g.set(i, j, k, R.WEB);
  });
}

/**
 * @param p     parámetros (params.js)
 * @param opts  { overrides: Map<voxKey, hex|0>, photo: (X,Z)=>[r,g,b]|null, photoMix }
 */
export function buildFrog(p, opts = {}) {
  const L = Math.max(12, p.res | 0);
  const ox = Math.ceil(L * 0.85) + 2, oz = Math.ceil(L * (p.hindFold < 0.75 ? 1.75 : 0.85)) + 2, ny = Math.ceil(L * 0.8) + 4;
  const g = new Grid(ox, oz, ny);

  // ---------- perfiles del cuerpo (t: 0 hocico → 1 cloaca), en fracciones de L
  const te = p.headL, bw = p.bodyW, hw = bw * p.headW, bh = p.bodyH, hh = bh * p.headH;
  const kSn = lerp(0.38, 1.0, p.snout);
  const wBody = hermite([[te, hw], [0.54, bw], [0.74, bw * 0.84 * p.taper], [0.9, bw * 0.5 * p.taper], [1, bw * 0.16]]);
  const wAt = (t) => (t < te ? Math.max(0.03, hw * Math.pow(t / te, kSn)) : wBody(t));
  const hAt = hermite([[0, hh * 0.42], [te * 0.3, hh * 0.8], [te * 0.7, hh], [te, hh * 0.9 + bh * 0.1], [0.54, bh], [0.74, bh * 0.86], [0.9, bh * 0.58], [1, bh * 0.3]]);
  // altura de la línea ventral: frente levantado sobre los brazos, cadera apoyada
  const ybAt = hermite([[0, p.tilt * 0.17 + 0.025], [te, p.tilt * 0.13 + 0.012], [0.54, p.tilt * 0.06 + 0.006], [0.78, 0.012], [1, 0.03]]);
  const humpAt = (t) => p.hump * 0.03 * Math.exp(-(((t - 0.68) / 0.08) ** 2));
  const tOf = (Z) => Z / L + 0.5, zOf = (t) => (t - 0.5) * L;
  const nn = p.bodyN;

  // ---------- tronco + cabeza (volumen lofteado)
  for (let k = g.kmin; k <= g.kmax; k++) {
    const t = tOf(k + 0.5);
    if (t < 0 || t > 1) continue;
    const w = wAt(t) * L, h = hAt(t) * L, yc = ybAt(t) * L + h, hu = humpAt(t) * L, reg = t < te ? R.HEAD : R.TORSO;
    for (let i = Math.floor(-w); i <= Math.ceil(w); i++) {
      const fx = Math.pow(Math.abs(i + 0.5) / w, nn);
      if (fx > 1) continue;
      for (let j = Math.max(0, Math.floor(yc - h)); j <= Math.min(ny - 1, Math.ceil(yc + h + hu)); j++) {
        const dy = j + 0.5 - yc;
        if (fx + Math.pow(Math.abs(dy) / (dy > 0 ? h + hu : h), nn) <= 1) g.set(i, j, k, reg);
      }
    }
  }

  // ---------- extremidades anteriores
  const fr = Math.max(1, p.frontThick * L), ua = p.frontLen * L * 0.5, sp = p.frontSplay;
  const hr = Math.max(1.15, p.hindThick * L), T = p.hindThigh * L, Sh = p.hindShin * L, Ft = p.hindFoot * L, fo = p.hindFold;
  const padR = p.toePad * L, tl = p.toeLen * L;
  const ts = te + 0.07, th = 0.86;
  for (const sx of [-1, 1]) {
    const S = [sx * wAt(ts) * L * 0.72, (ybAt(ts) + hAt(ts) * 0.75) * L, zOf(ts)];
    const E = [S[0] + sx * ua * (0.3 + 0.5 * sp), Math.max(fr, S[1] - ua * 0.62), S[2] + ua * 0.5];
    const Wr = [E[0] + sx * ua * (0.3 * sp - 0.12), fr * 0.9, E[2] - ua * 0.92];
    capsule(g, S, E, fr * 1.25, fr, R.LIMB);
    capsule(g, E, Wr, fr, fr * 0.8, R.LIMB);
    toes(g, Wr, -sx * 0.3, [0.7, 0.9, 1, 0.75], 0.42, tl * 0.75, Math.max(0.6, fr * 0.4), padR);

    // ---------- extremidades posteriores: Z plegada (sentada) ↔ estirada
    const H = [sx * wAt(th) * L * 0.55, (ybAt(th) + hAt(th) * 1.1) * L, zOf(th)];
    // sentada: el muslo va pegado al flanco hacia delante y la rodilla sobresale; la tibia vuelve hasta el talón junto a la cloaca
    const kz = H[2] - T * 0.8, tk = clamp(tOf(kz), 0, 1);
    const Ks = [sx * Math.max(Math.abs(H[0]) + T * 0.45, wAt(tk) * L * 0.85 + hr * 1.3 + T * 0.3), Math.max(hr * 1.6, (ybAt(tk) + hAt(tk) * 1.45) * L), kz];
    const az = Ks[2] + Sh * 0.93;
    const As = [sx * (wAt(clamp(tOf(az), 0, 1)) * L * 0.75 + hr * 1.6 + Sh * 0.16), hr * 0.9, az];
    const Fs = [As[0] + sx * Ft * 0.42, hr * 0.55, As[2] - Ft * 0.88];
    const Ke = [H[0] + sx * T * 0.45, hr * 1.2, H[2] + T * 0.86];
    const Ae = [Ke[0] + sx * Sh * 0.1, hr, Ke[2] + Sh * 0.98];
    const Fe = [Ae[0] + sx * Ft * 0.3, hr * 0.55, Ae[2] + Ft * 0.92];
    const K = lerp3(Ke, Ks, fo), A = lerp3(Ae, As, fo), F = lerp3(Fe, Fs, fo);
    capsule(g, H, K, hr * 1.9, hr * 1.25, R.LIMB);
    capsule(g, K, A, hr * 1.1, hr * 0.7, R.LIMB);
    capsule(g, A, F, hr * 0.7, hr * 0.55, R.LIMB);
    const ang = Math.atan2(F[0] - A[0], -(F[2] - A[2])) + sx * 0.25;
    if (p.webbing > 0.02) web(g, F, ang, 0.95, p.webbing * tl * 1.25);
    toes(g, F, ang, sx > 0 ? [0.5, 0.7, 0.9, 1.25, 0.9] : [0.9, 1.25, 0.9, 0.7, 0.5], 0.4, tl * 1.25, Math.max(0.6, hr * 0.36), padR);
  }

  // ---------- ojos: órbita/párpado + iris + pupila + brillo, todo en cubos
  const teye = te * p.eyePos, er = Math.max(1.5, p.eyeSize * L);
  const exC = wAt(teye) * L * p.eyeSep * 0.86, ezC = zOf(teye);
  const eyC = (ybAt(teye) + hAt(teye) * 1.45) * L + er * (p.eyeProt * 0.9 - 0.35);
  for (const sx of [-1, 1]) {
    const cx = sx * exC;
    let nrm = [sx * (1 - 0.55 * p.eyeFront), 0.32, -(0.12 + 1.1 * p.eyeFront)];
    const nl = Math.hypot(...nrm); nrm = nrm.map((v) => v / nl);
    let hAx = [nrm[2], 0, -nrm[0]]; const hl = Math.hypot(...hAx); hAx = hAx.map((v) => v / hl); // eje horizontal del ojo
    const vAx = [nrm[1] * hAx[2] - nrm[2] * hAx[1], nrm[2] * hAx[0] - nrm[0] * hAx[2], nrm[0] * hAx[1] - nrm[1] * hAx[0]];
    iter(g, [cx - er, cx + er, eyC - er, eyC + er, ezC - er, ezC + er], (X, Y, Z, i, j, k) => {
      const dx = (X - cx) / er, dy = (Y - eyC) / er, dz = (Z - ezC) / er;
      if (dx * dx + dy * dy + dz * dz > 1) return;
      const proj = dx * nrm[0] + dy * nrm[1] + dz * nrm[2];
      let reg = R.LID;
      if (proj > 0.3) {
        reg = R.IRIS;
        const a = dx * hAx[0] + dy * hAx[1] + dz * hAx[2], b = dx * vAx[0] + dy * vAx[1] + dz * vAx[2], ps = p.pupilSize * 0.62;
        const inP = p.pupil === 'round' ? a * a + b * b <= ps * ps
          : p.pupil === 'hslit' ? (a / (ps * 1.45)) ** 2 + (b / (ps * 0.55)) ** 2 <= 1
            : (a / (ps * 0.5)) ** 2 + (b / (ps * 1.45)) ** 2 <= 1;
        if (inP) reg = R.PUPIL;
      }
      g.set(i, j, k, reg);
    });
    const gp = [cx + er * (nrm[0] * 0.75 + vAx[0] * 0.45 - hAx[0] * 0.3), eyC + er * (nrm[1] * 0.75 + vAx[1] * 0.45), ezC + er * (nrm[2] * 0.75 + vAx[2] * 0.45 - hAx[2] * 0.3)];
    const gr = Math.max(0.55, er * 0.2);
    ellipsoid(g, gp[0], gp[1], gp[2], gr, gr, gr, R.GLINT, (v) => v === R.IRIS || v === R.PUPIL);
  }

  // ---------- narinas
  {
    const tn = Math.min(te * 0.2, 0.07), kz = Math.floor(zOf(tn));
    for (const sx of [-1, 1]) {
      const i = Math.floor(sx * wAt(tn) * L * 0.55);
      for (let j = ny - 1; j >= 0; j--) if (g.get(i, j, kz) === R.HEAD) { g.set(i, j, kz, R.NOSTRIL); break; }
    }
  }

  // ---------- crestas craneales y parotoides (volumen añadido)
  const headTop = (t) => (ybAt(t) + hAt(t) * 2) * L;
  if (p.crests > 0.02) {
    const cr = Math.max(0.7, p.crests * L * 0.016);
    for (const sx of [-1, 1]) {
      const x = sx * Math.max(1, exC - er * 0.95);
      capsule(g, [x * 0.55, headTop(te * 0.25), zOf(te * 0.25)], [x, headTop(teye) + cr * 0.4, zOf(teye)], cr, cr, R.CREST);
      capsule(g, [x, headTop(teye) + cr * 0.4, zOf(teye)], [x * 1.05, headTop(te) + cr * 0.2, zOf(te * 1.02)], cr, cr, R.CREST);
    }
  }
  if (p.parotoid > 0.02) {
    const tp = te + 0.085 * p.parotoid;
    for (const sx of [-1, 1]) {
      ellipsoid(g, sx * wAt(tp) * L * 0.66, (ybAt(tp) + hAt(tp) * 1.72) * L, zOf(tp),
        Math.max(1.2, p.parotoid * L * 0.05), Math.max(1.2, p.parotoid * L * 0.04), Math.max(1.6, p.parotoid * L * 0.105), R.GLAND);
    }
  }

  // ---------- piel translúcida + órganos estilizados
  if (p.glass > 0.02) {
    const lim = 2 * p.glass - 1.1;
    for (let k = g.kmin; k <= g.kmax; k++) {
      const t = tOf(k + 0.5);
      if (t < te * 0.9 || t > 1) continue;
      const h = hAt(t) * L, yc = ybAt(t) * L + h;
      for (let i = g.imin; i <= g.imax; i++) for (let j = 0; j < ny; j++) {
        if (g.get(i, j, k) === R.TORSO && (j + 0.5 - yc) / h < lim) g.set(i, j, k, R.GLASS);
      }
    }
  }
  if (p.organs) {
    const inside = (v) => v === R.TORSO || v === R.GLASS;
    const org = (t, x, rx, ry, rz, reg) => ellipsoid(g, x * bw * L, (ybAt(t) + hAt(t) * 0.75) * L, zOf(t), rx * L, ry * L, rz * L, reg, inside);
    org(0.44, 0, bh * 0.38, bh * 0.36, bh * 0.38, R.HEART);
    org(0.54, -0.3, bw * 0.3, bh * 0.4, 0.07, R.LIVER);
    org(0.66, 0.2, bw * 0.38, bh * 0.38, 0.1, R.GUT);
  }

  // ---------- verrugas: variación de volumen sobre el dorso y las patas
  if (p.warts > 0.01) {
    for (let i = g.imin; i <= g.imax; i++) for (let k = g.kmin; k <= g.kmax; k++) {
      let top = -1;
      for (let j = ny - 2; j >= 0; j--) { const v = g.get(i, j, k); if (v) { if (v === R.TORSO || v === R.HEAD || v === R.LIMB) top = j; break; } }
      if (top >= 0 && hash3(i, k, 11, p.seed) < p.warts * 0.22) g.set(i, top + 1, k, R.WART);
    }
  }

  // ---------- ediciones manuales cubo a cubo
  const ov = opts.overrides && opts.overrides.size ? opts.overrides : null;
  if (ov) {
    for (let i = g.imin; i <= g.imax; i++) for (let k = g.kmin; k <= g.kmax; k++) for (let j = 0; j < ny; j++) {
      const key = voxKey(i, j, k);
      if (ov.has(key)) g.set(i, j, k, ov.get(key) === 0 ? R.EMPTY : R.CUSTOM);
    }
  }

  // ---------- color por cubo
  const C = {};
  for (const k of Object.keys(p)) if (k[0] === 'c' && typeof p[k] === 'string' && p[k][0] === '#') C[k] = hex(p[k]);
  const jit = 0.035 + p.mottle * 0.5, photoMix = opts.photoMix ?? 0;
  const tymR = p.tympanum * L, tTym = teye + (er + tymR * 1.25) / L;
  const tymY = (ybAt(tTym) + hAt(tTym) * 1.05) * L, tymZ = zOf(tTym);
  const eyeBandY = (t) => (ybAt(t) + hAt(t) * 1.25) * L;

  function colorFor(reg, X, Y, Z, i, j, k, top, below) {
    switch (reg) {
      case R.CUSTOM: return hex(ov.get(voxKey(i, j, k)));
      case R.PUPIL: return C.cPupil;
      case R.GLINT: return [255, 255, 255];
      case R.NOSTRIL: return mix(C.cLine, [0, 0, 0], 0.4);
      case R.HEART: return C.cHeart;
      case R.LIVER: return C.cLiver;
      case R.GUT: return C.cGut;
      case R.IRIS: { const f = 1 + (hash3(i, j, k, 3) - 0.5) * 0.2; return C.cIris.map((v) => v * f); }
      default:
    }
    const t = tOf(Z), ax = Math.abs(X);
    let col;
    if (reg === R.PAD) col = C.cPad;
    else if (reg === R.TOE || reg === R.WEB) col = below && !top ? mix(C.cToe, C.cBelly, 0.5) : C.cToe;
    else if (reg === R.GLAND || reg === R.CREST) col = C.cGland;
    else if (reg === R.WART) col = C.cWart;
    else if (reg === R.GLASS) col = C.cGlass;
    else {
      const body = reg === R.TORSO || reg === R.HEAD || reg === R.LID;
      const tc = clamp(t, 0, 1), h = hAt(tc) * L, yc = ybAt(tc) * L + h, w = wAt(tc) * L;
      const rel = (Y - yc) / h, side = ax / w;
      const noise = (hash3(Math.floor(i / 3), Math.floor(k / 3), 9, p.seed) - 0.5) * 0.8 + (tc - 0.5) * 0.6;
      const back = mix(C.cBack, C.cBack2, clamp(p.gradient * (0.5 + noise), 0, 1));
      let dorsal;
      if (body) {
        dorsal = reg === R.LID || rel > 0.12;
        col = dorsal ? back : rel < -0.38 ? C.cBelly : C.cFlank;
        if (reg === R.HEAD && !dorsal) {
          // boca: una hilera de cubos oscuros; por debajo, labio inferior y garganta claros
          const my = yc - h * 0.22;
          if (Math.abs(Y - my) < 0.5) col = mix(C.cLine, col, 0.25);
          else if (Y < my) col = C.cBelly;
        }
      } else {
        dorsal = top || !below;
        col = dorsal ? back : C.cBelly;
      }
      if (body && dorsal) {
        if (p.vertebral > 0 && ax < 0.5 + p.vertebral * L * 0.5 && t > te * 0.3) col = C.cLine;
        if (p.dorsolateral > 0 && Math.abs(side - p.dlPos) < p.dorsolateral && t > te * 0.8 && t < 0.92) col = C.cLine;
        if (p.interorbital > 0 && ax < exC && Math.abs(Z - ezC) < 0.5 + p.interorbital * er * 0.7) col = C.cLine;
      }
      if (body && p.eyeLine > 0 && t >= 0 && t < p.eyeLineLen && side > 0.55) {
        // franja cantal + supratimpánica: del hocico, a través del ojo, hacia el flanco
        const by = eyeBandY(tc) - (t > teye ? (t - teye) * L * 0.35 : 0), half = 0.5 + p.eyeLine * er * (t < teye ? 0.28 : 0.42);
        if (Math.abs(Y - by) < half) col = C.cLine;
      }
      if (tymR > 0.5 && reg === R.HEAD || tymR > 0.5 && reg === R.TORSO) {
        if (side > 0.6 && Math.hypot(Z - tymZ, Y - tymY) <= tymR) col = Math.hypot(Z - tymZ, Y - tymY) > tymR - 0.9 && tymR > 1.6 ? mix(C.cTymp, C.cLine, 0.5) : C.cTymp;
      }
      if (dorsal && p.spots > 0) {
        const cs = Math.max(2.2, p.spotSize * L * 2), cx = Math.floor(X / cs), cz = Math.floor(Z / cs);
        if (hash3(cx, cz, 21, p.seed) < p.spots * 2.2) {
          const px = (cx + 0.5 + (hash3(cx, cz, 22, p.seed) - 0.5) * 0.5) * cs, pz = (cz + 0.5 + (hash3(cx, cz, 23, p.seed) - 0.5) * 0.5) * cs;
          if (Math.hypot(X - px, Z - pz) <= cs * 0.5 * (0.55 + 0.45 * hash3(cx, cz, 24, p.seed))) col = C.cSpot;
        }
      }
      if (reg === R.LIMB && dorsal && p.legBands > 0) {
        const band = Math.floor((ax * 0.75 + Z * 0.65) / Math.max(1.6, L * 0.045));
        if ((band & 1) && hash3(band, 1, 1, p.seed) < p.legBands) col = C.cLine;
      }
      if (dorsal && opts.photo && photoMix > 0) {
        const pc = opts.photo(X, Z);
        if (pc) col = mix(col, pc, photoMix);
      }
    }
    const jf = 1 + (hash3(i, j, k, p.seed + 5) - 0.5) * 2 * jit;
    return [col[0] * jf, col[1] * jf, col[2] * jf];
  }

  // ---------- emisión: solo los cubos que pueden verse
  const opI = [], opC = [], glI = [], glC = [];
  const seeThrough = (i, j, k) => { const v = g.get(i, j, k); return v === 0 || v === R.GLASS; };
  let maxJ = 0;
  for (let i = g.imin; i <= g.imax; i++) for (let k = g.kmin; k <= g.kmax; k++) for (let j = 0; j < ny; j++) {
    const reg = g.d[g.idx(i, j, k)];
    if (!reg) continue;
    const isGlass = reg === R.GLASS;
    const show = isGlass
      ? !g.get(i + 1, j, k) || !g.get(i - 1, j, k) || !g.get(i, j + 1, k) || !g.get(i, j - 1, k) || !g.get(i, j, k + 1) || !g.get(i, j, k - 1)
      : seeThrough(i + 1, j, k) || seeThrough(i - 1, j, k) || seeThrough(i, j + 1, k) || seeThrough(i, j - 1, k) || seeThrough(i, j, k + 1) || seeThrough(i, j, k - 1);
    if (!show) continue;
    const rgb = colorFor(reg, i + 0.5, j + 0.5, k + 0.5, i, j, k, seeThrough(i, j + 1, k), j === 0 || seeThrough(i, j - 1, k));
    const r = clamp(Math.round(rgb[0]), 0, 255), gg = clamp(Math.round(rgb[1]), 0, 255), bb = clamp(Math.round(rgb[2]), 0, 255);
    if (isGlass) { glI.push(i, j, k); glC.push(r, gg, bb); } else { opI.push(i, j, k); opC.push(r, gg, bb); }
    if (j > maxJ) maxJ = j;
  }

  return {
    L, grid: g, height: maxJ + 1,
    opI: Int16Array.from(opI), opC: Uint8Array.from(opC), glI: Int16Array.from(glI), glC: Uint8Array.from(glC),
    count: (opI.length + glI.length) / 3,
  };
}
