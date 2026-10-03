// Página de creación: modelo .glb → cubos → enlace → vista previa → guardar en la base de datos → enlace final.
import * as THREE from 'three';
import { loadGLB, voxelizeGLB } from '/admin/js/glb.js';
import { crearEntrada } from '/admin/js/entrada.js';
import { nuevoId, leerMios, guardarQR, borrarQR, configSitio } from '/admin/js/mios.js';

window.THREE = THREE; // el visor (visor.js) usa THREE global

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };

const ui = {
  glb: $('glb'), drop: $('drop'), dropTxt: $('dropTxt'), glbEstado: $('glbEstado'), ajustes: $('ajustes'),
  res: $('res'), rotY: $('rotY'), rotX: $('rotX'), cols: $('cols'),
  enlace: $('enlace'), enlaceErr: $('enlaceErr'), nombre: $('nombre'), claveCrear: $('claveCrear'), clave: $('clave'), guardar: $('guardar'), estado: $('estado'),
  listo: $('listo'), linkFinal: $('linkFinal'), abrirFinal: $('abrirFinal'), copiar: $('copiar'), otro: $('otro'),
  stage: $('stage'), vacio: $('vacio'), badge: $('badge'), datos: $('datos'), qrbtn: $('qrbtn'),
  lista: $('lista'), listaEstado: $('listaEstado'),
};

const st = { src: null, model: null, modelKey: '', entry: null, legible: false, enlace: null, nombreEditado: false, busy: false, seq: 0 };

