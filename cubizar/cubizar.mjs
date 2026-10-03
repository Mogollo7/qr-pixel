#!/usr/bin/env node
// cubizar — procesa modelos GLB de forma automática: los convierte en cubos y genera su QR.
// Usa la misma app (rana-qr) dentro de un Chrome/Edge sin ventana, así el resultado es idéntico al de la interfaz.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..', 'rana-qr');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary' };

const AYUDA = `cubizar — modelo.glb → cubos + QR

Uso:
  node cubizar.mjs <modelo.glb | carpeta> [opciones]
  node cubizar.mjs --mold rhinella --text "https://..."     (sin GLB: usa un molde)
  node cubizar.mjs --probar                                 (autoprueba con un modelo generado)

Opciones:
  --text <enlace>       Enlace al que llevará el QR (por defecto https://example.com)
  --res <n>             Cubos a lo largo del modelo, 16–128 (por defecto 64)
  --out <carpeta>       Carpeta de salida (por defecto ./salida)
  --rotY <grados>       Girar el modelo (vertical)         --rotX <grados>  Inclinarlo
  --colors <n>          Niveles de color por canal (0 = todos; menos = más Minecraft)
  --ecc <L|M|Q|H>       Corrección de errores del QR (por defecto M)
  --quiet <2-4>         Margen claro en módulos            --min-version <1-10>
  --qr-style <tint|custom>   Colores de la rana oscurecidos, o dos colores
  --dark <#hex> --light <#hex>   Colores del QR en modo custom
  --mold <minecraft|rhinella|pristimantis|glass|atelopus>   Molde si no hay GLB
  --chrome <ruta>       Navegador a usar (si no se detecta solo)
  --titulo <texto>      Texto del enlace en la barra de la página (un solo modelo)
  --subir <url>         Guarda cada modelo en el sitio (base de datos) y muestra su enlace final /v/<id>. Ej.: http://localhost:8080
  --manifiesto <json>   Lista [{ "archivo": "rana.glb", "titulo": "…", "texto": "…" }] para títulos y textos por modelo
  --estricto            Termina con error si algún QR no se lee

Genera por cada modelo: <nombre>_qr.png, <nombre>_cubos.glb, <nombre>_qr.glb, <nombre>_cubos.vox,
<nombre>_vista_cubos.png, <nombre>_vista_qr.png, <nombre>_proyecto.json y <nombre>_informe.json.
Con --subir cada modelo se guarda además en la base de datos del sitio.`;

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (['probar', 'estricto', 'help', 'ayuda'].includes(k)) o[k] = true;
    else { if (i + 1 >= argv.length) fail(`Falta el valor de ${a}`); o[k] = argv[++i]; }
  }
  return o;
}
function fail(msg) { console.error('✘ ' + msg); process.exit(2); }

const num = (v, name, lo, hi) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) fail(`${name} debe estar entre ${lo} y ${hi}`);
  return n;
};
const color = (v, name) => { if (v === undefined) return undefined; if (!/^#[0-9a-fA-F]{6}$/.test(v)) fail(`${name} debe ser #rrggbb`); return v; };
const safeName = (s) => s.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'modelo';

function findBrowser(explicit) {
  const c = [explicit, process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) fail('No encontré Chrome ni Edge. Indica uno con --chrome <ruta>');
  return hit;
}

// servidor local solo en 127.0.0.1: sirve la app y, con un token aleatorio, un único modelo
function startServer(modelPaths) {
  const token = crypto.randomBytes(8).toString('hex');
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file;
    const m = url.pathname.match(/^\/__in\/([0-9a-f]{16})\/(\d+)\.glb$/);
    if (m) file = m[1] === token ? modelPaths[Number(m[2])] : null;
    else {
      const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html';
      const abs = path.resolve(APP, rel === '.' ? 'index.html' : rel);
      file = abs.startsWith(APP + path.sep) || abs === path.join(APP, 'index.html') ? abs : null;
    }
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, token })));
}

