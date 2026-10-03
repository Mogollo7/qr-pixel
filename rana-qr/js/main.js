// Rana QR — escena, interfaz y herramientas.
// Principio: la rana no tiene voxels, la rana ES los voxels. Todo lo visible son cubos instanciados.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MOLDS, TABS, PALETTE_KEYS, moldParams } from './params.js';
import { makeQR } from './qr.js';
import { buildFrog, voxKey, R, PART_NAMES } from './voxelize.js';
import { cubesPerModule, buildQRCubes, qrColor, rasterQR, scanCanvas } from './qrstate.js';
import { loadPhoto, makeSampler, extractPalette, autoAssign, analyzeSilhouette, toHex } from './photo.js';
import { serialize, deserialize, mergedGeometry, download, toVox } from './io.js';
import { loadGLB, voxelizeGLB } from './glb.js';
import { makeEntry } from './sitio.js';
import { nuevoId, leerMios, guardarQR, borrarQR } from './mios.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of kids) e.append(k);
  return e;
};
// ------------------------------------------------------------------ estado
const state = {
  mold: 'minecraft',
  p: moldParams('minecraft'),
  overrides: new Map(),
  history: [], future: [],
  tool: 'orbit', brush: 1, sym: true, color: '#e04a2f',
  glb: null, glbT: { rotY: 0, rotX: 0, colors: 0 },
  photo: null, photoT: { scale: 1, offX: 0, offZ: 0, mix: 0, opacity: 0, quant: 6, show: false },
  photoPalette: [],
  tab: 'molde',
};
let model = null, qr = null, qrState = null, qrCols = null;

