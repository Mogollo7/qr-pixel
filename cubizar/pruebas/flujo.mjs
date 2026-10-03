// Prueba de punta a punta contra el sitio en marcha (por defecto http://localhost:8080): node pruebas/flujo.mjs [url]
// Usa el primer .glb de ../entrada. Es una herramienta de desarrollo, no forma parte del producto.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';

const base = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const dir = path.resolve(import.meta.dirname, '..', '..', 'entrada');
const glb = fs.readdirSync(dir).filter((f) => /\.glb$/i.test(f)).map((f) => path.join(dir, f))[0];
if (!glb) { console.error('Pon un .glb en D:\\qr\\entrada'); process.exit(2); }
const out = path.resolve(import.meta.dirname, 'capturas'); fs.mkdirSync(out, { recursive: true });
const w = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
const check = (nombre, ok, detalle = '') => { resultados.push(ok); console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}`); };

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const pagina = async (vp) => {
  const p = await b.newPage(); await p.setViewport(vp);
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of (40[0-9])/.test(m.text())) errs.push(m.text()); });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  return p;
};

// ---- 1) crear: sin token ni clave
const p = await pagina({ width: 1300, height: 850 });
await p.goto(base + '/', { waitUntil: 'networkidle0', timeout: 90000 });
check('la página de crear no pide token', (await p.$('#token')) === null && (await p.$eval('#claveCrear', (e) => e.hidden)));
await (await p.$('#glb')).uploadFile(glb);
await p.waitForFunction(() => document.querySelector('#badge').textContent.includes('QR'), { timeout: 120000 });
check('el GLB se convierte en cubos', /cubos/.test(await p.$eval('#datos', (e) => e.textContent)), await p.$eval('#datos', (e) => e.textContent));
await p.type('#enlace', 'javascript:alert(1)'); await w(200);
check('rechaza enlaces javascript:', !(await p.$eval('#enlaceErr', (e) => e.hidden)));
await p.$eval('#enlace', (e) => { e.value = ''; });
const destino = base + '/api/salud';
await p.type('#enlace', destino.replace(/^https?:\/\//, '')); await w(1500);
await p.waitForFunction(() => document.querySelector('#datos').textContent.indexOf('ejemplo') < 0, { timeout: 60000 });
check('QR legible con el enlace', (await p.$eval('#badge', (e) => e.textContent)).includes('legible'));
await p.click('#guardar'); await p.waitForSelector('#listo:not([hidden])', { timeout: 30000 });
const final = await p.$eval('#linkFinal', (e) => e.textContent);
check('guardar entrega un enlace final', /\/v\/[a-z0-9]{10}$/.test(final), final);
await p.screenshot({ path: `${out}/1_guardado.png` });
const id = final.split('/').pop();
check('aparece en «Mis QR»', (await p.$$eval('#lista li b', (a) => a.length)) === 1);

// ---- 2) la API sin clave no deja tocar lo ajeno
const del = await fetch(`${base}/api/modelos/${id}`, { method: 'DELETE' });
check('borrar sin la clave del QR → 403', del.status === 403);
const put = await fetch(`${base}/api/modelos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
check('reemplazar sin la clave → 403', put.status === 403);
const malo = await fetch(`${base}/api/modelos/${crypto.randomBytes(5).toString('hex')}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: 'x', text: 't', L: 1, H: 1, side: 1, n: 5, frog: 'AA==', frogRgb: '', qr: '', qrRgb: '', misc: '' }) });
check('carga inválida → 400', malo.status === 400);
check('la lista pública ya no existe', (await fetch(`${base}/api/modelos`)).status === 404);

// ---- 3) página final: gira sola, hover → QR, alejar → figura, clic → redirige
const v = await pagina({ width: 1100, height: 700 });
await v.goto(final, { waitUntil: 'networkidle0' }); await v.waitForSelector('#info b');
await w(3500);
const a1 = await v.screenshot({ encoding: 'base64' }); await w(1500); const a2 = await v.screenshot({ encoding: 'base64' });
check('la figura gira sola cuando el mouse no está encima', a1 !== a2);
await v.screenshot({ path: `${out}/2_final_figura.png` });
const hint = () => v.$eval('.rq-hint', (e) => e.textContent);
await v.mouse.move(550, 300); await w(2800);
check('al acercar el mouse se muestra el QR', (await hint()).includes('clic'), await hint());
await v.screenshot({ path: `${out}/3_final_qr.png` });
await v.mouse.move(550, 685); await w(2800);
check('al alejar el mouse vuelve la figura', (await hint()).includes('Acerca'), await hint());
await w(300); const b1 = await v.screenshot({ encoding: 'base64' }); await w(1500); const b2 = await v.screenshot({ encoding: 'base64' });
check('y la figura vuelve a girar', b1 !== b2);
await v.mouse.move(550, 300); await w(2800);
await Promise.all([v.waitForNavigation({ timeout: 15000 }).catch(() => null), v.mouse.click(550, 300)]);
check('clic en el QR redirige al enlace', v.url() === destino, v.url());

// ---- 4) móvil
const m = await b.newPage();
await m.emulate({ viewport: { width: 390, height: 780, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
await m.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await m.goto(final, { waitUntil: 'networkidle0' }); await m.waitForSelector('#info b'); await w(3000);
const box = await (await m.$('#stage')).boundingBox();
await m.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await w(2800);
check('móvil: un toque muestra el QR', (await m.$eval('.rq-hint', (e) => e.textContent)).includes('de nuevo'));
await Promise.all([m.waitForNavigation({ timeout: 15000 }).catch(() => null), m.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)]);
check('móvil: el segundo toque abre el enlace', m.url() === destino, m.url());

// ---- 5) borrar desde «Mis QR» con la clave que guardó el navegador
await p.bringToFront();
const btns = await p.$$('#lista li button');
for (const bt of btns) if ((await bt.evaluate((e) => e.textContent)) === 'Eliminar') { await bt.click(); await bt.click(); }
await w(1200);
check('el dueño puede eliminar su QR', (await fetch(`${base}/api/modelos/${id}`)).status === 404);

check('sin errores de consola', errs.length === 0, [...new Set(errs)].join(' | '));
await b.close();
console.log(`\n${resultados.filter(Boolean).length}/${resultados.length} comprobaciones correctas`);
process.exit(resultados.every(Boolean) ? 0 : 1);
