// Visor de Rana QR (librería). Necesita THREE en window (UMD r160 o el módulo ES asignado a window.THREE).
//
// Comportamiento:
//  · La figura de cubos aparece armándose (los bloques vuelan y se juntan).
//  · Al acercar el mouse, los mismos cubos se reordenan en el QR. Al alejarlo vuelven a ser la figura.
//  · Clic sobre el QR: se llama a onActivate(enlace) (la página decide: redirigir o abrir pestaña).
//  · En pantallas táctiles: un toque muestra el QR; un segundo toque lo abre.
(function (global) {
  'use strict';

  function create(stage, opts) {
    opts = opts || {};
    var T = global.THREE;
    if (!T) throw new Error('THREE no está cargado');
    var reduce = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { var sv = localStorage.getItem('rq-anim'); if (sv === '1') reduce = false; else if (sv === '0') reduce = true; } catch (e) { /* sin almacenamiento */ }

    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var hint = document.createElement('div');
    hint.className = 'rq-hint';
    stage.appendChild(hint);

    var scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 1, 5000);
    scene.add(new T.HemisphereLight(0xffffff, 0x3a4a3a, 1.6));
    var sun = new T.DirectionalLight(0xffffff, 2.2); scene.add(sun);

    // uMorph: 0 figura → 1 QR. uAsm: 0 armado → 1 bloques dispersos.
    var U = { uMorph: { value: 0 }, uAsm: { value: 1 }, uArc: { value: 10 }, uScat: { value: 50 } };
    var mat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uMorph = U.uMorph; sh.uniforms.uAsm = U.uAsm; sh.uniforms.uArc = U.uArc; sh.uniforms.uScat = U.uScat;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'attribute vec3 aQr; attribute vec3 aQrCol; attribute vec3 aMisc;',
          'uniform float uMorph; uniform float uAsm; uniform float uArc; uniform float uScat;',
          'float morphT() { float t = clamp(uMorph * 1.7 - aMisc.x * 0.7, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
        ].join('\n'))
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          '{ float mt = morphT(), fly = sin(mt * 3.14159265);',
          ' float ang = fly * (aMisc.x - 0.5) * 7.0, cs = cos(ang), sn = sin(ang);',
          ' transformed.xz = mat2(cs, -sn, sn, cs) * transformed.xz;',
          ' transformed *= mix(aMisc.y, aMisc.z, mt);',
          ' vec3 off = (aQr - instanceMatrix[3].xyz) * mt;',
          ' off.y += fly * uArc * (0.3 + aMisc.x);',
          ' off.x += fly * uArc * (fract(aMisc.x * 7.31) - 0.5);',
          ' transformed += off; }',
          '{ vec3 hp = instanceMatrix[3].xyz;',
          ' vec3 h3 = fract(sin(vec3(dot(hp, vec3(12.9898, 78.233, 37.719)), dot(hp, vec3(39.346, 11.135, 83.155)), dot(hp, vec3(73.156, 52.235, 9.151)))) * 43758.5453);',
          ' float ea = clamp(uAsm * 1.8 - h3.x * 0.8, 0.0, 1.0); ea = ea * ea * (3.0 - 2.0 * ea);',
          ' vec3 sc = (h3 - 0.5) * 2.0 * uScat; sc.y = abs(sc.y) * 0.8 + uScat * 0.15;',
          ' float a2 = ea * (h3.y - 0.5) * 9.0, c2 = cos(a2), s2 = sin(a2);',
          ' transformed.xz = mat2(c2, -s2, s2, c2) * transformed.xz;',
          ' transformed *= mix(1.0, 0.3, ea);',
          ' transformed += sc * ea; }',
        ].join('\n'))
        .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, aQrCol, morphT());');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uMorph;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 qrFlat = diffuseColor.rgb * uMorph * 0.9; diffuseColor.rgb *= 1.0 - uMorph * 0.9;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += qrFlat;');
    };

    function b64(s, Ctor) {
      var bin = atob(s), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Ctor(u8.buffer);
    }

    var mesh = null, cur = null, cam = { az: -2.46, pol: 1.12, dist: 100, ty: 20 };
    var morph = { target: 0, value: 0, from: null };
    var asm = { target: 0, value: 1, dur: 1.9 };
    var spin = true, dirty = true, disposed = false;
    var isTouch = false;

    function qrPose(e) { return { az: Math.PI, pol: Math.PI / 2, dist: e.side * 2.75 * (camera.aspect < 1 ? 1 / camera.aspect : 1), ty: e.side / 2 + 1 }; }
    function angDiff(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

    function setHint() {
      if (!cur) { hint.textContent = ''; return; }
      var link = /^https?:\/\//i.test(cur.text);
      if (morph.target === 1) hint.textContent = link ? (isTouch ? 'Toca de nuevo para abrir el enlace' : 'Haz clic para abrir el enlace') : 'Escanéalo con la cámara de tu móvil';
      else hint.textContent = isTouch ? 'Toca para ver el QR' : 'Acerca el mouse para ver el QR';
      if (opts.onState) opts.onState({ qr: morph.target === 1 });
    }

    function load(entry, o) {
      cur = entry;
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); mesh = null; }
      var n = entry.n, frog = b64(entry.frog, Int16Array), fc = b64(entry.frogRgb, Uint8Array), qp = b64(entry.qr, Int16Array), qc = b64(entry.qrRgb, Uint8Array), ms = b64(entry.misc, Uint8Array);
      var geo = new T.BoxGeometry(1, 1, 1), aQr = new Float32Array(n * 3), aCol = new Float32Array(n * 3), aMisc = new Float32Array(n * 3);
      mesh = new T.InstancedMesh(geo, mat, n);
      var m4 = new T.Matrix4(), c = new T.Color(), i;
      for (i = 0; i < n; i++) {
        m4.makeTranslation(frog[i * 3] + 0.5, frog[i * 3 + 1] + 0.5, frog[i * 3 + 2] + 0.5); mesh.setMatrixAt(i, m4);
        c.setRGB(fc[i * 3] / 255, fc[i * 3 + 1] / 255, fc[i * 3 + 2] / 255, T.SRGBColorSpace); mesh.setColorAt(i, c);
        aQr[i * 3] = qp[i * 3] / 2; aQr[i * 3 + 1] = qp[i * 3 + 1] / 2; aQr[i * 3 + 2] = qp[i * 3 + 2] / 2;
        c.setRGB(qc[i * 3] / 255, qc[i * 3 + 1] / 255, qc[i * 3 + 2] / 255, T.SRGBColorSpace);
        aCol[i * 3] = c.r; aCol[i * 3 + 1] = c.g; aCol[i * 3 + 2] = c.b;
        aMisc[i * 3] = ms[i * 2] / 255; aMisc[i * 3 + 1] = ms[i * 2 + 1] & 1; aMisc[i * 3 + 2] = (ms[i * 2 + 1] >> 1) & 1;
      }
      geo.setAttribute('aQr', new T.InstancedBufferAttribute(aQr, 3));
      geo.setAttribute('aQrCol', new T.InstancedBufferAttribute(aCol, 3));
      geo.setAttribute('aMisc', new T.InstancedBufferAttribute(aMisc, 3));
      mesh.frustumCulled = false;
      scene.add(mesh);
      U.uArc.value = entry.L * 0.35; U.uScat.value = entry.L * 1.1;
      sun.position.set(-entry.L, entry.L * 2.4, -entry.L * 1.4);
      morph.target = 0; morph.value = 0; U.uMorph.value = 0; morph.from = null;
      cam.az = -2.46; cam.pol = 1.12; cam.dist = entry.L * 3.0; cam.ty = entry.H * 0.42;
      camera.near = entry.L * 0.1; camera.far = entry.L * 80; camera.updateProjectionMatrix();
      spin = !reduce;
      var intro = !(o && o.intro === false);
      asm.dur = 1.9; asm.value = (reduce || !intro) ? 0 : 1; asm.target = 0; U.uAsm.value = asm.value;
      setHint(); dirty = true;
    }

    function setQR(on) {
      if (!cur || (morph.target === 1) === on) return;
      if (on) { morph.from = { az: cam.az, pol: cam.pol, dist: cam.dist, ty: cam.ty }; spin = false; }
      morph.target = on ? 1 : 0;
      if (!on) spin = !reduce; // al alejar el mouse la figura vuelve a girar sola
      if (reduce) { morph.value = morph.target; U.uMorph.value = morph.value; if (!on) morph.from = null; }
      setHint(); dirty = true;
    }

    function applyCam() {
      var a = cam.az, p = cam.pol, d = cam.dist, ty = cam.ty;
      if (morph.from) {
        var q = qrPose(cur), e = morph.value * morph.value * (3 - 2 * morph.value);
        a = morph.from.az + angDiff(morph.from.az, q.az) * e; p = morph.from.pol + (q.pol - morph.from.pol) * e;
        d = morph.from.dist + (q.dist - morph.from.dist) * e; ty = morph.from.ty + (q.ty - morph.from.ty) * e;
      }
      camera.position.set(d * Math.sin(p) * Math.sin(a), ty + d * Math.cos(p), d * Math.sin(p) * Math.cos(a));
      camera.lookAt(0, ty, 0);
    }

    // ---- interacción
    var ptrs = {}, moved = 0, last = null, hovering = false;
    function pinchDist() { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    function activate() { if (cur && opts.onActivate) opts.onActivate(cur.text, cur); }

    stage.addEventListener('pointerenter', function (ev) {
      if (ev.pointerType === 'touch') return;
      isTouch = false; hovering = true;
      if (!Object.keys(ptrs).length) setQR(true);
    });
    stage.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType === 'touch') return;
      hovering = false;
      if (!Object.keys(ptrs).length) setQR(false);
    });
    stage.addEventListener('pointerdown', function (ev) {
      isTouch = ev.pointerType === 'touch';
      try { stage.setPointerCapture(ev.pointerId); } catch (x) { /* sin captura */ }
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY }; moved = 0; stage.classList.add('drag');
      last = Object.keys(ptrs).length === 2 ? pinchDist() : null;
    });
    stage.addEventListener('pointermove', function (ev) {
      var p = ptrs[ev.pointerId]; if (!p || !cur) return;
      var dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (morph.target !== 0 || morph.value !== 0) return; // en estado QR no se gira
      if (Object.keys(ptrs).length === 2) { var d = pinchDist(); if (last) cam.dist = Math.min(cur.L * 8, Math.max(cur.L * 1.2, cam.dist * last / d)); last = d; }
      else if (moved > 6) { cam.az -= dx * 0.008; cam.pol = Math.min(1.5, Math.max(0.15, cam.pol - dy * 0.006)); spin = false; }
      dirty = true;
    });
    function up(ev) {
      var was = ptrs[ev.pointerId]; delete ptrs[ev.pointerId]; last = null; stage.classList.remove('drag');
      if (!was) return;
      var tap = moved < 6 && ev.type === 'pointerup';
      if (tap) {
        if (ev.pointerType === 'touch') { if (morph.target === 1) activate(); else setQR(true); }
        else if (morph.target === 1) activate();
      }
      if (ev.pointerType !== 'touch' && !Object.keys(ptrs).length) {
        // al soltar tras arrastrar, el estado sigue a la posición del mouse
        var r = stage.getBoundingClientRect(), inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        hovering = inside; if (!tap) setQR(inside);
      }
    }
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', function (ev) {
      if (!cur || morph.target !== 0 || morph.value !== 0) return;
      ev.preventDefault(); cam.dist = Math.min(cur.L * 8, Math.max(cur.L * 1.2, cam.dist * Math.exp(ev.deltaY * 0.001))); dirty = true;
    }, { passive: false });
    // teclado: Enter o espacio alterna el QR; Enter sobre el QR abre el enlace
    stage.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      if (morph.target === 1 && ev.key === 'Enter') activate(); else setQR(morph.target !== 1);
    });

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
    }
    var ro = new ResizeObserver(resize); ro.observe(stage);
    resize();

    var prev = performance.now();
    renderer.setAnimationLoop(function (now) {
      var dt = Math.min((now - prev) / 1000, 0.1); prev = now;
      if (morph.value !== morph.target && !reduce) {
        morph.value = Math.min(1, Math.max(0, morph.value + Math.sign(morph.target - morph.value) * dt / 1.9));
        U.uMorph.value = morph.value; dirty = true;
        if (morph.value === morph.target && morph.target === 0) morph.from = null;
      }
      if (asm.value !== asm.target && !reduce) {
        asm.value = Math.min(1, Math.max(0, asm.value + Math.sign(asm.target - asm.value) * dt / asm.dur));
        U.uAsm.value = asm.value; dirty = true;
      }
      if (spin && morph.target === 0 && morph.value === 0 && asm.value === 0) { cam.az += dt * 0.35; dirty = true; }
      if (dirty && cur) { applyCam(); renderer.render(scene, camera); dirty = false; }
    });

    return {
      load: load,
      setQR: setQR,
      get qr() { return morph.target === 1; },
      setReduce: function (r) {
        reduce = !!r;
        if (reduce) { morph.value = morph.target; U.uMorph.value = morph.value; if (morph.target === 0) morph.from = null; asm.value = asm.target; U.uAsm.value = asm.value; dirty = true; }
      },
      get reduce() { return reduce; },
      debug: { U: U, asm: asm, morph: morph },
      dispose: function () {
        if (disposed) return; disposed = true;
        renderer.setAnimationLoop(null); ro.disconnect();
        if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.dispose(); }
        mat.dispose(); renderer.dispose(); renderer.domElement.remove(); hint.remove();
      },
    };
  }

  global.RanaViewer = { create: create };
})(window);