// ------------------------------------------------------------------ escena
const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
// Metamorfosis rana -> QR en GPU: cada instancia lleva su destino (aQr), su color final (aQrCol)
// y (azar, escala inicial, escala final) en aMisc. Un solo uniforme anima miles de cubos.
const U = { uMorph: { value: 0 }, uArc: { value: 10 } };
function morphable(mat, withColor) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMorph = U.uMorph; sh.uniforms.uArc = U.uArc;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aQr; attribute vec3 aQrCol; attribute vec3 aMisc;
        uniform float uMorph; uniform float uArc;
        float morphT() { float t = clamp(uMorph * 1.7 - aMisc.x * 0.7, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float mt = morphT(), fly = sin(mt * 3.14159265);
          float ang = fly * (aMisc.x - 0.5) * 7.0, cs = cos(ang), sn = sin(ang);
          transformed.xz = mat2(cs, -sn, sn, cs) * transformed.xz;
          transformed *= mix(aMisc.y, aMisc.z, mt);
          vec3 off = (aQr - instanceMatrix[3].xyz) * mt;
          off.y += fly * uArc * (0.3 + aMisc.x);
          off.x += fly * uArc * (fract(aMisc.x * 7.31) - 0.5);
          transformed += off;
        }`);
    if (withColor) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        vColor.rgb = mix(vColor.rgb, aQrCol, morphT());`);
    // en estado QR los cubos pasan a color plano (sin sombreado) para que el contraste en pantalla sea el verificado
    if (withColor) sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uMorph;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 qrFlat = diffuseColor.rgb * uMorph * 0.9; diffuseColor.rgb *= 1.0 - uMorph * 0.9;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += qrFlat;`);
  };
  return mat;
}
const matOpaque = morphable(new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }), true);
const matGlass = morphable(new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false }), true);
const matDepth = morphable(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), false);
const meshes = { op: null, gl: null };

const hover = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)), new THREE.LineBasicMaterial({ color: 0xffffff }));
hover.visible = false;
scene.add(hover);

const photoPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }));
photoPlane.rotation.x = -Math.PI / 2;
photoPlane.visible = false;
photoPlane.renderOrder = 5;
scene.add(photoPlane);

let dirty = true, spinning = false;
controls.addEventListener('change', () => { dirty = true; });
const clock = new THREE.Clock();
const morph = { target: 0, value: 0, camFrom: null, camTo: null };
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (morph.value !== morph.target) {
    const dir = Math.sign(morph.target - morph.value);
    morph.value = Math.min(1, Math.max(0, morph.value + dir * dt / 1.9));
    U.uMorph.value = morph.value;
    if (morph.camFrom) {
      const e = morph.value * morph.value * (3 - 2 * morph.value);
      camera.position.lerpVectors(morph.camFrom.pos, morph.camTo.pos, e);
      controls.target.lerpVectors(morph.camFrom.tgt, morph.camTo.tgt, e);
    }
    if (morph.value === morph.target) onMorphEnd();
    dirty = true;
  }
  controls.autoRotate = spinning && morph.value === 0;
  if (controls.update(dt) || dirty || controls.autoRotate) { renderer.render(scene, camera); dirty = false; }
});

new ResizeObserver(() => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dirty = true;
}).observe(viewport);

function viewPose(v) {
  const L = model.L, narrow = camera.aspect < 1 ? 1 / camera.aspect : 1, d = L * 3.0 * narrow;
  const tgt = new THREE.Vector3(0, model.height * 0.42, 0);
  const pos = v === 'top' ? new THREE.Vector3(0, d, 0.01)
    : v === 'side' ? new THREE.Vector3(-d * 0.98, d * 0.14, 0)
      : v === 'front' ? new THREE.Vector3(0, d * 0.16, -d)
        : new THREE.Vector3(-d * 0.55, d * 0.42, -d * 0.68);
  return { pos: pos.add(tgt), tgt };
}
function qrPose() {
  const side = qrState.side, narrow = camera.aspect < 1 ? 1 / camera.aspect : 1;
  const tgt = new THREE.Vector3(0, side / 2 + 1, 0);
  return { pos: new THREE.Vector3(0, side / 2 + 1, -side * 2.75 * narrow), tgt };
}
function setView(v) {
  if (!model || morph.value > 0) return;
  const pose = viewPose(v);
  camera.position.copy(pose.pos); controls.target.copy(pose.tgt);
  controls.update();
  dirty = true;
}

function toggleMorph() {
  if (!model || !qrState) return;
  if (state.tool !== 'orbit') setTool('orbit');
  const toQR = morph.target === 0;
  if (toQR) {
    morph.camFrom = { pos: camera.position.clone(), tgt: controls.target.clone() };
    morph.camTo = qrPose();
    hover.visible = false;
  }
  morph.target = toQR ? 1 : 0;
  controls.enabled = false;
  updatePhotoPlane();
  updateMorphButton();
}
function onMorphEnd() {
  controls.enabled = true;
  if (morph.value === 0) morph.camFrom = morph.camTo = null;
  updateMorphButton();
}
function updateMorphButton() {
  const b = $('#morph');
  b.textContent = morph.target === 1 ? 'Volver a rana' : 'Convertir en QR';
  b.setAttribute('aria-pressed', morph.target === 1);
}

// ------------------------------------------------------------------ cubos instanciados
const _m = new THREE.Matrix4(), _c = new THREE.Color();
function ensureMesh(kind, n, material) {
  let mesh = meshes[kind];
  if (mesh && mesh.instanceMatrix.count >= n) return mesh;
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); }
  const cap = Math.max(1024, Math.ceil(n * 1.25));
  const geo = boxGeo.clone(); // la geometría lleva los atributos por instancia de esta malla
  geo.setAttribute('aQr', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aQrCol', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
  mesh = new THREE.InstancedMesh(geo, material, cap);
  mesh.castShadow = mesh.receiveShadow = kind === 'op';
  if (kind === 'op') mesh.customDepthMaterial = matDepth;
  mesh.frustumCulled = false; // los cubos se desplazan en el shader
  if (kind === 'gl') mesh.renderOrder = 2;
  mesh.name = kind === 'op' ? 'cubos' : 'cubos-translucidos';
  scene.add(mesh);
  meshes[kind] = mesh;
  return mesh;
}

// Empareja cubos de rana con cubos de QR por posición en pantalla para que el vuelo sea ordenado.
function fillOpaque() {
  const nF = model.opI.length / 3, nQ = qrState.n, n = Math.max(nF, nQ);
  const mesh = ensureMesh('op', n, matOpaque), g = mesh.geometry;
  const aQr = g.attributes.aQr.array, aCol = g.attributes.aQrCol.array, aMisc = g.attributes.aMisc.array;
  const fi = model.opI, fc = model.opC, qp = qrState.pos;
  const fOrder = Array.from({ length: nF }, (_, v) => v).sort((a, b) => (fi[b * 3] - fi[a * 3]) || (fi[a * 3 + 1] - fi[b * 3 + 1]));
  const qOrder = Array.from({ length: nQ }, (_, v) => v).sort((a, b) => (qp[b * 3] - qp[a * 3]) || (qp[a * 3 + 1] - qp[b * 3 + 1]));
  qrCols = new Uint8Array(nQ * 3);
  const strength = qrState.strength;
  let prevQ = -1;
  for (let r = 0; r < n; r++) {
    // rango r en la rana <-> rango proporcional en el QR; los sobrantes de un lado nacen o se encogen
    const f = fOrder[r < nF ? r : (r * 7919) % nF];
    const qi = nQ >= nF ? r : Math.floor(r * nQ / nF);
    const realQ = qi !== prevQ; prevQ = qi;
    const q = qOrder[qi];
    _m.makeTranslation(fi[f * 3] + 0.5, fi[f * 3 + 1] + 0.5, fi[f * 3 + 2] + 0.5);
    mesh.setMatrixAt(r, _m);
    const frgb = [fc[f * 3], fc[f * 3 + 1], fc[f * 3 + 2]];
    _c.setRGB(frgb[0] / 255, frgb[1] / 255, frgb[2] / 255, THREE.SRGBColorSpace);
    mesh.setColorAt(r, _c);
    const qc = qrColor(state.p, qrState.dark[q] === 1, frgb, strength);
    if (realQ) { qrCols[q * 3] = qc[0]; qrCols[q * 3 + 1] = qc[1]; qrCols[q * 3 + 2] = qc[2]; }
    _c.setRGB(qc[0] / 255, qc[1] / 255, qc[2] / 255, THREE.SRGBColorSpace);
    aQr[r * 3] = qp[q * 3]; aQr[r * 3 + 1] = qp[q * 3 + 1]; aQr[r * 3 + 2] = qp[q * 3 + 2];
    aCol[r * 3] = _c.r; aCol[r * 3 + 1] = _c.g; aCol[r * 3 + 2] = _c.b;
    aMisc[r * 3] = Math.random(); aMisc[r * 3 + 1] = r < nF ? 1 : 0; aMisc[r * 3 + 2] = realQ ? 1 : 0;
  }
  finishMesh(mesh, n);
  mesh.userData.idx = fi; mesh.userData.real = nF; mesh.userData.order = fOrder;
}

function fillGlass() {
  const n = model.glI.length / 3, mesh = ensureMesh('gl', n, matGlass), g = mesh.geometry;
  const aQr = g.attributes.aQr.array, aMisc = g.attributes.aMisc.array, fi = model.glI, fc = model.glC;
  for (let v = 0; v < n; v++) {
    _m.makeTranslation(fi[v * 3] + 0.5, fi[v * 3 + 1] + 0.5, fi[v * 3 + 2] + 0.5);
    mesh.setMatrixAt(v, _m);
    _c.setRGB(fc[v * 3] / 255, fc[v * 3 + 1] / 255, fc[v * 3 + 2] / 255, THREE.SRGBColorSpace);
    mesh.setColorAt(v, _c);
    aQr[v * 3] = 0; aQr[v * 3 + 1] = qrState.side / 2; aQr[v * 3 + 2] = 0.5;
    aMisc[v * 3] = Math.random(); aMisc[v * 3 + 1] = 1; aMisc[v * 3 + 2] = 0; // en el QR desaparecen
  }
  finishMesh(mesh, n);
  mesh.userData.idx = fi; mesh.userData.real = n; mesh.userData.order = null;
}

function finishMesh(mesh, n) {
  mesh.count = n; mesh.visible = n > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  for (const k of ['aQr', 'aQrCol', 'aMisc']) mesh.geometry.attributes[k].needsUpdate = true;
  mesh.boundingSphere = null; mesh.boundingBox = null;
}

// ------------------------------------------------------------------ reconstrucción
let rebuildQueued = false, firstBuild = true;
function scheduleRebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => { rebuildQueued = false; rebuild(); });
}

function photoSampler(L) {
  const ph = state.photo, t = state.photoT;
  if (!ph || t.mix <= 0) return null;
  const raw = makeSampler(ph, L, t);
  const pal = state.photoPalette.slice(0, t.quant).map((c) => c.rgb);
  if (!pal.length) return raw;
  // cada cubo recibe un color de la paleta reducida: reconstrucción por cubos, no proyección de la foto
  return (X, Z) => {
    const c = raw(X, Z);
    if (!c) return null;
    let best = pal[0], bd = Infinity;
    for (const q of pal) { const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2; if (d < bd) { bd = d; best = q; } }
    return best;
  };
}

let scan = { ok: false, note: '' };
function rebuild() {
  const p = state.p;
  try { qr = makeQR(p.text, p.ecc, p.minVersion); } catch (e) { toast(e.message); return; }
  const t0 = performance.now();
  model = state.glb
    ? voxelizeGLB(state.glb, p.res, { ...state.glbT, overrides: state.overrides })
    : buildFrog(p, { overrides: state.overrides, photo: photoSampler(p.res), photoMix: state.photoT.mix });
  const nF = model.opI.length / 3;
  if (!nF) { toast('La rana se quedó sin cubos: deshaz la última edición.'); return; }
  qrState = buildQRCubes(qr, p, cubesPerModule(nF, qr, p.quiet, p.qrRelief));
  // capa de protección: si el tinte de la rana impide leer el QR, se oscurece hasta que se lea
  const expected = p.text && p.text.length ? p.text : ' ';
  scan = { ok: false, note: '' };
  for (const strength of [1, 0.6, 0.3, 0]) {
    qrState.strength = strength;
    fillOpaque();
    const r = scanCanvas(rasterQR(qrState, qrCols), expected);
    if (r.error) { scan = { ok: false, note: r.error }; break; }
    if (r.ok) { scan = { ok: true, note: strength < 1 ? 'colores oscurecidos para garantizar la lectura' : '' }; break; }
    if (p.qrStyle !== 'tint') break;
  }
  fillGlass();
  const L = model.L, ext = Math.max(L, qrState.side);
  U.uArc.value = L * 0.35;
  ground.scale.setScalar(ext * 14);
  sun.position.set(-ext * 1.1, ext * 2.4, -ext * 1.5);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -ext * 1.5; sc.right = sc.top = ext * 1.5; sc.near = 1; sc.far = ext * 7;
  sc.updateProjectionMatrix();
  camera.near = L * 0.1; camera.far = L * 80; camera.updateProjectionMatrix();
  updatePhotoPlane();
  if (firstBuild) { setView('iso'); firstBuild = false; }
  if (morph.target === 1) { morph.camTo = qrPose(); camera.position.copy(morph.camTo.pos); controls.target.copy(morph.camTo.tgt); }
  const ms = Math.round(performance.now() - t0);
  $('#stats').textContent = `${Math.max(nF, qrState.n).toLocaleString('es')} cubos · rana de ${L} de largo · QR v${qr.version} (${qr.size}×${qr.size}, ${qrState.s}×${qrState.s} cubos por módulo) · ${ms} ms`;
  const b = $('#scan');
  b.className = 'badge ' + (scan.ok ? (scan.note ? 'warn' : 'ok') : 'bad');
  b.textContent = scan.ok ? 'QR legible ✓' + (scan.note ? ' · ' + scan.note : '') : 'QR NO legible' + (scan.note ? ': ' + scan.note : ': sube el contraste de los dos colores');
  dirty = true;
  autosave();
}

// ------------------------------------------------------------------ interfaz
const inputs = new Map();
function setParam(k, v) { state.p[k] = v; scheduleRebuild(); }

function control(c) {
  const id = 'c_' + c.k;
  if (c.t === 'range') {
    const out = el('output', { textContent: state.p[c.k] });
    const inp = el('input', { type: 'range', id, min: c.min, max: c.max, step: c.step, value: state.p[c.k] });
    inp.addEventListener('input', () => { out.textContent = inp.value; setParam(c.k, parseFloat(inp.value)); });
    inputs.set(c.k, { set: (v) => { inp.value = v; out.textContent = v; } });
    return el('div', { className: 'row' }, el('label', { htmlFor: id, textContent: c.label }), out, inp);
  }
  if (c.t === 'color') {
    const inp = el('input', { type: 'color', id, value: state.p[c.k] });
    inp.addEventListener('input', () => setParam(c.k, inp.value));
    inputs.set(c.k, { set: (v) => { inp.value = v; } });
    return el('div', { className: 'row inline' }, el('label', { htmlFor: id, textContent: c.label }), inp);
  }
  if (c.t === 'select') {
    const inp = el('select', { id });
    for (const [v, l] of c.opts) inp.append(el('option', { value: v, textContent: l }));
    inp.value = String(state.p[c.k]);
    inp.addEventListener('change', () => setParam(c.k, c.num ? parseInt(inp.value, 10) : inp.value));
    inputs.set(c.k, { set: (v) => { inp.value = String(v); } });
    return el('div', { className: 'row full' }, el('label', { htmlFor: id, textContent: c.label }), inp);
  }
  if (c.t === 'check') {
    const inp = el('input', { type: 'checkbox', id, checked: !!state.p[c.k] });
    inp.addEventListener('change', () => setParam(c.k, inp.checked ? 1 : 0));
    inputs.set(c.k, { set: (v) => { inp.checked = !!v; } });
    return el('div', { className: 'check' }, el('label', { htmlFor: id, textContent: c.label }), inp);
  }
  const inp = el('textarea', { id, value: state.p[c.k], maxLength: 1200, spellcheck: false });
  let t = 0;
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setParam(c.k, inp.value), 200); });
  inputs.set(c.k, { set: (v) => { inp.value = v; } });
  return el('div', { className: 'row full' }, el('label', { htmlFor: id, textContent: c.label }), inp);
}

function syncInputs() { for (const [k, i] of inputs) if (k in state.p) i.set(state.p[k]); }

const ALL_TABS = [...TABS, { id: 'pintar', title: 'Cubos' }, { id: 'foto', title: 'Foto' }, { id: 'glb', title: 'GLB' }, { id: 'exportar', title: 'Exportar' }];
const panes = {};

function buildUI() {
  const tabs = $('#tabs'), body = $('#tabbody');
  for (const t of ALL_TABS) {
    const b = el('button', { textContent: t.title, role: 'tab', id: 'tab_' + t.id });
    b.addEventListener('click', () => showTab(t.id));
    tabs.append(b);
    const pane = el('div', { role: 'tabpanel', hidden: true });
    pane.setAttribute('aria-labelledby', b.id);
    panes[t.id] = pane;
    body.append(pane);
    for (const g of t.groups || []) {
      const fs = el('fieldset', {}, el('legend', { textContent: g.title }));
      for (const c of g.controls) fs.append(control(c));
      pane.append(fs);
    }
  }
  buildMoldPane(); buildPaintPane(); buildPhotoPane(); buildGlbPane(); buildExportPane();
  showTab('molde');
}

function showTab(id) {
  state.tab = id;
  for (const t of ALL_TABS) {
    panes[t.id].hidden = t.id !== id;
    $('#tab_' + t.id).setAttribute('aria-selected', t.id === id);
  }
  if (id !== 'pintar' && state.tool !== 'orbit') setTool('orbit');
  if (id === 'pintar' && morph.target === 1) toggleMorph();
}

function buildMoldPane() {
  const wrap = el('div', { className: 'molds' });
  for (const [id, m] of Object.entries(MOLDS)) {
    const full = moldParams(id);
    const dots = el('div', { className: 'dots' });
    for (const k of ['cBack', 'cBack2', 'cBelly', 'cFlank', 'cLine', 'cSpot', 'cIris']) dots.append(el('i', { style: `background:${full[k]}` }));
    const b = el('button', { className: 'mold' }, el('strong', { textContent: m.label }), el('span', { textContent: m.blurb }), dots);
    b.dataset.mold = id;
    b.addEventListener('click', () => applyMold(id));
    wrap.append(b);
  }
  const vary = el('button', { className: 'btn sec', textContent: 'Variar patrón (nueva semilla)' });
  vary.addEventListener('click', () => { state.p.seed = 1 + Math.floor(Math.random() * 998); syncInputs(); scheduleRebuild(); });
  panes.molde.append(wrap, el('div', { className: 'btnrow' }, vary),
    el('p', { className: 'hint', textContent: 'Un molde es solo el punto de partida: todas sus medidas, rasgos y colores se editan en las demás pestañas, y cada cubo se puede pintar, añadir o quitar a mano.' }));
  markMold();
}
function markMold() { for (const b of document.querySelectorAll('.mold')) b.setAttribute('aria-pressed', b.dataset.mold === state.mold); }

function applyMold(id) {
  pushHistory();
  state.mold = id;
  state.p = moldParams(id, state.p);
  state.overrides = new Map();
  syncInputs(); markMold(); scheduleRebuild();
}

// ---- pestaña de cubos (edición manual)
const toolButtons = {};
function setTool(t) {
  if (t !== 'orbit' && morph.target === 1) toggleMorph();
  state.tool = t;
  for (const [k, b] of Object.entries(toolButtons)) b.setAttribute('aria-pressed', k === t);
  controls.mouseButtons.LEFT = t === 'orbit' ? THREE.MOUSE.ROTATE : -1;
  controls.touches.ONE = t === 'orbit' ? THREE.TOUCH.ROTATE : -1;
  renderer.domElement.style.cursor = t === 'orbit' ? 'grab' : 'crosshair';
  hover.visible = false; dirty = true;
}

let pickInfo;
function buildPaintPane() {
  const tools = el('div', { className: 'tools' });
  for (const [k, l] of [['orbit', 'Mover'], ['paint', 'Pintar'], ['add', 'Añadir'], ['erase', 'Quitar'], ['pick', 'Gotero']]) {
    const b = el('button', { textContent: l });
    b.addEventListener('click', () => setTool(k));
    toolButtons[k] = b; tools.append(b);
  }
  const colorInp = el('input', { type: 'color', id: 'paintColor', value: state.color });
  colorInp.addEventListener('input', () => { state.color = colorInp.value; });
  const brushOut = el('output', { textContent: state.brush });
  const brush = el('input', { type: 'range', id: 'brush', min: 1, max: 4, step: 1, value: state.brush });
  brush.addEventListener('input', () => { state.brush = +brush.value; brushOut.textContent = brush.value; });
  const sym = el('input', { type: 'checkbox', id: 'sym', checked: state.sym });
  sym.addEventListener('change', () => { state.sym = sym.checked; });
  const undo = el('button', { className: 'btn sec', textContent: 'Deshacer' });
  const redo = el('button', { className: 'btn sec', textContent: 'Rehacer' });
  const clear = el('button', { className: 'btn sec', textContent: 'Borrar ediciones' });
  undo.addEventListener('click', doUndo); redo.addEventListener('click', doRedo);
  clear.addEventListener('click', () => { if (!state.overrides.size) return; pushHistory(); state.overrides = new Map(); scheduleRebuild(); });
  pickInfo = el('p', { className: 'hint', textContent: 'Gotero: toca un cubo para copiar su color y ver a qué parte pertenece.' });
  panes.pintar.append(
    el('fieldset', {}, el('legend', { textContent: 'Herramienta' }), tools,
      el('div', { className: 'row inline' }, el('label', { htmlFor: 'paintColor', textContent: 'Color' }), colorInp),
      el('div', { className: 'row' }, el('label', { htmlFor: 'brush', textContent: 'Tamaño de pincel' }), brushOut, brush),
      el('div', { className: 'check' }, el('label', { htmlFor: 'sym', textContent: 'Simetría izquierda/derecha' }), sym),
      el('div', { className: 'btnrow' }, undo, redo, clear), pickInfo),
    el('p', { className: 'hint', textContent: 'Con una herramienta activa: botón derecho gira, rueda acerca. Ctrl+Z deshace. Las ediciones se guardan por posición de cubo: si cambias la resolución o las proporciones pueden quedar desplazadas. Lo que pintes no puede romper el QR: sus colores se limitan solos y la lectura se vuelve a comprobar.' }));
  setTool('orbit');
}

// ---- pestaña de foto
let swatchBox, photoStatus;
function buildPhotoPane() {
  const file = el('input', { type: 'file', accept: 'image/*', id: 'photoFile' });
  photoStatus = el('p', { className: 'hint', textContent: 'Sube una foto de la rana vista desde arriba (cabeza hacia arriba, fondo liso si es posible). La foto se procesa en tu equipo; no se sube a ningún servidor.' });
  swatchBox = el('div', { className: 'swatches' });
  const assign = el('select', { id: 'assignKey' });
  for (const [k, l] of PALETTE_KEYS) assign.append(el('option', { value: k, textContent: l }));
  file.addEventListener('change', async () => {
    try {
      state.photo = await loadPhoto(file.files[0]);
      state.photo.sil = analyzeSilhouette(state.photo);
      state.photoPalette = extractPalette(state.photo, 12, state.photo.sil.mask);
      if (photoPlane.material.map) photoPlane.material.map.dispose();
      photoPlane.material.map = new THREE.CanvasTexture(state.photo.canvas);
      photoPlane.material.map.colorSpace = THREE.SRGBColorSpace;
      photoPlane.material.needsUpdate = true;
      renderSwatches(assign);
      photoStatus.textContent = state.photo.sil.ok
        ? `Silueta detectada (${Math.round(state.photo.sil.cover * 100)}% de la imagen).`
        : 'No se pudo separar la rana del fondo; usa los ajustes manuales.';
      for (const b of needPhoto) b.disabled = false;
      scheduleRebuild();
    } catch (e) { toast(e.message); }
  });
  const needPhoto = [];
  const mk = (txt, fn, cls = 'btn sec') => { const b = el('button', { className: cls, textContent: txt, disabled: true }); b.addEventListener('click', fn); needPhoto.push(b); return b; };
  const bShape = mk('1 · Ajustar forma a la silueta', fitShape, 'btn');
  const bPal = mk('2 · Usar su paleta', () => { Object.assign(state.p, autoAssign(state.photoPalette.slice(0, 6))); syncInputs(); scheduleRebuild(); }, 'btn');
  const bCol = mk('3 · Reconstruir patrón en cubos', () => { fitTransform(); setT('mix', 1); scheduleRebuild(); }, 'btn');

  const sliders = el('fieldset', {}, el('legend', { textContent: 'Ajuste fino' }));
  const tIn = {};
  const setT = (k, v) => { state.photoT[k] = v; tIn[k]?.(v); updatePhotoPlane(); };
  for (const [k, l, mn, mx, st] of [['mix', 'Patrón de la foto en los cubos', 0, 1, 0.01], ['quant', 'Colores del patrón', 2, 12, 1],
    ['scale', 'Escala', 0.3, 3, 0.01], ['offX', 'Desplazar X', -1, 1, 0.005], ['offZ', 'Desplazar Z', -1, 1, 0.005], ['opacity', 'Ver foto encima (calcar)', 0, 1, 0.01]]) {
    const out = el('output', { textContent: state.photoT[k] });
    const inp = el('input', { type: 'range', id: 'ph_' + k, min: mn, max: mx, step: st, value: state.photoT[k] });
    inp.addEventListener('input', () => { state.photoT[k] = parseFloat(inp.value); out.textContent = inp.value; updatePhotoPlane(); if (k !== 'opacity') scheduleRebuild(); else dirty = true; });
    tIn[k] = (v) => { inp.value = v; out.textContent = Math.round(v * 1000) / 1000; };
    sliders.append(el('div', { className: 'row' }, el('label', { htmlFor: 'ph_' + k, textContent: l }), out, inp));
  }
  buildPhotoPane.setT = setT;
  panes.foto.append(
    el('fieldset', {}, el('legend', { textContent: 'Rana real' }), file, photoStatus, el('div', { className: 'btnrow' }, bShape, bPal, bCol)),
    el('fieldset', {}, el('legend', { textContent: 'Colores detectados' }),
      el('div', { className: 'row full' }, el('label', { htmlFor: 'assignKey', textContent: 'Al tocar un color, asignarlo a' }), assign), swatchBox),
    sliders,
    el('p', { className: 'hint', textContent: 'La foto nunca se pega como textura: se analiza su silueta para ajustar el volumen y cada cubo recibe un único color de una paleta reducida. Después puedes corregir cubo a cubo.' }));
}

function renderSwatches(assign) {
  swatchBox.replaceChildren();
  for (const c of state.photoPalette) {
    const hexc = toHex(c.rgb);
    const b = el('button', { title: hexc, style: `background:${hexc}` });
    b.setAttribute('aria-label', 'Color ' + hexc);
    b.addEventListener('click', () => { state.p[assign.value] = hexc; syncInputs(); scheduleRebuild(); });
    swatchBox.append(b);
  }
}

function fitTransform() {
  const sil = state.photo?.sil;
  if (!sil || !sil.ok) return;
  const setT = buildPhotoPane.setT;
  // el tramo hocico-cloaca de la foto (bodyH de su alto) debe cubrir los L cubos del cuerpo
  setT('scale', Math.min(3, Math.max(0.3, 1 / (sil.bodyH * 1.8))));
  setT('offZ', Math.max(-1, Math.min(1, 2 * (sil.bodyCy - 0.5))));
  setT('offX', Math.max(-1, Math.min(1, 2 * (sil.cx - 0.5))));
}

function fitShape() {
  const sil = state.photo?.sil;
  if (!sil || !sil.ok) { toast('No hay silueta fiable en la foto'); return; }
  pushHistory();
  const p = state.p, cl = (v, a, b) => Math.min(b, Math.max(a, v));
  p.bodyW = cl(sil.trunkRel / 2, 0.12, 0.32); // semiancho del tronco / LHC
  p.headW = cl(sil.headRel, 0.7, 1.25);
  p.taper = cl(sil.waistRel * 1.2, 0.6, 1.25);
  p.snout = cl(1.15 - sil.snoutRel * 1.3, 0, 1);
  syncInputs(); fitTransform(); scheduleRebuild();
  toast('Proporciones ajustadas a la silueta. Revisa patas, ojos y altura a mano: una foto cenital no las muestra.');
}

function updatePhotoPlane() {
  const ph = state.photo, t = state.photoT;
  photoPlane.visible = !!ph && t.opacity > 0.01 && !!model && morph.target === 0;
  if (!photoPlane.visible) return;
  const spanZ = model.L * t.scale * 1.8, spanX = spanZ * ph.aspect;
  photoPlane.scale.set(spanX, spanZ, 1);
  photoPlane.position.set(-t.offX * 0.5 * spanX, model.height + 2, -t.offZ * 0.5 * spanZ);
  photoPlane.material.opacity = t.opacity;
  dirty = true;
}

// ---- pestaña GLB -> cubos
function buildGlbPane() {
  const file = el('input', { type: 'file', accept: '.glb,model/gltf-binary', id: 'glbFile' });
  const status = el('p', { className: 'hint', textContent: 'Sube un .glb (por ejemplo una rana escaneada o modelada). Se reconstruye como cubos que conservan su color; luego se convierte en QR igual que los moldes. El archivo se procesa en tu equipo.' });
  const back = el('button', { className: 'btn sec', textContent: 'Volver al molde', disabled: true });
  const fs = el('fieldset', {}, el('legend', { textContent: 'Modelo 3D' }), file, status, el('div', { className: 'btnrow' }, back));
  const sl = el('fieldset', {}, el('legend', { textContent: 'Ajustes' }));
  const mk = (k, label, mn, mx, st) => {
    const out = el('output', { textContent: state.glbT[k] });
    const inp = el('input', { type: 'range', id: 'glb_' + k, min: mn, max: mx, step: st, value: state.glbT[k] });
    inp.addEventListener('input', () => { state.glbT[k] = parseFloat(inp.value); out.textContent = inp.value; if (state.glb) scheduleRebuild(); });
    sl.append(el('div', { className: 'row' }, el('label', { htmlFor: 'glb_' + k, textContent: label }), out, inp));
  };
  mk('rotY', 'Girar (vertical, °)', -180, 180, 5); mk('rotX', 'Inclinar (°)', -90, 90, 5); mk('colors', 'Niveles de color por canal (0 = todos)', 0, 16, 1);
  sl.append(el('p', { className: 'hint', textContent: 'La resolución se controla en la pestaña Cuerpo (cubos a lo largo). Menos niveles de color dan un aspecto más de bloques de Minecraft.' }));
  file.addEventListener('change', async () => {
    try {
      status.textContent = 'Leyendo modelo…';
      state.glb = await loadGLB(file.files[0]);
      back.disabled = false;
      status.textContent = `${state.glb.name} · ${state.glb.tris.toLocaleString('es')} triángulos reconstruidos en cubos.`;
      pushHistory(); state.overrides = new Map(); state.mold = ''; markMold(); scheduleRebuild();
    } catch (e) { state.glb = null; status.textContent = e.message; toast(e.message); }
    file.value = '';
  });
  back.addEventListener('click', () => { state.glb = null; back.disabled = true; status.textContent = 'Molde procedural activo.'; pushHistory(); state.overrides = new Map(); scheduleRebuild(); });
  panes.glb.append(fs, sl);
}

// ---- pestaña de exportación
function buildExportPane() {
  const b = (txt, fn, cls = 'btn') => { const x = el('button', { className: cls, textContent: txt }); x.addEventListener('click', fn); return x; };
  const fileIn = el('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileIn.addEventListener('change', async () => {
    try {
      const f = fileIn.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) throw new Error('Archivo demasiado grande');
      const d = deserialize(await f.text());
      pushHistory();
      state.p = d.params; state.overrides = d.overrides;
      state.mold = ''; syncInputs(); markMold(); scheduleRebuild(); toast('Proyecto cargado');
    } catch (e) { toast(e.message); }
    fileIn.value = '';
  });
  panes.exportar.append(
    buildPublishFieldset(b),
    el('fieldset', {}, el('legend', { textContent: 'Imagen' }),
      el('div', { className: 'btnrow' },
        b('PNG del QR (para imprimir o escanear)', () => rasterQR(qrState, qrCols, Math.max(4, Math.ceil(1200 / qrState.side)), 0).toBlob((bl) => download(bl, 'rana-qr-codigo.png'))),
        b('PNG de la vista 3D', () => { renderer.render(scene, camera); download(renderer.domElement.toDataURL('image/png'), 'rana-qr-3d.png'); }, 'btn sec'))),
    el('fieldset', {}, el('legend', { textContent: 'Modelo 3D' }),
      el('div', { className: 'btnrow' }, b('GLB (cubos con color)', exportGLB), b('VOX (MagicaVoxel)', () => { try { download(toVox(model), 'rana-qr.vox'); } catch (e) { toast(e.message); } }, 'btn sec')),
      el('p', { className: 'hint', textContent: 'GLB sirve para visores, web y Blender; VOX es el formato nativo de cubos (MagicaVoxel y otros editores voxel) con paleta de 255 colores. Solo se exportan las caras visibles. 1 cubo = 1 cm.' })),
    el('fieldset', {}, el('legend', { textContent: 'Proyecto' }),
      el('div', { className: 'btnrow' },
        b('Guardar proyecto (.json)', () => download(new Blob([serialize(state.p, state.overrides)], { type: 'application/json' }), 'rana-qr.json')),
        b('Abrir proyecto', () => fileIn.click(), 'btn sec')), fileIn));
}

// datos compactos de la figura y su QR para la página publicable
function buildEntry(label) {
  const mesh = meshes.op, n = mesh.count, g = mesh.geometry;
  const mx = mesh.instanceMatrix.array, ic = mesh.instanceColor.array, aq = g.attributes.aQr.array, ac = g.attributes.aQrCol.array, am = g.attributes.aMisc.array;
  const frog = new Int16Array(n * 3), frogRgb = new Uint8Array(n * 3), qr3 = new Int16Array(n * 3), qrRgb = new Uint8Array(n * 3), rnd = new Uint8Array(n), flags = new Uint8Array(n);
  const c = new THREE.Color(), o = { r: 0, g: 0, b: 0 };
  const byte = (x) => Math.max(0, Math.min(255, Math.round(x * 255)));
  for (let v = 0; v < n; v++) {
    for (let a = 0; a < 3; a++) { frog[v * 3 + a] = Math.round(mx[v * 16 + 12 + a] - 0.5); qr3[v * 3 + a] = Math.round(aq[v * 3 + a] * 2); }
    c.fromArray(ic, v * 3).getRGB(o, THREE.SRGBColorSpace); frogRgb[v * 3] = byte(o.r); frogRgb[v * 3 + 1] = byte(o.g); frogRgb[v * 3 + 2] = byte(o.b);
    c.fromArray(ac, v * 3).getRGB(o, THREE.SRGBColorSpace); qrRgb[v * 3] = byte(o.r); qrRgb[v * 3 + 1] = byte(o.g); qrRgb[v * 3 + 2] = byte(o.b);
    rnd[v] = byte(am[v * 3]); flags[v] = (am[v * 3 + 1] ? 1 : 0) | (am[v * 3 + 2] ? 2 : 0);
  }
  return makeEntry({ label, text: state.p.text, L: model.L, H: model.height, side: qrState.side, frog, frogRgb, qr: qr3, qrRgb, rnd, flags });
}

// ---- publicar en el sitio (base de datos, sin token): devuelve el enlace final /v/<id>
function buildPublishFieldset(b) {
  const labelIn = el('input', { type: 'text', id: 'pubLabel', maxLength: 60, placeholder: 'Nombre del QR (p. ej. Sapo)' });
  const status = el('p', { className: 'hint', textContent: 'Guarda el modelo actual en la base de datos del sitio y te da el enlace final. El texto del QR (pestaña QR) debe ser el enlace al que quieres llevar.' });
  const list = el('div', { className: 'plist' });
  const say = (t) => { status.textContent = t; };
  const refresh = () => {
    list.replaceChildren();
    const mios = leerMios();
    if (!mios.length) list.append(el('p', { className: 'hint', textContent: 'Aún no has guardado ninguno desde este navegador.' }));
    mios.forEach((it) => {
      const row = el('div', { className: 'prow' });
      const del = el('button', { className: 'btn sec', textContent: '✕', title: 'Eliminar' });
      del.addEventListener('click', async () => {
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '¿Seguro?'; setTimeout(() => { del.dataset.sure = ''; del.textContent = '✕'; }, 3000); return; }
        try { await borrarQR(it.id); refresh(); say(`«${it.label}» eliminado`); } catch (e) { say(e.message); }
      });
      row.append(el('a', { href: '/v/' + it.id, target: '_blank', rel: 'noopener', textContent: it.label }), del);
      list.append(row);
    });
  };
  const save = b('Guardar en el sitio', async () => {
    try {
      if (morph.target === 1) toggleMorph();
      const label = (labelIn.value.trim() || (state.glb ? state.glb.name.replace(/\.glb$/i, '') : MOLDS[state.mold]?.label) || 'Modelo').slice(0, 60);
      const entry = { ...buildEntry(label), id: nuevoId() };
      say('Guardando…');
      const { url } = await guardarQR(entry);
      say(`«${label}» guardado. Enlace final: ${url}`);
      labelIn.value = ''; refresh();
    } catch (e) { say(e.message); toast(e.message); }
  });
  refresh();
  return el('fieldset', {}, el('legend', { textContent: 'Publicar en el sitio' }),
    el('div', { className: 'row full' }, el('label', { htmlFor: 'pubLabel', textContent: 'Nombre del QR' }), labelIn),
    el('div', { className: 'btnrow' }, save, el('a', { className: 'btn sec', href: '/', target: '_blank', rel: 'noopener', textContent: 'Ir a crear' })), status,
    el('div', { className: 'row full' }, el('label', { textContent: 'Mis QR (este navegador)' })), list);
}

function parseGLB(root) {
  root.scale.setScalar(0.01);
  return new Promise((res, rej) => new GLTFExporter().parse(root, (buf) => {
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    res(new Blob([buf], { type: 'model/gltf-binary' }));
  }, rej, { binary: true }));
}

// rana en cubos (solo caras visibles, color por vértice)
function buildFrogGLB() {
  const g = model.grid;
  const solid = (i, j, k) => { const v = g.get(i, j, k); return v !== 0 && v !== R.GLASS; };
  const any = (i, j, k) => g.get(i, j, k) !== 0;
  const root = new THREE.Group();
  root.add(new THREE.Mesh(mergedGeometry(model, model.opI, model.opC, solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  if (model.glI.length) {
    root.add(new THREE.Mesh(mergedGeometry(model, model.glI, model.glC, any), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.42, roughness: 0.3 })));
  }
  return parseGLB(root);
}

// los mismos cubos ya colocados como QR
function buildQRGLB() {
  const n = qrState.n, idx = new Int16Array(n * 3), keys = new Set();
  for (let v = 0; v < n; v++) {
    for (let a = 0; a < 3; a++) idx[v * 3 + a] = Math.floor(qrState.pos[v * 3 + a]);
    keys.add(voxKey(idx[v * 3], idx[v * 3 + 1], idx[v * 3 + 2]));
  }
  const root = new THREE.Group();
  root.add(new THREE.Mesh(mergedGeometry(model, idx, qrCols, (i, j, k) => keys.has(voxKey(i, j, k))), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  return parseGLB(root);
}

async function exportGLB() {
  try { download(await buildFrogGLB(), 'rana-qr.glb'); } catch (e) { toast('Error al exportar: ' + (e.message || e)); }
}

// ------------------------------------------------------------------ edición de cubos
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function pickVoxel(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects([meshes.op, meshes.gl].filter((m) => m && m.visible), false);
  for (const h of hits) {
    const ud = h.object.userData;
    if (h.instanceId >= ud.real) continue; // instancias de relleno del QR: no son cubos de la rana
    const v = (ud.order ? ud.order[h.instanceId] : h.instanceId) * 3, n = h.face.normal;
    return { i: ud.idx[v], j: ud.idx[v + 1], k: ud.idx[v + 2], n: [Math.round(n.x), Math.round(n.y), Math.round(n.z)], instanceId: h.instanceId, mesh: h.object };
  }
  return null;
}

function applyTool(hit) {
  const t = state.tool, g = model.grid;
  let ci = hit.i, cj = hit.j, ck = hit.k;
  if (t === 'add') { ci += hit.n[0]; cj += hit.n[1]; ck += hit.n[2]; }
  const rad = state.brush - 1;
  let changed = false;
  for (let di = -rad; di <= rad; di++) for (let dj = -rad; dj <= rad; dj++) for (let dk = -rad; dk <= rad; dk++) {
    const cells = [[ci + di, cj + dj, ck + dk]];
    if (state.sym) cells.push([-1 - (ci + di), cj + dj, ck + dk]);
    for (const [i, j, k] of cells) {
      if (!g.inb(i, j, k)) continue;
      const cur = g.get(i, j, k);
      if (t === 'add' ? cur !== 0 : cur === 0) continue;
      const key = voxKey(i, j, k), val = t === 'erase' ? 0 : state.color;
      if (state.overrides.get(key) !== val) { state.overrides.set(key, val); changed = true; }
    }
  }
  if (changed) scheduleRebuild();
}

function pushHistory() {
  state.history.push({ p: { ...state.p }, o: new Map(state.overrides), mold: state.mold });
  if (state.history.length > 60) state.history.shift();
  state.future.length = 0;
}
function restore(s) { state.p = { ...s.p }; state.overrides = new Map(s.o); state.mold = s.mold; syncInputs(); markMold(); scheduleRebuild(); }
function doUndo() { const s = state.history.pop(); if (!s) return; state.future.push({ p: { ...state.p }, o: new Map(state.overrides), mold: state.mold }); restore(s); }
function doRedo() { const s = state.future.pop(); if (!s) return; state.history.push({ p: { ...state.p }, o: new Map(state.overrides), mold: state.mold }); restore(s); }

let stroking = false, moveQueued = false, lastEv = null;
const cv = renderer.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (ev) => {
  if (state.tool === 'orbit' || ev.button !== 0 || !model) return;
  const hit = pickVoxel(ev);
  if (!hit) return;
  if (state.tool === 'pick') {
    hit.mesh.getColorAt(hit.instanceId, _c);
    state.color = '#' + _c.getHexString(THREE.SRGBColorSpace);
    $('#paintColor').value = state.color;
    pickInfo.textContent = `Cubo (${hit.i}, ${hit.j}, ${hit.k}) · parte: ${PART_NAMES[model.grid.get(hit.i, hit.j, hit.k)] || '—'} · color ${state.color}`;
    return;
  }
  pushHistory();
  stroking = true;
  cv.setPointerCapture(ev.pointerId);
  applyTool(hit);
});
cv.addEventListener('pointermove', (ev) => {
  if (state.tool === 'orbit' || !model) return;
  lastEv = ev;
  if (moveQueued) return;
  moveQueued = true;
  requestAnimationFrame(() => {
    moveQueued = false;
    const hit = pickVoxel(lastEv);
    hover.visible = !!hit;
    if (hit) {
      const a = state.tool === 'add' ? hit.n : [0, 0, 0];
      hover.position.set(hit.i + a[0] + 0.5, hit.j + a[1] + 0.5, hit.k + a[2] + 0.5);
      if (stroking && state.tool !== 'add') applyTool(hit);
    }
    dirty = true;
  });
});
const endStroke = () => { stroking = false; };
// clic (sin arrastrar) sobre la rana: se convierte en QR; clic sobre el QR: vuelve a ser rana
let downAt = null;
cv.addEventListener('pointerdown', (ev) => { downAt = state.tool === 'orbit' && ev.button === 0 ? [ev.clientX, ev.clientY] : null; }, true);
cv.addEventListener('pointerup', (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5 || morph.value !== morph.target) return;
  if (morph.target === 1 || pickVoxel(ev)) toggleMorph();
});
cv.addEventListener('pointerup', endStroke);
cv.addEventListener('pointercancel', endStroke);
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
});

// ------------------------------------------------------------------ varios
let currentView = 'iso';
for (const b of document.querySelectorAll('#views [data-view]')) b.addEventListener('click', () => { currentView = b.dataset.view; setView(currentView); });
$('#morph').addEventListener('click', toggleMorph);
$('#spin').addEventListener('click', (e) => { spinning = !spinning; e.currentTarget.setAttribute('aria-pressed', spinning); });

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
}

const LS_KEY = 'rana-qr:proyecto';
let saveTimer = 0;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, serialize(state.p, state.overrides)); } catch { /* sin almacenamiento */ } }, 600);
}
try {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) { const d = deserialize(saved); state.p = d.params; state.overrides = d.overrides; state.mold = ''; }
} catch { /* proyecto guardado ilegible: se ignora */ }

// cargar un GLB: arrastrándolo al visor o con ?glb=ruta/relativa.glb (mismo origen)
async function useGLBFile(file) {
  try {
    state.glb = await loadGLB(file);
    pushHistory(); state.overrides = new Map(); state.mold = ''; markMold();
    $('#tab_glb') && showTab('glb');
    scheduleRebuild();
    toast(`${state.glb.name}: ${state.glb.tris.toLocaleString('es')} triángulos convertidos en cubos`);
  } catch (e) { state.glb = null; toast(e.message); }
}
viewport.addEventListener('dragover', (e) => e.preventDefault());
viewport.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) useGLBFile(f); });
const glbParam = new URLSearchParams(location.search).get('glb');
if (glbParam && /^[\w./-]+\.glb$/i.test(glbParam) && !glbParam.includes('..')) {
  fetch(glbParam).then((r) => (r.ok ? r.blob() : Promise.reject(new Error('No se encontró ' + glbParam))))
    .then((b) => useGLBFile(new File([b], glbParam.split('/').pop()))).catch((e) => toast(e.message));
}

renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); toast('Se perdió el contexto gráfico; recarga la página si no vuelve.'); });
renderer.domElement.addEventListener('webglcontextrestored', () => { dirty = true; });

buildUI();
rebuild();
if (new URLSearchParams(location.search).has('debug')) window.__rana = { state, get model() { return model; }, get scan() { return scan; }, get qrState() { return qrState; }, rebuild, setView, applyMold, toggleMorph, morph, camera, controls, U, renderer, snap: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); } };

// ------------------------------------------------------------------ automatización (cubizar.mjs)
// Con ?auto la página expone ranaAuto.run(): procesa un modelo de principio a fin y devuelve los archivos en base64.
if (new URLSearchParams(location.search).has('auto')) {
  const b64 = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const snap = (pose, morphValue, w, h) => {
    renderer.setPixelRatio(1); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uMorph.value = morphValue;
    camera.position.copy(pose.pos); controls.target.copy(pose.tgt); camera.lookAt(pose.tgt);
    photoPlane.visible = false;
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    U.uMorph.value = 0;
    return url.split(',')[1];
  };
  window.ranaAuto = {
    async run(o) {
      const p = state.p;
      if (o.mold && MOLDS[o.mold]) { state.mold = o.mold; state.p = moldParams(o.mold, state.p); }
      const q = state.p;
      for (const k of ['text', 'ecc', 'res', 'quiet', 'minVersion', 'qrStyle', 'darkColor', 'lightColor', 'qrRelief']) if (o[k] !== undefined) q[k] = o[k];
      for (const k of ['rotY', 'rotX', 'colors']) if (o[k] !== undefined) state.glbT[k] = o[k];
      state.overrides = new Map();
      if (o.glbUrl) {
        const r = await fetch(o.glbUrl);
        if (!r.ok) throw new Error('No se pudo leer el modelo');
        state.glb = await loadGLB(new File([await r.blob()], o.name || 'modelo.glb'));
      } else state.glb = null;
      rebuild();
      if (!model || !qrState) throw new Error('No se pudo construir el modelo');
      const w = o.width || 1400, h = o.height || 900;
      const files = {};
      files.qr_png = rasterQR(qrState, qrCols, Math.max(6, Math.ceil(1400 / qrState.side)), 0).toDataURL('image/png').split(',')[1];
      files.vista_cubos_png = snap(viewPose('iso'), 0, w, h);
      const qp = qrPose(); qp.pos.z *= 0.8;
      files.vista_qr_png = snap(qp, 1, w, h);
      files.cubos_glb = await b64(await buildFrogGLB());
      files.qr_glb = await b64(await buildQRGLB());
      try { files.cubos_vox = await b64(toVox(model)); } catch (e) { files.vox_error = e.message; }
      files.entry = buildEntry(o.label || 'Modelo');
      files.proyecto_json = btoa(unescape(encodeURIComponent(serialize(state.p, state.overrides))));
      return {
        files,
        report: {
          modelo: state.glb ? state.glb.name : 'molde ' + state.mold,
          triangulos: state.glb ? state.glb.tris : null,
          cubosVisibles: model.count, cubosQR: qrState.n, largoEnCubos: model.L,
          qrVersion: qr.version, qrModulos: qr.size, cubosPorModulo: qrState.s,
          texto: state.p.text, qrLegible: scan.ok, nota: scan.note,
        },
      };
    },
  };
  window.ranaAutoReady = true;
}