// ---------------------------------------------------------------- enlace
function normalizarEnlace(raw) {
  let t = raw.trim();
  if (!t) return { ok: false, vacio: true };
  // «localhost:3000» o «sitio.com:8080/x» no llevan esquema; solo se respeta uno si va con // o es uno de los peligrosos conocidos (se rechaza abajo)
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t) && !/^(javascript|data|vbscript|mailto|tel|file|blob):/i.test(t)) t = (/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(t) ? 'http://' : 'https://') + t;
  let u;
  try { u = new URL(t); } catch { return { ok: false, msg: 'Ese enlace no es válido.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, msg: 'Solo se aceptan enlaces http o https.' };
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { ok: false, msg: 'Falta el dominio (por ejemplo tu-sitio.com).' };
  if (u.href.length > 1000) return { ok: false, msg: 'El enlace es demasiado largo.' };
  return { ok: true, url: u.href };
}

// ---------------------------------------------------------------- vista previa
const viewer = RanaViewer.create(ui.stage, {
  onActivate: (url) => { if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer'); },
  onState: (s) => { ui.qrbtn.textContent = s.qr ? 'Ver figura' : 'Ver QR'; },
});
ui.qrbtn.addEventListener('click', () => viewer.setQR(!viewer.qr));

function badge(texto, clase) { ui.badge.textContent = texto; ui.badge.className = 'badge ' + (clase || ''); }
function estado(t) { ui.estado.textContent = t; }

function actualizarGuardar() {
  const puede = !!(st.entry && st.legible && st.enlace && ui.nombre.value.trim() && !st.busy);
  ui.guardar.disabled = !puede;
  if (!st.src) estado('Carga un modelo y escribe el enlace para poder guardar.');
  else if (!st.enlace) estado('Escribe el enlace al que debe llevar el QR.');
  else if (st.entry && !st.legible) estado('Este QR no se puede leer con estos colores. Cambia el modelo o el estilo de bloque.');
  else if (!ui.nombre.value.trim()) estado('Ponle un nombre.');
  else estado('Todo listo para guardar.');
}

const pausa = () => new Promise((r) => setTimeout(r, 30)); // deja pintar «Procesando…»

async function procesar() {
  const mi = ++st.seq;
  if (!st.src) return;
  st.busy = true; badge('Procesando…', ''); actualizarGuardar();
  await pausa();
  try {
    const key = [ui.res.value, ui.rotY.value, ui.rotX.value, ui.cols.value].join('|');
    const modeloNuevo = key !== st.modelKey;
    if (modeloNuevo) {
      st.model = voxelizeGLB(st.src, +ui.res.value, { rotY: +ui.rotY.value, rotX: +ui.rotX.value, colors: +ui.cols.value });
      st.modelKey = key;
    }
    if (mi !== st.seq) return; // llegó un cambio más reciente
    const enlace = st.enlace || 'https://example.com'; // sin enlace aún: QR de ejemplo para ver la animación
    const r = crearEntrada(st.model, enlace, ui.nombre.value.trim() || 'Modelo');
    if (mi !== st.seq) return;
    st.entry = st.enlace ? r.entry : null;
    st.legible = r.legible;
    ui.vacio.hidden = true;
    viewer.load(r.entry, { intro: modeloNuevo });
    ui.qrbtn.hidden = false;
    ui.datos.textContent = `${r.cubos.toLocaleString('es')} cubos · QR v${r.version} (${r.modulos}×${r.modulos})` + (st.enlace ? '' : ' · QR de ejemplo');
    if (!r.legible) badge('QR no legible', 'bad');
    else if (r.nota) badge('QR legible ✓', 'warn'), ui.datos.textContent += ' · ' + r.nota;
    else badge('QR legible ✓', 'ok');
  } catch (e) {
    badge('Error', 'bad'); ui.datos.textContent = e.message; st.entry = null; st.legible = false;
  } finally {
    if (mi === st.seq) { st.busy = false; actualizarGuardar(); }
  }
}

let t = 0;
const programar = (ms = 350) => { clearTimeout(t); t = setTimeout(procesar, ms); };

// ---------------------------------------------------------------- paso 1: modelo
async function cargarArchivo(file) {
  try {
    ui.glbEstado.textContent = 'Leyendo el modelo…'; ui.glbEstado.classList.remove('err');
    st.src = null; st.entry = null; st.modelKey = ''; actualizarGuardar();
    st.src = await loadGLB(file);
    ui.dropTxt.textContent = file.name;
    ui.glbEstado.textContent = `${st.src.tris.toLocaleString('es')} triángulos → cubos.`;
    ui.ajustes.hidden = false;
    if (!st.nombreEditado) ui.nombre.value = file.name.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 60);
    ocultarListo();
    procesar();
  } catch (e) {
    st.src = null; ui.glbEstado.textContent = e.message; ui.glbEstado.classList.add('err'); badge('Sin modelo', '');
  }
}
ui.glb.addEventListener('change', () => { if (ui.glb.files[0]) cargarArchivo(ui.glb.files[0]); });
for (const ev of ['dragenter', 'dragover']) ui.drop.addEventListener(ev, (e) => { e.preventDefault(); ui.drop.classList.add('sobre'); });
for (const ev of ['dragleave', 'drop']) ui.drop.addEventListener(ev, () => ui.drop.classList.remove('sobre'));
ui.drop.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) cargarArchivo(f); });

const etiquetas = { rotY: (v) => v + '°', rotX: (v) => v + '°', res: (v) => v + ' cubos', cols: (v) => (+v === 0 ? 'Natural' : v + ' tonos') };
for (const k of ['res', 'rotY', 'rotX', 'cols']) {
  const o = $(k + 'O'); o.textContent = etiquetas[k](ui[k].value);
  ui[k].addEventListener('input', () => { o.textContent = etiquetas[k](ui[k].value); if (st.src) programar(450); });
}

// ---------------------------------------------------------------- paso 2: enlace y nombre
ui.enlace.addEventListener('input', () => {
  const r = normalizarEnlace(ui.enlace.value);
  st.enlace = r.ok ? r.url : null;
  ui.enlaceErr.hidden = r.ok || r.vacio; ui.enlaceErr.textContent = r.msg || '';
  ocultarListo();
  if (st.src) programar(500); else actualizarGuardar();
});
ui.nombre.addEventListener('input', () => { st.nombreEditado = true; actualizarGuardar(); });

// ---------------------------------------------------------------- paso 3: guardar (sin cuentas ni token)
let requiereClave = false;
configSitio().then((cfg) => {
  requiereClave = !!cfg.requiereClave; ui.claveCrear.hidden = !requiereClave;
  try { ui.clave.value = sessionStorage.getItem('rana-clave-crear') || ''; } catch { /* sin almacenamiento */ }
});

