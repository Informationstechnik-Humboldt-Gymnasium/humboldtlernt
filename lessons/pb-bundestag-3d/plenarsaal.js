// Bundestag in 3D: Plenarsaal als Modell mit Three.js (lokal: ../sandbox-chemielabor/three.js).
// Zeichnet nur bei Bedarf. Kein Bild, keine fremden Dateien: Saal, Sitze und Kuppel sind einfache Körper.
// Bewusst nicht nachgebildet: der Bundesadler hinter dem Präsidium (Kunstwerk) – die Rückwand bleibt schlicht.
(function (root) {
  'use strict';
  var BT = root.BT, T = root.THREE;

  var st = {
    bereit: false, canvas: null, renderer: null, szene: null, kamera: null,
    plan: null, sitzIndex: [], sitzMesh: null, lehneMesh: null, schilder: [], kuppel: null, beschriftungen: null,
    auswahl: {}, markiert: null, kam: { theta: 0, phi: 0.72, dist: 36, ziel: [0, 0.5, 5] },
    zeiger: {}, geste: null, bild: 0, aktiv: false, cb: {}, farbCache: {},
  };

  var verfuegbarErgebnis = null;
  function verfuegbar() {
    if (verfuegbarErgebnis !== null) return verfuegbarErgebnis;
    verfuegbarErgebnis = false;
    if (!T || !T.WebGLRenderer) return false;
    try { var c = document.createElement('canvas'); verfuegbarErgebnis = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { verfuegbarErgebnis = false; }
    return verfuegbarErgebnis;
  }

  function cssFarbe(name) { return (getComputedStyle(document.body).getPropertyValue(name) || '').trim() || '#888888'; }
  function farbe(name) { return st.farbCache[name] || (st.farbCache[name] = new T.Color(cssFarbe(name))); }

  // ------------------------------------------------------------ Aufbau
  function start(canvas, callbacks) {
    st.cb = callbacks || {};
    if (st.bereit) return true;
    if (!verfuegbar()) return false;
    st.canvas = canvas;
    try { st.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { verfuegbarErgebnis = false; return false; }
    st.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    st.renderer.outputColorSpace = T.SRGBColorSpace;
    st.renderer.toneMapping = T.ACESFilmicToneMapping;
    st.renderer.setClearColor(0x000000, 0);
    st.kamera = new T.PerspectiveCamera(42, 1.5, 0.3, 200);
    st.ray = new T.Raycaster();
    bauen();
    canvas.addEventListener('pointerdown', runter);
    canvas.addEventListener('pointermove', bewegen);
    canvas.addEventListener('pointerup', hoch);
    canvas.addEventListener('pointercancel', function (ev) { delete st.zeiger[ev.pointerId]; st.geste = null; });
    canvas.addEventListener('wheel', function (ev) { ev.preventDefault(); zoom(Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.003)); }, { passive: false });
    canvas.addEventListener('keydown', tasten);
    if (root.ResizeObserver) new root.ResizeObserver(groesse).observe(canvas.parentNode); else root.addEventListener('resize', groesse);
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var neu = function () { st.farbCache = {}; bauen(); };
      if (mq.addEventListener) mq.addEventListener('change', neu); else if (mq.addListener) mq.addListener(neu);
    }
    st.bereit = true;
    ansicht('praesidium');
    groesse();
    return true;
  }

  function wegwerfen(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  function bauen() {
    if (st.szene) wegwerfen(st.szene);
    var s = st.szene = new T.Scene();
    st.plan = BT.sitzplan();
    var plan = st.plan, von = -16 * Math.PI / 180, bis = 196 * Math.PI / 180;
    s.add(new T.HemisphereLight(0xffffff, 0x445066, 0.9));
    var licht = new T.DirectionalLight(0xffffff, 1.5);
    licht.position.set(6, 22, 10);
    s.add(licht);
    var licht2 = new T.DirectionalLight(0xdfe8ff, 0.5);
    licht2.position.set(-10, 8, -8);
    s.add(licht2);

    // Boden und Stufen des Halbrunds
    var boden = new T.Mesh(new T.CircleGeometry(17, 72), new T.MeshStandardMaterial({ color: farbe('--saal-boden'), roughness: 0.95 }));
    boden.rotation.x = -Math.PI / 2;
    s.add(boden);
    var stufeMat = new T.MeshStandardMaterial({ color: farbe('--saal-stufe'), roughness: 0.9, side: T.DoubleSide });
    plan.radien.forEach(function (r, i) {
      // Ring als Fläche (Dreiecke) – Kreisrichtung so, dass x = r·cos(w), z = r·sin(w) wie im Sitzplan
      var g = new T.RingGeometry(r - 0.36, r + 0.36, 64, 1, -bis, bis - von);
      var ring = new T.Mesh(g, stufeMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = i * 0.2 + 0.001;
      s.add(ring);
    });

    // Sitze als Instanzen (Sitzfläche und Lehne)
    var n = plan.sitze.length;
    var sitzGeo = new T.BoxGeometry(0.5, 0.12, 0.46), lehneGeo = new T.BoxGeometry(0.5, 0.5, 0.1);
    var mat = new T.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });
    st.sitzMesh = new T.InstancedMesh(sitzGeo, mat, n);
    st.lehneMesh = new T.InstancedMesh(lehneGeo, mat.clone(), n);
    var d = new T.Object3D(), d2 = new T.Object3D();
    plan.sitze.forEach(function (sz, k) {
      var blick = Math.atan2(-sz.x, -(sz.z + 1.5));   // Sitz schaut zum Rednerpult
      d.position.set(sz.x, sz.y + 0.32, sz.z); d.rotation.set(0, blick, 0); d.updateMatrix();
      st.sitzMesh.setMatrixAt(k, d.matrix);
      d2.position.set(sz.x - Math.sin(blick) * 0.2, sz.y + 0.6, sz.z - Math.cos(blick) * 0.2); d2.rotation.set(0, blick, 0); d2.updateMatrix();
      st.lehneMesh.setMatrixAt(k, d2.matrix);
    });
    s.add(st.sitzMesh, st.lehneMesh);
    st.sitzIndex = plan.sitze;
    faerben();

    // Rednerpult, Präsidium, Regierungsbank, Bundesratsbank, Rückwand
    var holz = new T.MeshStandardMaterial({ color: farbe('--saal-moebel'), roughness: 0.7 });
    var pult = new T.Mesh(new T.BoxGeometry(1.1, 1.1, 0.6), holz);
    pult.position.set(0, 0.55, -1.4);
    var praesidium = new T.Mesh(new T.BoxGeometry(4.2, 1.6, 0.9), holz);
    praesidium.position.set(0, 0.8, -3.3);
    var podest = new T.Mesh(new T.BoxGeometry(5, 0.6, 1.8), new T.MeshStandardMaterial({ color: farbe('--saal-stufe'), roughness: 0.9 }));
    podest.position.set(0, 0.3, -3.6);
    s.add(pult, praesidium, podest);
    [[3.6, 'regierung'], [-3.6, 'bundesrat']].forEach(function (b) {
      var bank = new T.Mesh(new T.BoxGeometry(3.6, 0.8, 0.8), holz);
      bank.position.set(b[0], 0.4, -2.6);
      bank.rotation.y = b[0] > 0 ? -0.25 : 0.25;
      s.add(bank);
    });
    var wand = new T.Mesh(new T.PlaneGeometry(16, 5), new T.MeshStandardMaterial({ color: farbe('--saal-wand'), roughness: 1 }));
    wand.position.set(0, 2.5, -4.6);
    s.add(wand);

    // Kuppel (schematisch, durchsichtig)
    var kuppel = st.kuppel = new T.Group();
    var glas = new T.Mesh(new T.SphereGeometry(16, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: farbe('--saal-glas'), transparent: true, opacity: 0.07, roughness: 0.1, depthWrite: false, side: T.DoubleSide }));
    glas.position.y = 7;
    kuppel.add(glas);
    var rippen = [];
    for (var i = 0; i < 24; i++) {
      var w = i / 24 * Math.PI * 2;
      for (var j = 0; j < 12; j++) {
        var a1 = j / 12 * Math.PI / 2, a2 = (j + 1) / 12 * Math.PI / 2;
        rippen.push(16 * Math.cos(a1) * Math.cos(w), 7 + 16 * Math.sin(a1), 16 * Math.cos(a1) * Math.sin(w), 16 * Math.cos(a2) * Math.cos(w), 7 + 16 * Math.sin(a2), 16 * Math.cos(a2) * Math.sin(w));
      }
    }
    var rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rippen, 3));
    kuppel.add(new T.LineSegments(rg, new T.LineBasicMaterial({ color: farbe('--saal-rippe'), transparent: true, opacity: 0.18 })));
    kuppel.visible = st.kuppelAn !== false;
    s.add(kuppel);

    // Beschriftungen
    st.beschriftungen = new T.Group();
    var mitten = BT.fraktionsMitten(plan);
    BT.daten.FRAKTIONEN.forEach(function (f) {
      var m = mitten[f.id], len = Math.hypot(m.x, m.z) || 1, r = f.fraktionslos ? plan.aussen + 1 : plan.aussen + 1.6;
      st.beschriftungen.add(schild(f.kurz + ' · ' + f.sitze, m.x / len * r, f.fraktionslos ? 3.8 : 3.3, m.z / len * r, 0.62));
    });
    st.beschriftungen.add(schild('Präsidium', 0, 2.3, -3.3, 0.42), schild('Rednerpult', 0, 1.6, -1.4, 0.36),
      schild('Regierung', 3.6, 1.4, -2.6, 0.36), schild('Bundesrat', -3.6, 1.4, -2.6, 0.36));
    st.beschriftungen.visible = st.beschriftungenAn !== false;
    s.add(st.beschriftungen);
    zeichneSpaeter();
  }

  function schild(text, x, y, z, h) {
    var c = document.createElement('canvas'), g = c.getContext('2d'), px = 56;
    var schrift = '700 ' + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.font = schrift;
    var w = Math.ceil(g.measureText(text).width) + px, hh = Math.ceil(px * 1.5);
    c.width = w; c.height = hh;
    g.font = schrift; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = cssFarbe('--card'); g.globalAlpha = 0.9;
    var r = hh / 2;
    g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, hh); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.fill();
    g.globalAlpha = 1; g.fillStyle = cssFarbe('--text'); g.fillText(text, w / 2, hh / 2 + 2);
    var tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
    sp.scale.set(h * w / hh, h, 1);
    sp.position.set(x, y, z);
    sp.renderOrder = 10;
    return sp;
  }

  /** Sitzfarben: Fraktionsfarbe; ist eine Auswahl aktiv, werden nicht ausgewählte Fraktionen blass. */
  function faerben() {
    if (!st.sitzMesh) return;
    var irgendwas = Object.keys(st.auswahl).some(function (k) { return st.auswahl[k]; });
    var grau = farbe('--saal-blass'), c = new T.Color();
    st.sitzIndex.forEach(function (sz, k) {
      c.copy(farbe('--p-' + sz.fraktion));
      if (irgendwas && !st.auswahl[sz.fraktion]) c.lerp(grau, 0.82);
      if (st.markiert === k) c.lerp(farbe('--accent'), 0.6);
      st.sitzMesh.setColorAt(k, c);
      st.lehneMesh.setColorAt(k, c);
    });
    st.sitzMesh.instanceColor.needsUpdate = true;
    st.lehneMesh.instanceColor.needsUpdate = true;
    zeichneSpaeter();
  }

  // ------------------------------------------------------------ Kamera
  var ANSICHTEN = {
    praesidium: { theta: 0, phi: 0.72, dist: 36 },      // vom Präsidium: links im Bild = links aus Sicht des Präsidiums
    tribuene: { theta: Math.PI, phi: 0.62, dist: 33 },   // von der Besuchertribüne hinter den Abgeordneten
    oben: { theta: 0, phi: 1.5, dist: 40 },
  };
  function ansicht(name) {
    var a = ANSICHTEN[name] || ANSICHTEN.praesidium;
    st.kam.theta = a.theta; st.kam.phi = a.phi; st.kam.dist = a.dist;
    kameraSetzen();
  }
  function kameraSetzen() {
    if (!st.kamera) return;
    var k = st.kam, z = k.ziel;
    // theta = 0: Kamera beim Präsidium (negatives z) mit Blick in den Saal
    st.kamera.position.set(z[0] - Math.sin(k.theta) * Math.cos(k.phi) * k.dist, z[1] + Math.sin(k.phi) * k.dist, z[2] - Math.cos(k.theta) * Math.cos(k.phi) * k.dist);
    st.kamera.lookAt(z[0], z[1], z[2]);
    zeichneSpaeter();
  }
  function zoom(f) { st.kam.dist = Math.max(10, Math.min(50, st.kam.dist * f)); kameraSetzen(); }
  function drehe(dt, dp) {
    st.kam.theta += dt;
    st.kam.phi = Math.max(0.12, Math.min(1.5, st.kam.phi + dp));
    if (st.cb.gedreht) st.cb.gedreht(Math.abs(dt) + Math.abs(dp));
    kameraSetzen();
  }

  function groesse() {
    if (!st.bereit) return;
    var w = st.canvas.parentNode.clientWidth || 600, h = Math.round(w * 0.66);
    st.renderer.setSize(w, h, false);
    st.canvas.style.height = h + 'px';
    st.kamera.aspect = w / h;
    // Auf schmalen Geräten etwas weiter weg, damit der ganze Saal sichtbar bleibt
    st.kamera.fov = w < 500 ? 52 : 42;
    st.kamera.updateProjectionMatrix();
    kameraSetzen();
  }

  // ------------------------------------------------------------ Bedienung
  function runter(ev) {
    if (ev.button > 0) return;
    ev.preventDefault();
    try { st.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
    if (document.activeElement !== st.canvas) st.canvas.focus({ preventScroll: true });
    st.zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var ids = Object.keys(st.zeiger);
    if (ids.length === 2) { var a = st.zeiger[ids[0]], b = st.zeiger[ids[1]]; st.geste = { art: 'zoom', d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) }; }
    else if (ids.length === 1) st.geste = { art: 'drehen', start: { x: ev.clientX, y: ev.clientY }, bewegt: false, typ: ev.pointerType };
  }
  function bewegen(ev) {
    var alt = st.zeiger[ev.pointerId];
    if (!alt) { if (ev.pointerType === 'mouse') hover(ev); return; }
    if (!st.geste) return;
    var neu = { x: ev.clientX, y: ev.clientY };
    st.zeiger[ev.pointerId] = neu;
    var g = st.geste;
    if (g.art === 'zoom') {
      var ids = Object.keys(st.zeiger); if (ids.length < 2) return;
      var a = st.zeiger[ids[0]], b = st.zeiger[ids[1]], d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      zoom(g.d / d); g.d = d; return;
    }
    if (!g.bewegt && Math.hypot(neu.x - g.start.x, neu.y - g.start.y) < (g.typ === 'touch' ? 9 : 4)) return;
    g.bewegt = true;
    var f = 3.2 / Math.max(240, st.canvas.clientWidth);
    drehe(-(neu.x - alt.x) * f, (neu.y - alt.y) * f);
  }
  function hoch(ev) {
    var war = st.zeiger[ev.pointerId];
    delete st.zeiger[ev.pointerId];
    var g = st.geste;
    if (!war || !g) return;
    if (g.art === 'zoom') { if (!Object.keys(st.zeiger).length) st.geste = null; return; }
    st.geste = null;
    if (!g.bewegt) waehleSitz(treffer(ev));
  }
  function treffer(ev) {
    var r = st.canvas.getBoundingClientRect();
    st.ray.setFromCamera(new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), st.kamera);
    var t = st.ray.intersectObjects([st.sitzMesh, st.lehneMesh], false)[0];
    return t && t.instanceId !== undefined ? t.instanceId : null;
  }
  var hoverIdx = null;
  function hover(ev) {
    var k = treffer(ev);
    st.canvas.style.cursor = k === null ? 'grab' : 'pointer';
    if (k !== hoverIdx) { hoverIdx = k; if (st.cb.hover) st.cb.hover(k === null ? null : st.sitzIndex[k]); }
  }
  function waehleSitz(k) {
    st.markiert = k;
    faerben();
    if (st.cb.sitz) st.cb.sitz(k === null ? null : st.sitzIndex[k]);
  }
  function tasten(ev) {
    var s = Math.PI / 16;
    var d = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s / 2], ArrowDown: [0, -s / 2] }[ev.key];
    if (d) { ev.preventDefault(); drehe(d[0], d[1]); return; }
    if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoom(0.85); }
    else if (ev.key === '-') { ev.preventDefault(); zoom(1.18); }
    else if (ev.key === '0' || ev.key === 'Home') { ev.preventDefault(); ansicht('praesidium'); }
  }

  // ------------------------------------------------------------ Zeichnen
  function zeichneSpaeter() {
    if (!st.bereit || st.bild || !st.aktiv) return;
    st.bild = root.requestAnimationFrame(function () { st.bild = 0; if (st.aktiv) st.renderer.render(st.szene, st.kamera); });
  }

  // ------------------------------------------------------------ Schnittstelle
  BT.saal3d = {
    verfuegbar: verfuegbar, start: start, ansicht: ansicht, zoom: zoom,
    aktiv: function (an) { st.aktiv = !!an; if (an) groesse(); },
    auswahl: function (a) { st.auswahl = a || {}; faerben(); },
    markiere: function (k) { st.markiert = k; faerben(); },
    kuppel: function (an) { st.kuppelAn = an; if (st.kuppel) { st.kuppel.visible = an; zeichneSpaeter(); } },
    beschriftungen: function (an) { st.beschriftungenAn = an; if (st.beschriftungen) { st.beschriftungen.visible = an; zeichneSpaeter(); } },
    zustand: function () { return { bereit: st.bereit, sitze: st.sitzIndex.length, kamera: Object.assign({}, st.kam), markiert: st.markiert }; },
  };
})(window);
