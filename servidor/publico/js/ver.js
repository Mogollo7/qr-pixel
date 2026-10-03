// Página pública de un QR guardado: /v/<id>
(function () {
  'use strict';
  var stage = document.getElementById('stage'), msg = document.getElementById('msg'), info = document.getElementById('info');
  var animBtn = document.getElementById('anim'), qrBtn = document.getElementById('qrbtn'), openLink = document.getElementById('open');
  function fail(t) { msg.hidden = false; msg.textContent = t; }

  var m = /^\/v\/([a-z0-9-]{1,40})\/?$/.exec(location.pathname);
  if (!m) { fail('Enlace no válido.'); return; }
  if (!window.THREE) { fail('No se pudo cargar el visor 3D.'); return; }

  var viewer;
  function go(url) {
    if (/^https?:\/\//i.test(url)) location.href = url; // redirige al destino del QR
  }
  try { viewer = RanaViewer.create(stage, { onActivate: go, onState: function (s) { qrBtn.textContent = s.qr ? 'Ver figura' : 'Ver QR'; } }); }
  catch (e) { fail('Tu navegador no permite gráficos 3D (WebGL).'); return; }

  function showAnim() { animBtn.textContent = viewer.reduce ? 'Animación: no' : 'Animación: sí'; animBtn.setAttribute('aria-pressed', viewer.reduce ? 'false' : 'true'); }
  animBtn.addEventListener('click', function () {
    viewer.setReduce(!viewer.reduce); showAnim();
    try { localStorage.setItem('rq-anim', viewer.reduce ? '0' : '1'); } catch (e) { /* sin almacenamiento */ }
  });
  showAnim();
  qrBtn.addEventListener('click', function () { viewer.setQR(!viewer.qr); });

  fetch('/api/modelos/' + m[1], { headers: { Accept: 'application/json' } }).then(function (r) {
    if (r.status === 404) throw new Error('Este QR no existe o fue eliminado.');
    if (!r.ok) throw new Error('No se pudo cargar el modelo.');
    return r.json();
  }).then(function (e) {
    document.title = e.label + ' · Rana QR';
    info.textContent = '';
    var b = document.createElement('b'); b.textContent = e.label; info.appendChild(b);
    var s = document.createElement('span'); s.textContent = /^https?:\/\//i.test(e.text) ? e.text : 'Hecho con ' + e.n.toLocaleString('es') + ' cubos'; info.appendChild(s);
    if (/^https?:\/\//i.test(e.text)) { openLink.href = e.text; openLink.hidden = false; }
    qrBtn.hidden = false;
    viewer.load(e);
    stage.focus({ preventScroll: true });
  }).catch(function (err) { fail(err.message); });
})();