function ocultarListo() { ui.listo.hidden = true; }

ui.guardar.addEventListener('click', async () => {
  if (!st.entry || !st.legible) return;
  ui.guardar.disabled = true; estado('Guardando…');
  let mensaje = null;
  try {
    const entry = { ...st.entry, id: nuevoId(), label: ui.nombre.value.trim().slice(0, 60) };
    const claveCrear = ui.clave.value.trim();
    if (requiereClave) { try { sessionStorage.setItem('rana-clave-crear', claveCrear); } catch { /* sin almacenamiento */ } }
    const { url } = await guardarQR(entry, { claveCrear });
    ui.linkFinal.textContent = url; ui.linkFinal.href = url; ui.abrirFinal.href = url;
    ui.listo.hidden = false; mensaje = 'Guardado. Este es tu enlace final:';
    pintarMios();
  } catch (e) { mensaje = e.message; }
  actualizarGuardar();
  estado(mensaje); // el resultado de guardar prevalece sobre el texto de ayuda
});

ui.copiar.addEventListener('click', async () => {
  const url = ui.linkFinal.textContent;
  try { await navigator.clipboard.writeText(url); ui.copiar.textContent = 'Copiado ✓'; }
  catch { const r = document.createRange(); r.selectNodeContents(ui.linkFinal); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ui.copiar.textContent = 'Selecciónalo y copia'; }
  setTimeout(() => { ui.copiar.textContent = 'Copiar enlace'; }, 2200);
});
ui.otro.addEventListener('click', () => {
  ocultarListo(); st.src = null; st.entry = null; st.modelKey = ''; st.enlace = null; st.nombreEditado = false;
  ui.glb.value = ''; ui.dropTxt.innerHTML = 'Elige un archivo <b>.glb</b> o arrástralo aquí'; ui.enlace.value = ''; ui.nombre.value = '';
  ui.ajustes.hidden = true; ui.vacio.hidden = false; ui.qrbtn.hidden = true; badge('Sin modelo', ''); ui.datos.textContent = '';
  ui.glbEstado.textContent = 'Se convierte en cubos en tu navegador; el archivo no se sube a ningún servidor.'; actualizarGuardar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------------------------------------------------------------- mis QR (guardados desde este navegador)
function pintarMios() {
  const mios = leerMios();
  ui.lista.replaceChildren();
  ui.listaEstado.textContent = mios.length ? `${mios.length} guardado${mios.length === 1 ? '' : 's'} desde este navegador.` : 'Aún no has guardado ninguno desde este navegador.';
  for (const it of mios) {
    const url = `${location.origin}/v/${it.id}`;
    const li = el('li');
    li.append(el('div', { className: 't' }, el('b', { textContent: it.label }), el('span', { textContent: `Lleva a: ${it.text}` })));
    const acc = el('div', { className: 'acc' });
    acc.append(el('a', { className: 'boton sec', href: url, target: '_blank', rel: 'noopener', textContent: 'Abrir' }));
    const cp = el('button', { type: 'button', className: 'sec', textContent: 'Copiar' });
    cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); cp.textContent = 'Copiado ✓'; } catch { cp.textContent = 'Cópialo a mano'; } setTimeout(() => { cp.textContent = 'Copiar'; }, 2000); });
    const del = el('button', { type: 'button', className: 'sec', textContent: 'Eliminar' });
    del.addEventListener('click', async () => {
      if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '¿Seguro?'; setTimeout(() => { del.dataset.sure = ''; del.textContent = 'Eliminar'; }, 3000); return; }
      try { await borrarQR(it.id); pintarMios(); } catch (e) { ui.listaEstado.textContent = e.message; }
    });
    acc.append(cp, del);
    li.append(acc); ui.lista.append(li);
  }
}
pintarMios();

actualizarGuardar();
if (new URLSearchParams(location.search).has('debug')) window.__crear = { st, viewer, ui, procesar };