function collect(inputs) {
  const out = [];
  for (const p of inputs) {
    if (!fs.existsSync(p)) fail(`No existe: ${p}`);
    if (fs.statSync(p).isDirectory()) out.push(...fs.readdirSync(p).filter((f) => /\.glb$/i.test(f)).sort().map((f) => path.join(p, f)));
    else if (/\.glb$/i.test(p)) out.push(p);
    else fail(`Solo se aceptan archivos .glb: ${p}`);
  }
  return out;
}

// modelo de prueba: esfera con textura y una caja con color de material (para --probar)
async function makeTestModel(page, dest) {
  const b64 = await page.evaluate(async () => {
    const T = await import('three');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#d02020'; x.fillRect(0, 0, 32, 64); x.fillStyle = '#2060d0'; x.fillRect(32, 0, 32, 64);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const root = new T.Group();
    root.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshStandardMaterial({ map: tex })));
    const box = new T.Mesh(new T.BoxGeometry(6, 6, 6), new T.MeshStandardMaterial({ color: 0x20c040 })); box.position.set(14, 0, 0); root.add(box);
    const buf = await new Promise((res, rej) => new GLTFExporter().parse(root, res, rej, { binary: true }));
    let s = ''; const by = new Uint8Array(buf);
    for (let i = 0; i < by.length; i += 0x8000) s += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000));
    return btoa(s);
  });
  fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (o.help || o.ayuda || (!o._.length && !o.mold && !o.probar)) { console.log(AYUDA); return; }

  const opts = {
    text: o.text, res: num(o.res, '--res', 16, 128), quiet: num(o.quiet, '--quiet', 2, 4), minVersion: num(o['min-version'], '--min-version', 1, 10),
    rotY: num(o.rotY, '--rotY', -360, 360), rotX: num(o.rotX, '--rotX', -360, 360), colors: num(o.colors, '--colors', 0, 16),
    ecc: o.ecc, qrStyle: o['qr-style'], darkColor: color(o.dark, '--dark'), lightColor: color(o.light, '--light'), mold: o.mold,
  };
  if (opts.ecc && !['L', 'M', 'Q', 'H'].includes(opts.ecc)) fail('--ecc debe ser L, M, Q o H');
  if (opts.qrStyle && !['tint', 'custom'].includes(opts.qrStyle)) fail('--qr-style debe ser tint o custom');
  if (opts.mold && !['minecraft', 'rhinella', 'pristimantis', 'glass', 'atelopus'].includes(opts.mold)) fail('--mold no válido');
  if (opts.text !== undefined && (opts.text.length === 0 || opts.text.length > 1200)) fail('--text debe tener entre 1 y 1200 caracteres');
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];

  const outDir = path.resolve(o.out || 'salida');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findBrowser(o.chrome), headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run'],
  });
  let srv;
  try {
    let models = collect(o._);
    let jobs;
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TEMP || '/tmp'), 'cubizar-'));
    if (o.probar) { models = [path.join(tmp, 'prueba.glb')]; }
    const s = await startServer(models);
    srv = s.srv;
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('  [página]', e.message));
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`http://127.0.0.1:${s.port}/index.html?auto`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('window.ranaAutoReady === true', { timeout: 30000 });
    if (o.probar) await makeTestModel(page, models[0]);

    jobs = models.length ? models.map((p, i) => ({ name: safeName(path.basename(p)), url: `/__in/${s.token}/${i}.glb`, label: path.basename(p) }))
      : [{ name: 'molde_' + opts.mold, url: null, label: 'molde ' + opts.mold }];

    let manifiesto = [];
    if (o.manifiesto) {
      try { manifiesto = JSON.parse(fs.readFileSync(o.manifiesto, 'utf8')); } catch { fail('--manifiesto no es un JSON válido'); }
      if (!Array.isArray(manifiesto)) fail('--manifiesto debe ser una lista');
    }
    const resultados = [];
    const entries = [];
    const pretty = (s) => s.replace(/_+/g, ' ').trim().slice(0, 40);
    for (const job of jobs) {
      process.stdout.write(`• ${job.label} … `);
      const t0 = Date.now();
      try {
        const man = manifiesto.find((x) => x && path.basename(String(x.archivo || '')) === job.label) || {};
        const label = String(man.titulo || (models.length <= 1 && o.titulo) || pretty(job.name)).slice(0, 40);
        const texto = man.texto || undefined;
        if (o.subir && !man.texto && !opts.text) console.log(`  ⚠ sin --text: el QR de «${label}» apuntará a https://example.com`);
        const r = await page.evaluate((a) => window.ranaAuto.run(a), { ...opts, ...(texto ? { text: texto } : {}), glbUrl: job.url, name: job.label, label });
        const names = { qr_png: '_qr.png', vista_cubos_png: '_vista_cubos.png', vista_qr_png: '_vista_qr.png', cubos_glb: '_cubos.glb',
          qr_glb: '_qr.glb', cubos_vox: '_cubos.vox', proyecto_json: '_proyecto.json' };
        const written = [];
        for (const [k, suf] of Object.entries(names)) {
          if (!r.files[k]) continue;
          fs.writeFileSync(path.join(outDir, job.name + suf), Buffer.from(r.files[k], 'base64'));
          written.push(job.name + suf);
        }
        if (r.files.vox_error) r.report.vox = r.files.vox_error;
        entries.push(r.files.entry);
        fs.writeFileSync(path.join(outDir, job.name + '_informe.json'), JSON.stringify({ ...r.report, archivos: written }, null, 2));
        const rep = r.report;
        console.log(`${rep.qrLegible ? '✔' : '✘'} QR ${rep.qrLegible ? 'legible' : 'NO legible'} · ${rep.cubosVisibles} cubos · QR v${rep.qrVersion} · ${((Date.now() - t0) / 1000).toFixed(1)} s${rep.nota ? ' · ' + rep.nota : ''}`);
        resultados.push({ job: job.label, ok: rep.qrLegible, report: rep });
      } catch (e) {
        console.log('✘ ' + String(e.message).split('\n')[0]);
        resultados.push({ job: job.label, ok: false, error: e.message });
      }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (o.subir && entries.length) {
      const base = o.subir.replace(/\/+$/, '');
      if (!/^https?:\/\/[^\s]+$/.test(base)) fail('--subir debe empezar por http:// o https://');
      const clave = process.env.RANA_CLAVE_CREAR; // solo si el sitio exige CLAVE_CREAR
      const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
      for (const e of entries) {
        const id = Array.from(crypto.randomBytes(10), (x) => alfabeto[x % alfabeto.length]).join('');
        const r = await fetch(`${base}/api/modelos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(clave ? { 'X-Clave-Crear': clave } : {}) }, body: JSON.stringify({ ...e, id }) });
        const d = await r.json().catch(() => ({}));
        console.log(r.ok ? `  ✔ «${e.label}» guardado: ${base}/v/${id}
    clave para borrarlo (guárdala): ${d.clave}` : `  ✘ «${e.label}»: ${d.error || r.status}`);
        if (!r.ok) process.exitCode = 1;
      }
    }
    const bad = resultados.filter((r) => !r.ok);
    console.log(`\nSalida: ${outDir}\n${resultados.length - bad.length}/${resultados.length} correctos`);
    if (o.probar) {
      const r = resultados[0];
      const ok = r && r.ok && r.report.cubosVisibles > 500;
      console.log(ok ? '✔ Autoprueba superada' : '✘ Autoprueba fallida');
      process.exitCode = ok ? 0 : 1;
    } else if (bad.length && o.estricto) process.exitCode = 1;
    else if (resultados.every((r) => r.error)) process.exitCode = 1;
  } finally {
    await browser.close();
    if (srv) srv.close();
  }
}

main().catch((e) => { console.error('✘ ' + e.message); process.exit(1); });
