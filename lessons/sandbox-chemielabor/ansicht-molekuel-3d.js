// Atom- & Chemielabor · Molecule Builder: 3D-Ansicht
//
// Zeigt die Moleküle der 2D-Fläche räumlich (Anordnung aus raum.js). Hier wird nur angesehen, gedreht und ausgewählt,
// gebaut wird weiter in der 2D-Ansicht. Three.js liegt lokal im Ordner (three.js, MIT-Lizenz) – es werden keine
// fremden Server angefragt und nichts gespeichert.
// Gezeichnet wird nur bei Bedarf (nach einer Änderung, beim Drehen oder Zoomen), damit schwache Schulgeräte nicht
// dauernd rechnen. Ohne WebGL bleibt die 2D-Ansicht, der 3D-Knopf ist dann gesperrt.
(function (root) {
  'use strict';
  var CL = root.CL, R = CL.raum, M = CL.molekuel, C = CL.chemie, U = CL.ui;
  var T = root.THREE;
  var HOEHE = 380 / 600;                       // gleiches Seitenverhältnis wie die 2D-Fläche
  var RADIUS = { H: 0.26, C: 0.36, N: 0.36, O: 0.36, F: 0.36, P: 0.44, S: 0.44, Cl: 0.44 };   // schematisch
  var HELLE_SCHRIFT = { C: true, N: true, O: true };   // wie in der 2D-Zeichnung
  var GEO_NAME = { linear: 'linear', 'trigonal-planar': 'trigonal-planar', gewinkelt: 'gewinkelt', tetraedrisch: 'tetraedrisch', 'trigonal-pyramidal': 'trigonal-pyramidal' };

  var st = {
    bereit: false, canvas: null, renderer: null, szene: null, kamera: null, gruppe: null, schatten: null,
    atome: {}, schilder: [], wegwerfen: [], materialien: {}, letzte: null, auswahl: null,
    zoom: 1, radius: 2, optionen: { symbole: true, paare: true, auto: false }, zeiger: {}, geste: null,
    gedreht: 0, bild: 0, autoZeit: 0, aktiv: false, cb: {},
  };

  // ------------------------------------------------------------ Verfügbarkeit
  var verfuegbarErgebnis = null;
  function verfuegbar() {
    if (verfuegbarErgebnis !== null) return verfuegbarErgebnis;
    verfuegbarErgebnis = false;
    if (!T || !T.WebGLRenderer) return false;
    try {
      var c = document.createElement('canvas');
      verfuegbarErgebnis = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { verfuegbarErgebnis = false; }
    return verfuegbarErgebnis;
  }

  function farbe(name) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || '#888888';
  }

  // ------------------------------------------------------------ Aufbau (einmalig)
  function start(canvas, callbacks) {
    st.cb = callbacks || {};
    if (st.bereit) return true;
    if (!verfuegbar()) return false;
    st.canvas = canvas;
    try {
      st.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { verfuegbarErgebnis = false; return false; }
    st.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    st.renderer.outputColorSpace = T.SRGBColorSpace;
    st.renderer.toneMapping = T.ACESFilmicToneMapping;
    st.renderer.toneMappingExposure = 1.05;
    st.renderer.setClearColor(0x000000, 0);

    st.szene = new T.Scene();
    st.szene.environment = umgebung();
    st.szene.add(new T.HemisphereLight(0xffffff, 0x50493f, 0.7));
    var licht = new T.DirectionalLight(0xfff4e6, 1.6);
    licht.position.set(3, 6, 5);
    st.szene.add(licht);
    var gegen = new T.DirectionalLight(0xcfe0ff, 0.45);
    gegen.position.set(-5, 1, -3);
    st.szene.add(gegen);

    st.kamera = new T.PerspectiveCamera(32, 1 / HOEHE, 0.1, 200);
    st.gruppe = new T.Group();
    st.gruppe.quaternion.copy(startDrehung());
    st.szene.add(st.gruppe);
    st.schatten = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: schattenTextur(), transparent: true, depthWrite: false, toneMapped: false }));
    st.schatten.rotation.x = -Math.PI / 2;
    st.szene.add(st.schatten);

    st.kugel = new T.SphereGeometry(1, 36, 24);
    st.zylinder = new T.CylinderGeometry(1, 1, 1, 18, 1);
    st.ray = new T.Raycaster();

    canvas.addEventListener('pointerdown', runter);
    canvas.addEventListener('pointermove', bewegen);
    canvas.addEventListener('pointerup', hoch);
    canvas.addEventListener('pointercancel', abbrechen);
    canvas.addEventListener('wheel', function (ev) { ev.preventDefault(); zoom(Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.004)); }, { passive: false });
    canvas.addEventListener('keydown', tasten);
    if (root.ResizeObserver) new root.ResizeObserver(groesse).observe(canvas.parentNode);
    else root.addEventListener('resize', groesse);
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var neuFaerben = function () { st.materialien = {}; if (st.letzte) zeige(st.letzte.m, st.letzte.analyse, st.auswahl); };
      if (mq.addEventListener) mq.addEventListener('change', neuFaerben); else if (mq.addListener) mq.addListener(neuFaerben);
    }
    st.bereit = true;
    groesse();
    return true;
  }

  /** Kleiner „Raum“ mit hellen Flächen als Spiegelbild für glänzende Kugeln (wie ein Studio, ohne Bilddateien). */
  function umgebung() {
    var pmrem = new T.PMREMGenerator(st.renderer), raum = new T.Scene();
    var wand = new T.Mesh(new T.BoxGeometry(10, 10, 10), new T.MeshStandardMaterial({ color: 0x8a8780, side: T.BackSide, roughness: 1 }));
    raum.add(wand);
    raum.add(new T.AmbientLight(0xffffff, 1.2));
    [[0, 4.9, 0, 6, 0.1, 6, 3.2], [-4.9, 1, 1, 0.1, 4, 4, 1.6], [4.9, 0.5, -1, 0.1, 3, 3, 1.1], [0, 1, 4.9, 4, 3, 0.1, 0.8]].forEach(function (f) {
      var mat = new T.MeshBasicMaterial({ color: new T.Color().setScalar(f[6]) });
      var flaeche = new T.Mesh(new T.BoxGeometry(f[3], f[4], f[5]), mat);
      flaeche.position.set(f[0], f[1], f[2]);
      raum.add(flaeche);
    });
    var tex = pmrem.fromScene(raum, 0.04).texture;
    raum.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
    return tex;
  }

  function schattenTextur() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d'), v = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    v.addColorStop(0, 'rgba(0,0,0,.28)'); v.addColorStop(0.55, 'rgba(0,0,0,.1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v; g.fillRect(0, 0, 128, 128);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function startDrehung() {
    return new T.Quaternion().setFromEuler(new T.Euler(0.45, -0.2, 0, 'XYZ'));
  }

  function groesse() {
    if (!st.bereit) return;
    var w = st.canvas.parentNode.clientWidth || 600, h = Math.round(w * HOEHE);
    st.renderer.setSize(w, h, false);
    st.canvas.style.height = h + 'px';
    st.kamera.aspect = w / h;
    kameraSetzen();
  }

  function kameraSetzen() {
    var fov = st.kamera.fov * Math.PI / 180;
    var passt = Math.min(Math.tan(fov / 2), Math.tan(fov / 2) * st.kamera.aspect);
    var d = (st.radius / passt) * 0.98 / st.zoom;
    var hoehe = 0.22;   // leicht von oben, damit man den Schatten sieht
    st.kamera.position.set(0, d * Math.sin(hoehe), d * Math.cos(hoehe));
    st.kamera.near = Math.max(0.05, d - st.radius * 3); st.kamera.far = d + st.radius * 4;
    st.kamera.lookAt(0, 0, 0);
    st.kamera.updateProjectionMatrix();
    zeichneSpaeter();
  }

  // ------------------------------------------------------------ Materialien
  function material(art, wert) {
    var k = art + ':' + wert;
    if (st.materialien[k]) return st.materialien[k];
    var m;
    if (art === 'atom') m = new T.MeshPhysicalMaterial({ color: new T.Color(farbe('--el-' + wert.toLowerCase())), roughness: 0.3, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 0.95 });
    else if (art === 'bindung') m = new T.MeshStandardMaterial({ color: new T.Color(farbe('--muted')), roughness: 0.38, metalness: 0.1, envMapIntensity: 0.8 });
    else if (art === 'paar') m = new T.MeshStandardMaterial({ color: new T.Color(farbe('--accent')), roughness: 0.4, transparent: true, opacity: 0.28, depthWrite: false });
    else if (art === 'elektron') m = new T.MeshStandardMaterial({ color: new T.Color(farbe('--accent')), roughness: 0.3, emissive: new T.Color(farbe('--accent')), emissiveIntensity: 0.35, transparent: true, depthWrite: false });   // verdeckt keine Symbole
    else if (art === 'offen') m = new T.MeshStandardMaterial({ color: new T.Color(farbe('--warn')), roughness: 0.4 });
    else if (art === 'bogen') m = new T.MeshBasicMaterial({ color: new T.Color(farbe('--accent')), toneMapped: false });
    st.materialien[k] = m;
    return m;
  }

  // ------------------------------------------------------------ Schilder (Symbole, Winkel) als Sprites
  function schild(text, opt) {
    var c = document.createElement('canvas'), g = c.getContext('2d');
    var px = opt.px || 64, schrift = '700 ' + px + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.font = schrift;
    var w = Math.ceil(g.measureText(text).width) + (opt.hinter ? px : px * 0.3), h = Math.ceil(px * 1.45);
    c.width = w; c.height = h;
    g.font = schrift; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (opt.hinter) {
      g.fillStyle = opt.hinter; g.globalAlpha = 0.9;
      var r = h / 2;
      g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, h); g.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); g.fill();
      g.globalAlpha = 1;
    }
    g.fillStyle = opt.farbe; g.fillText(text, w / 2, h / 2 + px * 0.04);
    var tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: !opt.vorne, depthWrite: false, toneMapped: false }));
    sp.scale.set(opt.hoehe * w / h, opt.hoehe, 1);
    sp.renderOrder = opt.vorne ? 10 : 5;   // nach den Elektronenpaar-Wolken zeichnen
    st.wegwerfen.push(tex, sp.material);
    return sp;
  }

  // ------------------------------------------------------------ Modell aufbauen
  function leeren() {
    while (st.gruppe.children.length) st.gruppe.remove(st.gruppe.children[0]);
    st.schilder.forEach(function (s) { st.szene.remove(s.sprite); });
    st.wegwerfen.forEach(function (x) { x.dispose(); });
    st.wegwerfen = []; st.schilder = []; st.atome = {};
  }

  function stab(a, b, r, mat) {
    var richtung = new T.Vector3().subVectors(b, a), l = richtung.length();
    var mesh = new T.Mesh(st.zylinder, mat);
    mesh.position.copy(a).addScaledVector(richtung, 0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), richtung.normalize());
    mesh.scale.set(r, l, r);
    st.gruppe.add(mesh);
    return mesh;
  }
  function v3(p) { return new T.Vector3(p[0], p[1], p[2]); }

  /** Modell zeigen. analyse = M.analyse(m) aus der 2D-Ansicht, auswahl = { art, id } oder null. */
  function zeige(m, analyse, auswahl) {
    if (!st.bereit) return;
    st.letzte = { m: m, analyse: analyse };
    st.auswahl = auswahl && auswahl.art === 'atom' ? auswahl.id : null;
    leeren();
    var daten = R.berechne(m, { winkel: R.messwinkel(analyse) });
    var markierung = {};
    analyse.forEach(function (t) { t.meldungen.forEach(function (x) { if (x.atom) markierung[x.atom] = x.art; }); });
    var P = {};

    daten.atome.forEach(function (a) {
      var p = v3(a.p), r = RADIUS[a.el] || 0.4;
      P[a.id] = p;
      var mat = material('atom', a.el);
      if (a.id === st.auswahl || markierung[a.id] === 'fehler') {
        mat = mat.clone();
        mat.emissive = new T.Color(farbe(a.id === st.auswahl ? '--accent' : '--warn'));
        mat.emissiveIntensity = a.id === st.auswahl ? 0.55 : 0.35;
        st.wegwerfen.push(mat);
      }
      var kugel = new T.Mesh(st.kugel, mat);
      kugel.position.copy(p); kugel.scale.setScalar(r);
      kugel.userData.atom = a.id;
      st.gruppe.add(kugel);
      st.atome[a.id] = { mesh: kugel, r: r };
      if (a.id === st.auswahl) {
        var ring = new T.Mesh(new T.TorusGeometry(r * 1.32, 0.03, 10, 48), material('bogen', 'auswahl'));
        ring.position.copy(p);
        ring.userData.blickrichtung = true;
        st.wegwerfen.push(ring.geometry);
        st.gruppe.add(ring);
      }
      if (st.optionen.symbole) {
        var sp = schild(a.el, { farbe: HELLE_SCHRIFT[a.el] ? '#ffffff' : '#1d1c1a', hoehe: r * 0.95, px: 72 });
        st.szene.add(sp);
        st.schilder.push({ sprite: sp, atom: a.id, abstand: r * 1.02 });
      }
    });

    daten.bindungen.forEach(function (b) {
      var pa = P[b.a], pb = P[b.b];
      if (b.ordnung === 1) { stab(pa, pb, 0.085, material('bindung', 1)); return; }
      var n = v3(b.normale);
      for (var k = 0; k < b.ordnung; k++) {
        var o = (k - (b.ordnung - 1) / 2) * 0.17;
        stab(pa.clone().addScaledVector(n, o), pb.clone().addScaledVector(n, o), 0.058, material('bindung', 1));
      }
    });

    daten.extras.forEach(function (e) {
      var p = P[e.atom], r = st.atome[e.atom].r, d = v3(e.richtung);
      if (e.art === 'paar') {
        if (!st.optionen.paare) return;
        var mitte = p.clone().addScaledVector(d, r + 0.24);
        var wolke = new T.Mesh(st.kugel, material('paar', 1));
        wolke.position.copy(mitte);
        wolke.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
        wolke.scale.set(0.15, 0.27, 0.15);
        wolke.renderOrder = 2;
        st.gruppe.add(wolke);
        var quer = new T.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize();
        [-1, 1].forEach(function (s) {
          var punkt = new T.Mesh(st.kugel, material('elektron', 1));
          punkt.position.copy(mitte).addScaledVector(quer, s * 0.065);
          punkt.scale.setScalar(0.042);
          punkt.renderOrder = 3;
          st.gruppe.add(punkt);
        });
      } else {
        var anfang = p.clone().addScaledVector(d, r * 0.9), ende = p.clone().addScaledVector(d, r + 0.32);
        stab(anfang, ende, 0.03, material('offen', 1));
        var spitze = new T.Mesh(st.kugel, material('offen', 1));
        spitze.position.copy(ende); spitze.scale.setScalar(0.065);
        st.gruppe.add(spitze);
      }
    });

    winkelBogen(m, analyse, P);

    st.radius = Math.max(1.2, daten.radius);
    st.schatten.scale.set(st.radius * 1.7, st.radius * 1.1, 1);
    st.schatten.position.y = -st.radius * 0.85;
    st.schatten.visible = daten.atome.length > 0;
    st.canvas.setAttribute('aria-label', beschreibung(analyse));
    kameraSetzen();
  }

  /** Winkel an einem Zentralatom: beim ausgewählten Atom, sonst wenn es auf der Fläche genau ein Zentralatom gibt. */
  function winkelBogen(m, analyse, P) {
    var geo = [];
    analyse.forEach(function (t) { geo = geo.concat(t.geometrie); });
    var g = geo.filter(function (x) { return x.atom === st.auswahl; })[0] || (geo.length === 1 ? geo[0] : null);
    if (!g || !P[g.atom]) return;
    var nb = M.nachbarn(m, g.atom).map(function (x) { return x.id; });
    var mitte = P[g.atom], u = P[nb[0]].clone().sub(mitte).normalize(), v = P[nb[1]].clone().sub(mitte).normalize();
    var w = Math.acos(Math.max(-1, Math.min(1, u.dot(v))));
    if (w < 0.05) return;
    var r = (RADIUS[g.el] || 0.4) + 0.2, punkte = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24, a = Math.sin((1 - t) * w) / Math.sin(w), b = Math.sin(t * w) / Math.sin(w);
      if (w > Math.PI - 0.01) {   // gestreckt: Halbkreis über eine senkrechte Richtung
        var s = new T.Vector3().crossVectors(u, Math.abs(u.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize();
        var ang = t * Math.PI;
        punkte.push(mitte.clone().addScaledVector(u, r * Math.cos(ang)).addScaledVector(s, r * Math.sin(ang)));
      } else punkte.push(mitte.clone().addScaledVector(u, r * a).addScaledVector(v, r * b));
    }
    var rohr = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(punkte), 32, 0.018, 8, false), material('bogen', 1));
    st.wegwerfen.push(rohr.geometry);
    st.gruppe.add(rohr);
    var x = g.geometrie, text = g.gemessen ? U.fmt(g.gemessen, 1) + '° gemessen'
      : x.winkel ? U.fmt(x.winkel, x.winkel % 1 ? 1 : 0) + '° Modell'
      : (/120/.test(x.hinweis) ? '< 120°' : '< 109,5°') + ' Modell';
    var sp = schild(text, { farbe: farbe('--text'), hinter: farbe('--card'), hoehe: 0.17, px: 44, vorne: true });
    st.szene.add(sp);
    st.schilder.push({ sprite: sp, punkt: punkte[12].clone().sub(mitte).normalize().multiplyScalar(r + 0.32).add(mitte), abstand: 0 });
  }

  function beschreibung(analyse) {
    if (!analyse.length) return '3D-Modell: Die Fläche ist leer.';
    return '3D-Modell (Winkel nach dem Elektronenpaarabstoßungsmodell, Abstände nicht maßstäblich): ' + analyse.map(function (t) {
      var geo = t.geometrie.map(function (g) {
        return 'um ' + C.element(g.el).name + ' ' + GEO_NAME[g.geometrie.name] + (g.gemessen ? ', ' + U.fmt(g.gemessen, 1) + ' Grad gemessen' : g.geometrie.winkel ? ', ' + U.fmt(g.geometrie.winkel, g.geometrie.winkel % 1 ? 1 : 0) + ' Grad' : '');
      }).join('; ');
      return t.formel + (t.name ? ' (' + t.name + ')' : '') + (geo ? ': ' + geo : '');
    }).join('. ') + '.';
  }

  // ------------------------------------------------------------ Zeichnen
  function zeichneSpaeter() {
    if (!st.bereit || st.bild || !st.aktiv) return;
    st.bild = root.requestAnimationFrame(zeichnen);
  }
  var tmp = null;
  function zeichnen(zeit) {
    st.bild = 0;
    if (!st.aktiv) return;
    if (st.optionen.auto) {
      var dt = st.autoZeit ? Math.min(0.1, (zeit - st.autoZeit) / 1000) : 0;
      st.autoZeit = zeit;
      drehe(new T.Vector3(0, 1, 0), dt * 0.45, true);
    } else st.autoZeit = 0;
    st.gruppe.updateMatrixWorld(true);
    tmp = tmp || new T.Vector3();
    var kam = st.kamera.position;
    st.schilder.forEach(function (s) {
      if (s.atom !== undefined) {
        var p = st.atome[s.atom].mesh.getWorldPosition(tmp);
        s.sprite.position.copy(p).add(kam.clone().sub(p).normalize().multiplyScalar(s.abstand));
      } else s.sprite.position.copy(st.gruppe.localToWorld(s.punkt.clone()));
    });
    st.gruppe.children.forEach(function (o) { if (o.userData.blickrichtung) { o.quaternion.copy(st.gruppe.quaternion).invert(); } });
    st.renderer.render(st.szene, st.kamera);
    if (st.optionen.auto) zeichneSpaeter();
  }

  // ------------------------------------------------------------ Bedienung
  function drehe(achse, winkel, auto) {
    st.gruppe.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(achse, winkel));
    if (!auto) {
      st.gedreht += Math.abs(winkel);
      if (st.gedreht > Math.PI / 2 && st.cb.gedreht) st.cb.gedreht();
    }
    zeichneSpaeter();
  }
  function zoom(f) {
    st.zoom = Math.max(0.5, Math.min(3, st.zoom / f));
    kameraSetzen();
  }
  function zuruecksetzen() {
    st.zoom = 1; st.gruppe.quaternion.copy(startDrehung());
    kameraSetzen();
  }

  function runter(ev) {
    if (ev.button > 0) return;
    ev.preventDefault();
    try { st.canvas.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
    if (document.activeElement !== st.canvas) st.canvas.focus({ preventScroll: true });
    st.zeiger[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var ids = Object.keys(st.zeiger);
    if (ids.length === 2) {
      var a = st.zeiger[ids[0]], b = st.zeiger[ids[1]];
      st.geste = { art: 'zoom', d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) };
    } else if (ids.length === 1) st.geste = { art: 'drehen', start: { x: ev.clientX, y: ev.clientY }, bewegt: false, typ: ev.pointerType };
  }
  function bewegen(ev) {
    var alt = st.zeiger[ev.pointerId];
    if (!alt || !st.geste) return;
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
    var f = 2.6 / Math.max(200, st.canvas.clientWidth);
    if (neu.x !== alt.x) drehe(new T.Vector3(0, 1, 0), (neu.x - alt.x) * f * Math.PI / 2);
    if (neu.y !== alt.y) drehe(new T.Vector3(1, 0, 0), (neu.y - alt.y) * f * Math.PI / 2);
  }
  function hoch(ev) {
    var war = st.zeiger[ev.pointerId];
    delete st.zeiger[ev.pointerId];
    var g = st.geste;
    if (!war || !g) return;
    if (g.art === 'zoom') { if (!Object.keys(st.zeiger).length) st.geste = null; return; }
    st.geste = null;
    if (!g.bewegt && st.cb.waehle) st.cb.waehle(treffer(ev));
  }
  function abbrechen(ev) { delete st.zeiger[ev.pointerId]; st.geste = null; }

  function treffer(ev) {
    var r = st.canvas.getBoundingClientRect();
    var ndc = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    st.ray.setFromCamera(ndc, st.kamera);
    var ziele = Object.keys(st.atome).map(function (id) { return st.atome[id].mesh; });
    var t = st.ray.intersectObjects(ziele, false)[0];
    return t ? t.object.userData.atom : null;
  }

  function tasten(ev) {
    var schritt = Math.PI / 12;
    var d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[ev.key];
    if (d) { ev.preventDefault(); drehe(new T.Vector3(d[0] ? 1 : 0, d[1] ? 1 : 0, 0), (d[0] || d[1]) * schritt); return; }
    if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoom(0.8); }
    else if (ev.key === '-') { ev.preventDefault(); zoom(1.25); }
    else if (ev.key === '0' || ev.key === 'Home') { ev.preventDefault(); zuruecksetzen(); }
    else if (ev.key === 'Escape' && st.cb.waehle) st.cb.waehle(null);
  }

  // ------------------------------------------------------------ Schnittstelle für ansicht-molekuel.js
  function aktiv(an) {
    st.aktiv = !!an;
    if (an) { groesse(); zeichneSpaeter(); }
  }
  function option(name, wert) {
    st.optionen[name] = wert;
    if (name === 'auto') { st.autoZeit = 0; zeichneSpaeter(); return; }
    if (st.letzte) zeige(st.letzte.m, st.letzte.analyse, st.auswahl === null ? null : { art: 'atom', id: st.auswahl });
  }

  CL.molekuel3d = {
    verfuegbar: verfuegbar, start: start, zeige: zeige, aktiv: aktiv, zoom: zoom, zuruecksetzen: zuruecksetzen, option: option,
    optionen: function () { return st.optionen; },
    // Für Tests im Browser (Playwright)
    zustand: function () { return { bereit: st.bereit, atome: Object.keys(st.atome).length, gedreht: st.gedreht, zoom: st.zoom, schilder: st.schilder.length }; },
  };
})(window);
