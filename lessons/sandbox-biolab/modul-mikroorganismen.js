// BioLab · Modul Mikroorganismen: Amöbe, Pantoffeltierchen, Euglena, Bakterien, Größenvergleich
// Alle Bilder sind gezeichnete Modelle. Bewegungen sind vereinfacht, die beschriebenen Vorgänge entsprechen
// dem Schulbuchwissen (siehe Texte in daten-organismen.js).
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui, OR = BL.organismen;
  var VB_W = 640, VB_H = 420;

  var M = {
    titel: 'Mikroorganismen', kurz: 'Einzeller und Bakterien untersuchen: Bewegung, Nahrungsaufnahme, Lichtversuch, Bakterienformen und Größenvergleich.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M14 24 C14 12 30 8 42 12 C56 16 62 26 54 34 C46 42 24 40 18 34 C15 31 14 28 14 24 Z"/><circle cx="34" cy="24" r="5"/><path d="M14 20 l-6 -3 M14 26 l-7 1 M18 34 l-5 4 M54 34 l5 4 M58 24 l7 0"/></svg>',
    unter: [
      { wert: 'amoebe', text: 'Amöbe' }, { wert: 'pantoffeltierchen', text: 'Pantoffeltierchen' }, { wert: 'euglena', text: 'Euglena' },
      { wert: 'bakterien', text: 'Bakterien' }, { wert: 'groessen', text: 'Größenvergleich' },
    ],
  };
  var W, aktiv = null, A = {};

  // ------------------------------------------------------------------ gemeinsame Hilfen
  function buehne(label, h) {
    U.leeren(W.flaeche);
    var s = U.svg('svg', { viewBox: '0 0 ' + VB_W + ' ' + (h || VB_H), role: 'img', 'aria-label': label }, W.flaeche);
    return s;
  }
  function f1(x) { return Math.round(x * 10) / 10; }
  function glatt(pts) {
    var n = pts.length, d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return d + ' Z';
  }
  function winkelDiff(a, b) { var d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function el(tag, a, p, id, name) {
    var e = U.svg(tag, a, p);
    if (id) { e.setAttribute('data-s', id); e.classList.add('wahl'); if (name) e.setAttribute('aria-label', name); if (id === auswahlId) e.classList.add('gewaehlt'); }
    return e;
  }

  /** Werkzeugleiste: Start/Pause, Beschriftungen; liefert Zustand */
  var auswahlId = null, etiketten = true;
  function leiste(takt, extra) {
    U.leeren(W.leiste);
    if (takt) {
      var b = U.html('button', { type: 'button', class: 'primary', text: '❚❚ Anhalten' }, W.leiste);
      b.addEventListener('click', function () {
        if (takt.laeuft) { takt.aus(); b.textContent = '▶ Weiter'; } else { takt.an(); b.textContent = '❚❚ Anhalten'; }
      });
    }
    (extra || []).forEach(function (x) { W.leiste.appendChild(x); });
    var lab = U.html('label', { class: 'check' }, W.leiste);
    lab.innerHTML = '<input type="checkbox"' + (etiketten ? ' checked' : '') + '> Beschriftungen';
    lab.querySelector('input').addEventListener('change', function () { etiketten = this.checked; if (A[aktiv].neu) A[aktiv].neu(); });
  }
  /** Liste der Bestandteile als Knöpfe (auch für Tastatur) + Info */
  function bestandteile(box, org, fn) {
    var t = U.html('p', { class: 'feld-titel', text: 'Bestandteile' }, box);
    var l = U.html('div', { class: 'orgliste' }, box);
    Object.keys(org.strukturen).forEach(function (id) {
      var b = U.html('button', { type: 'button', text: org.strukturen[id].name, 'data-id': id }, l);
      b.addEventListener('click', function () { (fn || zeigeInfo)(org, id); });
    });
    return t;
  }
  function zeigeInfo(org, id) {
    auswahlId = id;
    var s = org.strukturen[id];
    U.info(W.info, { name: s.name, text: s.text, hinweis: org.name });
    if (A[aktiv].neu) A[aktiv].neu();
  }
  function orgInfo(org) { auswahlId = null; U.info(W.info, { name: org.name, text: org.text, hinweis: 'Größe: ' + org.groesse }); }

  // ------------------------------------------------------------------ Amöbe
  A.amoebe = (function () {
    var svg, g, takt, org = OR.amoebe, Z;
    function reset() {
      Z = { x: 300, y: 215, dir: 0.3, ziel: 0.3, r0: 62, lappen: [{ w: 0.3, amp: 24, ziel: 30 }], futter: null, phase: 'kriechen', tU: 0, vak: [], pv: Math.random() * 7, t: 0,
        koerner: Array.apply(null, Array(26)).map(function () { return { w: Math.random() * 6.28, q: Math.random() * 0.8 }; }) };
    }
    function radius(w) {
      var r = Z.r0;
      Z.lappen.forEach(function (l) { var d = winkelDiff(w, l.w); r += l.amp * Math.exp(-(d * d) / (2 * 0.3 * 0.3)); });
      return r;
    }
    function schritt(dt) {
      Z.t += dt;
      if (Z.futter && Z.phase === 'kriechen') Z.ziel = Math.atan2(Z.futter.y - Z.y, Z.futter.x - Z.x);
      else if (Z.phase === 'kriechen') {
        Z.ziel += (Math.random() - 0.5) * 0.9 * dt;
        var mx = VB_W / 2 - Z.x, my = VB_H / 2 - Z.y;
        if (Math.hypot(mx, my) > 140) Z.ziel = Math.atan2(my, mx);
      }
      Z.dir += Math.max(-0.7 * dt, Math.min(0.7 * dt, winkelDiff(Z.ziel, Z.dir)));
      var vorn = null;
      Z.lappen.forEach(function (l) { if (Math.abs(winkelDiff(l.w, Z.dir)) < 0.55) vorn = l; });
      if (Z.phase === 'kriechen') {
        if (!vorn) { vorn = { w: Z.dir, amp: 0, ziel: 26 + Math.random() * 12 }; Z.lappen.push(vorn); }
        vorn.w += winkelDiff(Z.dir, vorn.w) * Math.min(1, dt * 0.8);
      }
      Z.lappen.forEach(function (l) {
        var z = (l === vorn || l.halt) ? l.ziel : 0;
        l.amp += Math.max(-7 * dt, Math.min(9 * dt, z - l.amp));
      });
      Z.lappen = Z.lappen.filter(function (l) { return l.amp > 0.4 || l === vorn || l.halt; });
      if (Z.phase === 'kriechen' && vorn) {
        var v = 11 * Math.min(1, vorn.amp / 26);
        Z.x += Math.cos(Z.dir) * v * dt; Z.y += Math.sin(Z.dir) * v * dt;
      }
      // Nahrung erreicht: Scheinfüßchen umfließen sie
      if (Z.futter && Z.phase === 'kriechen') {
        var wf = Math.atan2(Z.futter.y - Z.y, Z.futter.x - Z.x), df = Math.hypot(Z.futter.x - Z.x, Z.futter.y - Z.y);
        if (df < radius(wf) + 6) {
          Z.phase = 'umfliessen'; Z.tU = 0;
          Z.lappen.forEach(function (l) { l.ziel = 0; });
          Z.lappen.push({ w: wf - 0.45, amp: 0, ziel: df - Z.r0 + 16, halt: true }, { w: wf + 0.45, amp: 0, ziel: df - Z.r0 + 16, halt: true });
        }
      }
      if (Z.phase === 'umfliessen') {
        Z.tU += dt;
        var wf2 = Math.atan2(Z.futter.y - Z.y, Z.futter.x - Z.x);
        Z.lappen.forEach(function (l) { if (l.halt) l.w += winkelDiff(wf2, l.w) * dt * 0.35; });
        if (Z.tU > 2.6) {
          // Nahrung liegt jetzt in einer Nahrungsvakuole im Zellinneren
          Z.vak.push({ dx: (Z.futter.x - Z.x) * 0.55, dy: (Z.futter.y - Z.y) * 0.55, alter: 0 });
          Z.futter = null; Z.phase = 'kriechen';
          Z.lappen.forEach(function (l) { l.halt = false; });
          meldung('Die Nahrung ist von einer Nahrungsvakuole umschlossen und wird jetzt verdaut.');
        }
      }
      Z.vak.forEach(function (v) {
        v.alter += dt;
        if (v.alter > 14) { var d = Math.hypot(v.dx, v.dy) || 1; v.dx += v.dx / d * 18 * dt; v.dy += v.dy / d * 18 * dt; }
      });
      Z.vak = Z.vak.filter(function (v) { return v.alter < 17.5; });
      Z.pv = (Z.pv + dt) % 7;
      Z.koerner.forEach(function (k) { k.w += winkelDiff(Z.dir, k.w) * dt * 0.15; k.q = Math.min(0.85, k.q + dt * 0.02); if (Math.random() < dt * 0.05) k.q = Math.random() * 0.4; });
      zeichne();
    }
    function zeichne() {
      U.leeren(g);
      var pts = [];
      for (var i = 0; i < 40; i++) { var w = i / 40 * Math.PI * 2, r = radius(w); pts.push([Z.x + Math.cos(w) * r, Z.y + Math.sin(w) * r]); }
      var d = glatt(pts);
      if (Z.futter) {
        var fg = U.svg('g', {}, g);
        U.svg('circle', { cx: Z.futter.x, cy: Z.futter.y, r: 10, fill: 'var(--b-chloro-f)', stroke: 'var(--b-chloro)', 'stroke-width': 1.5 }, fg);
        [[-3, -2], [3, 1], [-1, 4]].forEach(function (p) { U.svg('circle', { cx: Z.futter.x + p[0], cy: Z.futter.y + p[1], r: 2, fill: 'var(--b-chloro)' }, fg); });
      }
      el('path', { d: d, fill: 'var(--b-plasma)', stroke: 'none' }, g, 'zellplasma', 'Zellplasma');
      Z.koerner.forEach(function (k) {
        var r = radius(k.w) * k.q;
        U.svg('circle', { cx: f1(Z.x + Math.cos(k.w) * r), cy: f1(Z.y + Math.sin(k.w) * r), r: 1.6, fill: 'var(--muted)', opacity: 0.5, 'pointer-events': 'none' }, g);
      });
      Z.vak.forEach(function (v) {
        var f = Math.min(1, v.alter / 12), r = 11 * (1 - f * 0.6);
        el('circle', { cx: f1(Z.x + v.dx), cy: f1(Z.y + v.dy), r: f1(r), fill: v.alter < 12 ? 'var(--b-chloro-f)' : 'var(--bg)', stroke: 'var(--b-membran)', 'stroke-width': 1.3, opacity: 1 - Math.max(0, v.alter - 14) / 3.5 }, g, 'nahrungsvakuole', 'Nahrungsvakuole');
        if (v.alter < 12) U.svg('circle', { cx: f1(Z.x + v.dx), cy: f1(Z.y + v.dy), r: f1(r * 0.5 * (1 - f)), fill: 'var(--b-chloro)', 'pointer-events': 'none' }, g);
      });
      var pr = Z.pv < 6.3 ? 3 + Z.pv / 6.3 * 11 : 14 * (1 - (Z.pv - 6.3) / 0.7);
      var hinten = Z.dir + Math.PI, pvx = Z.x + Math.cos(hinten) * Z.r0 * 0.5, pvy = Z.y + Math.sin(hinten) * Z.r0 * 0.5;
      el('circle', { cx: f1(pvx), cy: f1(pvy), r: f1(Math.max(2, pr)), fill: 'var(--b-vak-f)', stroke: 'var(--b-vak)', 'stroke-width': 1.3 }, g, 'pulsierende_vakuole', 'Pulsierende Vakuole');
      var kx = Z.x + Math.cos(Z.dir + 2.2) * 18, ky = Z.y + Math.sin(Z.dir + 2.2) * 18;
      el('ellipse', { cx: f1(kx), cy: f1(ky), rx: 17, ry: 13, transform: 'rotate(' + f1(Z.dir * 57.3) + ' ' + f1(kx) + ' ' + f1(ky) + ')', fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 1.6 }, g, 'zellkern', 'Zellkern');
      // Spitze des vorderen Scheinfüßchens als Trefferfläche
      var spitzeR = radius(Z.dir), sx = Z.x + Math.cos(Z.dir) * (spitzeR - 14), sy = Z.y + Math.sin(Z.dir) * (spitzeR - 14);
      el('circle', { cx: f1(sx), cy: f1(sy), r: 15, fill: 'transparent' }, g, 'scheinfuesschen', 'Scheinfüßchen');
      el('path', { d: d, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 1.8 }, g);
      el('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': 10, 'pointer-events': 'stroke' }, g, 'zellmembran', 'Zellmembran');
      if (etiketten) {
        var mw = Z.dir - 1.4, mr = radius(mw);
        U.beschriftung(g, [
          { x: Z.x + Math.cos(mw) * mr, y: Z.y + Math.sin(mw) * mr, text: 'Zellmembran' },
          { x: kx, y: ky, text: 'Zellkern' },
          { x: sx, y: sy, text: 'Scheinfüßchen' },
          { x: pvx, y: pvy, text: 'Pulsierende Vakuole' },
          { x: Z.x + Math.cos(Z.dir - 2.6) * Z.r0 * 0.6, y: Z.y + Math.sin(Z.dir - 2.6) * Z.r0 * 0.6, text: 'Zellplasma' },
        ].concat(Z.vak.length ? [{ x: Z.x + Z.vak[0].dx, y: Z.y + Z.vak[0].dy, text: 'Nahrungsvakuole' }] : []).concat(Z.futter ? [{ x: Z.futter.x, y: Z.futter.y, text: 'Alge (Nahrung)' }] : []), VB_W, VB_H);
      }
    }
    var meldBox;
    function meldung(t) { if (meldBox) meldBox.textContent = t; }
    return {
      start: function () {
        reset();
        svg = buehne('Modell einer Amöbe, die kriecht und Nahrung umfließt');
        g = U.svg('g', {}, svg);
        U.auswahl(svg, function (id) { zeigeInfo(org, id); });
        takt = U.takt(function (dt) { schritt(dt); });
        var bF = U.html('button', { type: 'button', text: '+ Alge als Nahrung' });
        bF.addEventListener('click', function () {
          if (Z.futter || Z.phase !== 'kriechen') { meldung('Die Amöbe ist noch mit der letzten Alge beschäftigt.'); return; }
          var w = Math.random() * 6.28;
          Z.futter = { x: Math.max(40, Math.min(VB_W - 40, Z.x + Math.cos(w) * 170)), y: Math.max(40, Math.min(VB_H - 40, Z.y + Math.sin(w) * 130)) };
          meldung('Die Amöbe bildet Scheinfüßchen in Richtung der Alge.');
          if (!takt.laeuft) zeichne();
        });
        leiste(takt, [bF]);
        W.werkzeug.innerHTML = '';
        bestandteile(W.werkzeug, org);
        meldBox = U.html('p', { class: 'hinweisbox', 'aria-live': 'polite', text: 'Gib eine Alge hinzu und beobachte, wie die Amöbe sie umfließt.' }, W.werkzeug);
        U.html('p', { class: 'small muted', html: 'Echte Amöben kriechen nur wenige Mikrometer pro Sekunde. Die Bewegung ist hier stark beschleunigt.' }, W.werkzeug);
        orgInfo(org);
        U.art(W.art, 'modell');
        zeichne(); takt.an();
      },
      stop: function () { if (takt) takt.aus(); },
      neu: function () { zeichne(); },
    };
  })();

  // ------------------------------------------------------------------ Pantoffeltierchen
  A.pantoffeltierchen = (function () {
    var svg, gK, gV, gE, takt, org = OR.pantoffeltierchen, wimpern = [], t = 0, futter = false, kongo = false, teilchen = [], vak = [], gesammelt = 0, letzteVak = 0;
    var CX = 320, CY = 205, L = 500, B = 170;
    function P(x, y) { return [CX + x * L, CY + y * B]; }       // x in Längen, y in Breiten (relativ)
    var MUND = P(0.1, 0.36), SCHLUND = P(0.02, 0.12), AFTER = P(-0.27, 0.45);
    var WEG = [SCHLUND, P(-0.2, 0.2), P(-0.34, 0.0), P(-0.15, -0.24), P(0.2, -0.22), P(0.34, 0.02), P(0.18, 0.24), P(-0.1, 0.3), AFTER];
    function umriss() {
      var pts = [];
      for (var k = 0; k < 64; k++) {
        var a = k / 64 * Math.PI * 2, x = Math.cos(a) * 0.5, y = Math.sin(a) * 0.5;
        if (x < 0) y *= 0.86 + 0.14 * (1 + x / 0.5);
        if (y > 0 && x > -0.06 && x < 0.28) y -= 0.09 * Math.sin((x + 0.06) / 0.34 * Math.PI);   // Mundbucht
        pts.push(P(x, y));
      }
      return pts;
    }
    function aufWeg(f) {
      var n = WEG.length - 1, s = Math.min(n - 1e-6, f * n), i = Math.floor(s), u = s - i;
      return [WEG[i][0] + (WEG[i + 1][0] - WEG[i][0]) * u, WEG[i][1] + (WEG[i + 1][1] - WEG[i][1]) * u];
    }
    function farbe(f) {
      if (!kongo) return 'var(--b-mito)';
      // Kongorot: rot → blau (Inhalt wird sauer) → wieder rot
      if (f < 0.12 || f > 0.7) return '#d2452e';
      if (f < 0.25) return f < 0.185 ? '#a24a7a' : '#5a4fb0';
      if (f < 0.55) return '#3157c4';
      return f < 0.625 ? '#5a4fb0' : '#a24a7a';
    }
    function aufbauen() {
      svg = buehne('Modell eines Pantoffeltierchens mit Wimpern, Nahrungsvakuolen und pulsierenden Vakuolen');
      U.auswahl(svg, function (id) { zeigeInfo(org, id); });
      var pts = umriss(), d = glatt(pts);
      var gW = U.svg('g', {}, svg);
      wimpern = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length], nx = b[1] - a[1], ny = -(b[0] - a[0]), nl = Math.hypot(nx, ny) || 1;
        for (var k = 0; k < 2; k++) {
          var u = k / 2, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
          var lin = el('line', { x1: f1(x), y1: f1(y), x2: f1(x), y2: f1(y), stroke: 'var(--b-membran)', 'stroke-width': 1.1, 'stroke-linecap': 'round' }, gW, 'wimpern', 'Wimpern');
          wimpern.push({ el: lin, x: x, y: y, nx: nx / nl, ny: ny / nl, i: wimpern.length });
        }
      }
      el('path', { d: d, fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, svg, 'zellmembran', 'Zellmembran mit Pellicula');
      el('path', { d: 'M' + f1(MUND[0] + 46) + ' ' + f1(MUND[1] - 10) + ' Q' + f1(MUND[0]) + ' ' + f1(MUND[1] - 28) + ' ' + f1(SCHLUND[0]) + ' ' + f1(SCHLUND[1]) + ' Q' + f1(MUND[0] - 20) + ' ' + f1(MUND[1] - 6) + ' ' + f1(MUND[0] - 40) + ' ' + f1(MUND[1] + 2), fill: 'var(--b-organ)', stroke: 'var(--b-membran)', 'stroke-width': 1.4, opacity: 0.9 }, svg, 'mundfeld', 'Mundfeld und Zellmund');
      var gk = P(0.0, -0.06);
      el('path', { d: 'M' + f1(gk[0] - 55) + ' ' + f1(gk[1]) + ' C' + f1(gk[0] - 55) + ' ' + f1(gk[1] - 40) + ' ' + f1(gk[0] + 55) + ' ' + f1(gk[1] - 40) + ' ' + f1(gk[0] + 55) + ' ' + f1(gk[1]) + ' C' + f1(gk[0] + 55) + ' ' + f1(gk[1] + 26) + ' ' + f1(gk[0] + 20) + ' ' + f1(gk[1] + 22) + ' ' + f1(gk[0]) + ' ' + f1(gk[1] + 10) + ' C' + f1(gk[0] - 20) + ' ' + f1(gk[1] + 22) + ' ' + f1(gk[0] - 55) + ' ' + f1(gk[1] + 26) + ' ' + f1(gk[0] - 55) + ' ' + f1(gk[1]) + ' Z',
        fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 1.6 }, svg, 'grosskern', 'Großkern');
      el('circle', { cx: gk[0] + 66, cy: gk[1] - 6, r: 8, fill: 'var(--b-kern)', opacity: 0.85 }, svg, 'kleinkern', 'Kleinkern');
      el('circle', { cx: AFTER[0], cy: AFTER[1] - 4, r: 6, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2, 'stroke-dasharray': '3 2' }, svg, 'zellafter', 'Zellafter');
      gV = U.svg('g', {}, svg);
      gK = U.svg('g', {}, svg);
      gE = U.svg('g', {}, svg);
    }
    function schritt(dt) {
      t += dt;
      // Wimpernschlag in Wellen (metachron)
      wimpern.forEach(function (w) {
        var ph = Math.sin(t * 9 - w.i * 0.32), lx = w.nx * 11, ly = w.ny * 11, tx = -w.ny, ty = w.nx;
        var x2 = w.x + lx * 0.9 + tx * ph * 6, y2 = w.y + ly * 0.9 + ty * ph * 6;
        w.el.setAttribute('x2', f1(x2)); w.el.setAttribute('y2', f1(y2));
      });
      // Nahrung: Teilchen werden zum Mundfeld gestrudelt
      if (futter && teilchen.length < 26 && Math.random() < dt * 8) {
        var a = Math.random() * 2.6 + 0.2;
        teilchen.push({ x: MUND[0] + Math.cos(a) * 190, y: Math.min(VB_H - 8, MUND[1] + Math.sin(a) * 120 + 40), w: 0 });
      }
      teilchen.forEach(function (p) {
        var dx = MUND[0] - p.x, dy = MUND[1] - p.y, d = Math.hypot(dx, dy) || 1, v = 60;
        p.x += (dx / d * v + -dy / d * 35) * dt; p.y += (dy / d * v + dx / d * 35) * dt;
        if (d < 14) { p.weg = true; gesammelt++; }
      });
      teilchen = teilchen.filter(function (p) { return !p.weg; });
      if (gesammelt >= 3 && t - letzteVak > 2.5) { vak.push({ f: 0 }); gesammelt = 0; letzteVak = t; }
      vak.forEach(function (v) { v.f += dt / 32; });
      vak = vak.filter(function (v) { return v.f < 1; });
      zeichneVar();
    }
    function zeichneVar() {
      U.leeren(gV); U.leeren(gK); U.leeren(gE);
      vak.forEach(function (v, i) {
        var p = aufWeg(v.f), r = 11 - v.f * 6;
        el('circle', { cx: f1(p[0]), cy: f1(p[1]), r: f1(r), fill: farbe(v.f), 'fill-opacity': 0.75, stroke: 'var(--b-membran)', 'stroke-width': 1 }, gV, 'nahrungsvakuole', 'Nahrungsvakuole');
      });
      teilchen.forEach(function (p) { U.svg('circle', { cx: f1(p.x), cy: f1(p.y), r: 3, fill: kongo ? '#d2452e' : 'var(--b-mito)', 'pointer-events': 'none' }, gV); });
      [-0.3, 0.3].forEach(function (pos, j) {
        var c = P(pos, -0.2), ph = ((t / 4 + j * 0.5) % 1);
        var fuell = ph < 0.6 ? ph / 0.6 : 0, blase = ph < 0.6 ? 0.25 + fuell * 0.15 : ph < 0.85 ? 0.4 + (ph - 0.6) / 0.25 * 0.6 : 1 - (ph - 0.85) / 0.15;
        var rr = 4 + blase * 11;
        for (var s = 0; s < 7; s++) {
          var w = s / 7 * Math.PI * 2, l = 30;
          U.svg('line', { x1: f1(c[0] + Math.cos(w) * rr), y1: f1(c[1] + Math.sin(w) * rr), x2: f1(c[0] + Math.cos(w) * (rr + l)), y2: f1(c[1] + Math.sin(w) * (rr + l)), stroke: 'var(--b-vak)', 'stroke-width': 1.5 + fuell * 3, 'stroke-linecap': 'round', opacity: 0.7, 'pointer-events': 'none' }, gK);
        }
        el('circle', { cx: f1(c[0]), cy: f1(c[1]), r: f1(rr), fill: 'var(--b-vak-f)', stroke: 'var(--b-vak)', 'stroke-width': 1.4 }, gK, 'pulsierende_vakuole', 'Pulsierende Vakuole');
      });
      if (etiketten) {
        var gk = P(0, -0.06), wi = wimpern[Math.floor(wimpern.length * 0.7)];
        U.beschriftung(gE, [
          { x: wi.x + wi.nx * 8, y: wi.y + wi.ny * 8, text: 'Wimpern' },
          { x: P(-0.3, -0.2)[0], y: P(-0.3, -0.2)[1], text: 'Pulsierende Vakuole' },
          { x: gk[0] - 20, y: gk[1] - 10, text: 'Großkern' },
          { x: gk[0] + 66, y: gk[1] - 6, text: 'Kleinkern' },
          { x: MUND[0], y: MUND[1] - 14, text: 'Mundfeld' },
          { x: AFTER[0], y: AFTER[1] - 4, text: 'Zellafter' },
        ].concat(vak.length ? [{ x: aufWeg(vak[0].f)[0], y: aufWeg(vak[0].f)[1], text: 'Nahrungsvakuole' }] : []), VB_W, VB_H, { mitte: CX });
      }
    }
    return {
      start: function () {
        t = 0; vak = []; teilchen = []; gesammelt = 0; letzteVak = -5;
        aufbauen();
        takt = U.takt(schritt);
        leiste(takt);
        W.werkzeug.innerHTML = '';
        var lab = U.html('label', { class: 'check' }, W.werkzeug); lab.innerHTML = '<input type="checkbox" id="pt-futter"> Hefezellen als Nahrung zugeben';
        var lab2 = U.html('label', { class: 'check' }, W.werkzeug); lab2.innerHTML = '<input type="checkbox" id="pt-kongo"> Hefe mit Kongorot gefärbt';
        U.html('p', { class: 'small muted', text: org.kongorot }, W.werkzeug);
        U.$('pt-futter').addEventListener('change', function () { futter = this.checked; });
        U.$('pt-kongo').addEventListener('change', function () { kongo = this.checked; zeichneVar(); });
        bestandteile(W.werkzeug, org);
        orgInfo(org);
        U.art(W.art, 'modell', 'Wimpern und Vakuolen sind vergrößert gezeichnet; echte Pantoffeltierchen haben mehrere Tausend Wimpern.');
        schritt(0); takt.an();
      },
      stop: function () { if (takt) takt.aus(); },
      neu: function () { zeichneVar(); },
    };
  })();

  // ------------------------------------------------------------------ Euglena
  A.euglena = (function () {
    var svg, gDyn, gE, takt, org = OR.euglena, ansicht = 'aufbau', t = 0;
    var CX = 290, CY = 210, L = 430, B = 112;
    var licht = { an: true, x: 560, y: 80, hell: 0.8 }, tiere = [], gArena, gLicht, anteilBox;
    // hinten spitz, vorn abgerundet
    function breite(u) { u = Math.min(1, Math.max(0, u)); return u <= 0.62 ? B / 2 * Math.pow(u / 0.62, 0.85) : B / 2 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.62) / 0.38, 2))); }
    function koerper() {
      var o = [], un = [];
      for (var k = 0; k <= 40; k++) { var u = k / 40, x = CX - L / 2 + u * L; o.push([x, CY - breite(u)]); un.push([x, CY + breite(u)]); }
      return 'M' + o.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L') + ' L' + un.reverse().map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L') + ' Z';
    }
    function aufbauen() {
      svg = buehne('Modell eines Augentierchens (Euglena) mit Geißel, Augenfleck und Chloroplasten');
      U.auswahl(svg, function (id) { zeigeInfo(org, id); });
      el('path', { d: koerper(), fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, svg);
      var gC = U.svg('g', {}, svg), r = U.rng(7);
      for (var c = 0; c < 15; c++) {
        var u = 0.12 + r() * 0.62, x = CX - L / 2 + u * L, y = CY + (r() - 0.5) * breite(u) * 1.3;
        if (Math.hypot(x - (CX - 20), y - CY) < 36) continue;
        el('ellipse', { cx: f1(x), cy: f1(y), rx: 15, ry: 7, transform: 'rotate(' + f1((r() - 0.5) * 50) + ' ' + f1(x) + ' ' + f1(y) + ')', fill: 'var(--b-chloro-f)', stroke: 'var(--b-chloro)', 'stroke-width': 1.3 }, gC, 'chloroplast', 'Chloroplast');
      }
      [[0.3, -0.25], [0.42, 0.28], [0.55, -0.1], [0.24, 0.12], [0.62, 0.22]].forEach(function (p) {
        var x = CX - L / 2 + p[0] * L, y = CY + p[1] * B;
        el('rect', { x: f1(x - 8), y: f1(y - 3), width: 16, height: 6, rx: 3, fill: 'var(--card)', stroke: 'var(--muted)', 'stroke-width': 1 }, svg, 'paramylon', 'Paramylonkorn');
      });
      el('circle', { cx: CX - 20, cy: CY, r: 26, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 1.6 }, svg, 'zellkern', 'Zellkern');
      var rx = CX + L / 2 - 46;
      el('path', { d: 'M' + (CX + L / 2 - 4) + ' ' + (CY - 4) + ' Q' + (rx + 6) + ' ' + (CY - 6) + ' ' + (rx - 8) + ' ' + (CY - 14) + ' Q' + (rx - 24) + ' ' + CY + ' ' + (rx - 8) + ' ' + (CY + 14) + ' Q' + (rx + 6) + ' ' + (CY + 6) + ' ' + (CX + L / 2 - 4) + ' ' + (CY + 4) + ' Z', fill: 'var(--bg)', stroke: 'var(--b-membran)', 'stroke-width': 1.3 }, svg, 'geisselsaeckchen', 'Geißelsäckchen');
      el('ellipse', { cx: rx - 6, cy: CY - 24, rx: 9, ry: 6, fill: '#d2452e' }, svg, 'augenfleck', 'Augenfleck');
      gDyn = U.svg('g', {}, svg);
      gE = U.svg('g', {}, svg);
    }
    function zeichneAufbau() {
      U.leeren(gDyn); U.leeren(gE);
      var x0 = CX + L / 2 - 4, d = 'M' + (x0 - 40) + ' ' + CY + ' L' + x0 + ' ' + CY;
      for (var k = 1; k <= 30; k++) { var x = x0 + k * 7, y = CY + Math.sin(k * 0.5 - t * 9) * 12 * Math.min(1, k / 6); d += ' L' + f1(x) + ' ' + f1(y); }
      el('path', { d: d, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, gDyn);
      el('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': 12 }, gDyn, 'geissel', 'Geißel');
      var ph = (t / 5) % 1, rr = ph < 0.85 ? 4 + ph / 0.85 * 9 : 13 * (1 - (ph - 0.85) / 0.15);
      var rx = CX + L / 2 - 46;
      el('circle', { cx: rx - 16, cy: CY + 22, r: f1(Math.max(2, rr)), fill: 'var(--b-vak-f)', stroke: 'var(--b-vak)', 'stroke-width': 1.3 }, gDyn, 'pulsierende_vakuole', 'Pulsierende Vakuole');
      if (etiketten) {
        U.beschriftung(gE, [
          { x: x0 + 120, y: CY + Math.sin(17 * 0.5 - t * 9) * 12, text: 'Geißel' },
          { x: rx - 6, y: CY - 24, text: 'Augenfleck' },
          { x: rx - 10, y: CY, text: 'Geißelsäckchen' },
          { x: rx - 16, y: CY + 22, text: 'Pulsierende Vakuole' },
          { x: CX - 20, y: CY, text: 'Zellkern' },
          { x: CX - L / 2 + 0.3 * L, y: CY - 0.25 * B, text: 'Paramylonkorn' },
          { x: CX - L / 2 + 0.2 * L, y: CY + 8, text: 'Chloroplast' },
        ], VB_W, VB_H, { mitte: CX + 60 });
      }
    }
    // Lichtversuch
    function intensitaet(x, y) {
      if (!licht.an) return 0;
      var d = Math.hypot(x - licht.x, y - licht.y);
      return licht.hell * Math.exp(-(d * d) / (2 * 110 * 110));
    }
    function arena() {
      svg = buehne('Lichtversuch: Euglenen in einer Wasserschale. Tippe in die Schale, um die Lampe zu versetzen.');
      U.svg('rect', { x: 0, y: 0, width: VB_W, height: VB_H, rx: 16, fill: 'var(--bg)', stroke: 'var(--border)', 'stroke-width': 2 }, svg);
      var defs = U.svg('defs', {}, svg), rg = U.svg('radialGradient', { id: 'eu-licht' }, defs);
      U.svg('stop', { offset: '0%', 'stop-color': 'var(--lamp)', 'stop-opacity': 0.75 }, rg);
      U.svg('stop', { offset: '100%', 'stop-color': 'var(--lamp)', 'stop-opacity': 0 }, rg);
      gLicht = U.svg('g', {}, svg);
      gArena = U.svg('g', {}, svg);
      svg.addEventListener('click', function (e) {
        var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
        var q = p.matrixTransform(svg.getScreenCTM().inverse());
        licht.x = Math.max(20, Math.min(VB_W - 20, q.x)); licht.y = Math.max(20, Math.min(VB_H - 20, q.y));
        zeichneArena();
      });
      if (!tiere.length) {
        var r = U.rng(3);
        for (var i = 0; i < 30; i++) tiere.push({ x: 40 + r() * (VB_W - 80), y: 40 + r() * (VB_H - 80), w: r() * 6.28 });
      }
    }
    function schrittArena(dt) {
      tiere.forEach(function (a) {
        var I = intensitaet(a.x, a.y);
        if (licht.an && licht.hell > 0) {
          // positive Fototaxis: Drehung zur Lichtquelle, stärker bei mehr Licht; im Lichtfleck ungerichtet
          var ziel = Math.atan2(licht.y - a.y, licht.x - a.x), d = Math.hypot(licht.y - a.y, licht.x - a.x);
          if (d > 60) a.w += winkelDiff(ziel, a.w) * Math.min(1, dt * (0.6 + 2.5 * licht.hell));
        }
        a.w += (Math.random() - 0.5) * 3 * dt;
        var v = 34;
        a.x += Math.cos(a.w) * v * dt; a.y += Math.sin(a.w) * v * dt;
        if (a.x < 14 || a.x > VB_W - 14) { a.w = Math.PI - a.w; a.x = Math.max(14, Math.min(VB_W - 14, a.x)); }
        if (a.y < 14 || a.y > VB_H - 14) { a.w = -a.w; a.y = Math.max(14, Math.min(VB_H - 14, a.y)); }
      });
      zeichneArena();
    }
    function zeichneArena() {
      U.leeren(gLicht); U.leeren(gArena);
      if (licht.an) {
        U.svg('circle', { cx: licht.x, cy: licht.y, r: 260 * Math.sqrt(licht.hell + 0.05), fill: 'url(#eu-licht)' }, gLicht);
        U.svg('circle', { cx: licht.x, cy: licht.y, r: 12, fill: 'var(--lamp)', stroke: 'var(--line)', 'stroke-width': 1.5 }, gLicht);
        U.svg('text', { x: licht.x, y: licht.y - 18, 'text-anchor': 'middle', class: 'lbl', text: 'Licht' }, gLicht);
      }
      var drin = 0;
      tiere.forEach(function (a) {
        var g = U.svg('g', { transform: 'translate(' + f1(a.x) + ' ' + f1(a.y) + ') rotate(' + f1(a.w * 57.3) + ')' }, gArena);
        U.svg('path', { d: 'M-11 0 Q-4 -5 8 -3.5 Q12 0 8 3.5 Q-4 5 -11 0 Z', fill: 'var(--b-chloro)', stroke: 'var(--b-membran)', 'stroke-width': 0.8 }, g);
        U.svg('circle', { cx: 6, cy: -1.5, r: 1.6, fill: '#d2452e' }, g);
        U.svg('path', { d: 'M11 0 q4 -3 8 0 t8 0', fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 1 }, g);
        if (licht.an && Math.hypot(a.x - licht.x, a.y - licht.y) < 110) drin++;
      });
      if (anteilBox) anteilBox.textContent = licht.an ? Math.round(drin / tiere.length * 100) + ' %' : '–';
    }
    function schritt(dt) { t += dt; if (ansicht === 'aufbau') zeichneAufbau(); else schrittArena(dt); }
    function werkzeuge() {
      W.werkzeug.innerHTML = '';
      var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
      U.seg(seg, [{ wert: 'aufbau', text: 'Aufbau' }, { wert: 'licht', text: 'Lichtversuch' }], ansicht, function (v) { ansicht = v; bauen(); }, 'Ansicht');
      if (ansicht === 'aufbau') { bestandteile(W.werkzeug, org); orgInfo(org); U.art(W.art, 'modell'); return; }
      var box = U.html('div', {}, W.werkzeug);
      box.innerHTML = '<label class="check"><input type="checkbox" id="eu-an"' + (licht.an ? ' checked' : '') + '> Lampe an</label>' +
        '<label class="ctrl"><span>Helligkeit <output id="eu-hell-o"></output></span><input type="range" id="eu-hell" min="0.1" max="1" step="0.05" value="' + licht.hell + '"></label>' +
        '<p class="feld-titel">Lampe versetzen</p><div class="row eng" id="eu-pos"></div>' +
        '<div class="readouts"><div class="readout"><span>Euglenen im Lichtfleck</span><b id="eu-anteil">–</b></div></div>' +
        '<p class="small muted">' + U.esc(org.licht) + '</p>';
      [['oben rechts', 560, 80], ['unten links', 90, 340], ['Mitte', 320, 210]].forEach(function (q) {
        var b = U.html('button', { type: 'button', text: q[0] }, U.$('eu-pos'));
        b.addEventListener('click', function () { licht.x = q[1]; licht.y = q[2]; zeichneArena(); });
      });
      anteilBox = U.$('eu-anteil');
      var o = U.$('eu-hell-o'); o.textContent = Math.round(licht.hell * 100) + ' %';
      U.$('eu-an').addEventListener('change', function () { licht.an = this.checked; zeichneArena(); });
      U.$('eu-hell').addEventListener('input', function () { licht.hell = Number(this.value); o.textContent = Math.round(licht.hell * 100) + ' %'; zeichneArena(); });
      U.info(W.info, { name: 'Lichtversuch', text: 'Schalte die Lampe ein und aus, ändere die Helligkeit oder tippe in die Schale, um die Lampe zu versetzen. Beobachte, wohin die Euglenen schwimmen.', hinweis: 'Tipp: Vergleiche den Anteil im Lichtfleck mit Lampe an und aus.' });
      U.art(W.art, 'simulation', 'Die Schwimmrichtung folgt einer einfachen Regel: Drehung zur Lichtquelle, dazu zufällige Richtungsänderungen.');
    }
    function bauen() {
      if (ansicht === 'aufbau') { aufbauen(); zeichneAufbau(); } else { arena(); zeichneArena(); }
      werkzeuge();
    }
    return {
      start: function () { takt = U.takt(schritt); leiste(takt); bauen(); takt.an(); },
      stop: function () { if (takt) takt.aus(); },
      neu: function () { if (ansicht === 'aufbau') zeichneAufbau(); },
    };
  })();

  // ------------------------------------------------------------------ Bakterien
  A.bakterien = (function () {
    var svg, org = OR.bakterien, ansicht = 'formen', form = 'staebchen', zeigen = { kapsel: true, geissel: true, pili: true, plasmid: true, ribosom: true }, spieler, stunden = 2;
    var UM = 46;                                   // Bildpunkte pro µm in der Formen-Ansicht
    function stab(g, x, y, l, w, rot, geisseln) {
      var gg = U.svg('g', { transform: 'translate(' + f1(x) + ' ' + f1(y) + ') rotate(' + f1(rot) + ')' }, g);
      if (geisseln) for (var k = 0; k < geisseln; k++) {
        var a = k / geisseln * 6.28, sx = Math.cos(a) * l / 2, sy = Math.sin(a) * w / 2, d = 'M' + f1(sx) + ' ' + f1(sy);
        for (var j = 1; j < 12; j++) d += ' L' + f1(sx + Math.cos(a) * j * 7) + ' ' + f1(sy + Math.sin(a) * j * 7 + Math.sin(j) * 4);
        U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 1, opacity: 0.8 }, gg);
      }
      U.svg('rect', { x: -l / 2, y: -w / 2, width: l, height: w, rx: w / 2, fill: 'var(--b-bakt-f)', stroke: 'var(--b-bakt)', 'stroke-width': 1.6 }, gg);
    }
    function kokke(g, x, y, r) { U.svg('circle', { cx: f1(x), cy: f1(y), r: r, fill: 'var(--b-bakt-f)', stroke: 'var(--b-bakt)', 'stroke-width': 1.6 }, g); }
    function zeichneForm() {
      svg = buehne('Bakterienform im Modell, 1 µm entspricht ' + UM + ' Bildpunkten');
      var g = U.svg('g', {}, svg), r = U.rng(form.length * 31), R = 0.5 * UM, i, k;
      if (form === 'kokken') for (i = 0; i < 9; i++) kokke(g, 70 + r() * 500, 60 + r() * 280, R);
      if (form === 'diplokokken') for (i = 0; i < 6; i++) { var x = 80 + r() * 460, y = 70 + r() * 260, w = r() * 6.28; kokke(g, x, y, R * 0.95); kokke(g, x + Math.cos(w) * R * 1.85, y + Math.sin(w) * R * 1.85, R * 0.95); }
      if (form === 'streptokokken') for (i = 0; i < 3; i++) { var cx = 60 + i * 30, cy = 90 + i * 110, wk = (r() - 0.5) * 0.6; for (k = 0; k < 10; k++) { kokke(g, cx, cy, R); wk += (r() - 0.5) * 0.5; cx += Math.cos(wk) * R * 1.95; cy += Math.sin(wk) * R * 1.95; } }
      if (form === 'staphylokokken') [[200, 170], [450, 260]].forEach(function (c) { for (var j = 0; j < 16; j++) { var a = r() * 6.28, d = Math.sqrt(r()) * R * 3.6; kokke(g, c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d, R); } });
      if (form === 'staebchen') for (i = 0; i < 8; i++) stab(g, 80 + r() * 480, 70 + r() * 260, 2.4 * UM, 0.9 * UM, r() * 180, i % 2 ? 6 : 0);
      if (form === 'vibrionen') for (i = 0; i < 6; i++) {
        var vx = 90 + r() * 440, vy = 80 + r() * 240, vr = r() * 360;
        var gv = U.svg('g', { transform: 'translate(' + f1(vx) + ' ' + f1(vy) + ') rotate(' + f1(vr) + ')' }, g);
        U.svg('path', { d: 'M-40 8 Q0 -22 40 8', fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 0.75 * UM, 'stroke-linecap': 'round', opacity: 0.35 }, gv);
        U.svg('path', { d: 'M-40 8 Q0 -22 40 8', fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 2, 'stroke-linecap': 'round' }, gv);
        U.svg('path', { d: 'M48 12 q8 -6 16 0 t16 0 t16 0', fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 1 }, gv);
      }
      if (form === 'spirillen') for (i = 0; i < 4; i++) {
        var px = 80 + r() * 300, py = 70 + i * 85, d = 'M' + px + ' ' + py;
        for (k = 1; k <= 40; k++) d += ' L' + f1(px + k * 6.5) + ' ' + f1(py + Math.sin(k * 0.45) * 14);
        U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 0.6 * UM * 0.6, 'stroke-linecap': 'round', opacity: 0.45 }, g);
        U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      }
      // Maßstab
      U.svg('line', { x1: VB_W - 30 - UM, y1: VB_H - 22, x2: VB_W - 30, y2: VB_H - 22, stroke: 'var(--text)', 'stroke-width': 3 }, svg);
      U.svg('text', { x: VB_W - 30 - UM / 2, y: VB_H - 30, 'text-anchor': 'middle', class: 'lbl', text: '1 µm' }, svg);
      var f = org.formen.filter(function (x) { return x.id === form; })[0];
      U.info(W.info, { name: f.name, text: f.text + ' ' + f.beispiel + '.', hinweis: 'Die Form erkennt man erst mit dem Ölimmersionsobjektiv (1000-fach) nach Färbung.' });
    }
    // Aufbau einer Stäbchenbakterie
    var BX = 320, BY = 200, BL_ = 400, BW = 150;
    function zelle(g, cx, cy, l, w, teile, schnuer) {
      var t = teile || {};
      if (t.kapsel) el('rect', { x: cx - l / 2 - 16, y: cy - w / 2 - 16, width: l + 32, height: w + 32, rx: (w + 32) / 2, fill: 'var(--b-bakt-f)', 'fill-opacity': 0.35, stroke: 'var(--b-bakt)', 'stroke-dasharray': '5 4', 'stroke-width': 1.2 }, g, 'kapsel', 'Schleimkapsel');
      if (t.geissel) {
        var d = 'M' + (cx + l / 2) + ' ' + cy;
        for (var k = 1; k <= 22; k++) d += ' L' + f1(cx + l / 2 + k * 9) + ' ' + f1(cy + Math.sin(k * 0.7) * 12);
        el('path', { d: d, fill: 'none', stroke: 'var(--b-bakt)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
        el('path', { d: d, fill: 'none', stroke: 'transparent', 'stroke-width': 14 }, g, 'geissel', 'Geißel');
      }
      if (t.pili) for (var p = 0; p < 14; p++) {
        var a = p / 14 * 6.28, x = cx + Math.cos(a) * (l / 2 - (Math.abs(Math.cos(a)) < 0.9 ? 30 : 0)), y = cy + Math.sin(a) * w / 2;
        if (Math.abs(Math.cos(a)) > 0.95 && t.geissel && Math.cos(a) > 0) continue;
        el('line', { x1: f1(x), y1: f1(y), x2: f1(x + Math.cos(a) * 20), y2: f1(y + Math.sin(a) * 20), stroke: 'var(--b-bakt)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, g, 'pili', 'Pili');
      }
      var form = schnuer ? 'M' + (cx - l / 2 + w / 2) + ' ' + (cy - w / 2) + ' L' + (cx - 6) + ' ' + (cy - w / 2) + ' Q' + cx + ' ' + (cy - w / 2 + schnuer) + ' ' + (cx + 6) + ' ' + (cy - w / 2) + ' L' + (cx + l / 2 - w / 2) + ' ' + (cy - w / 2) + ' A' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + (cx + l / 2 - w / 2) + ' ' + (cy + w / 2) + ' L' + (cx + 6) + ' ' + (cy + w / 2) + ' Q' + cx + ' ' + (cy + w / 2 - schnuer) + ' ' + (cx - 6) + ' ' + (cy + w / 2) + ' L' + (cx - l / 2 + w / 2) + ' ' + (cy + w / 2) + ' A' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + (cx - l / 2 + w / 2) + ' ' + (cy - w / 2) + ' Z' : null;
      if (form) {
        el('path', { d: form, fill: 'var(--b-wand)', 'fill-opacity': 0.25, stroke: 'var(--b-wand)', 'stroke-width': 6 }, g, 'zellwand', 'Zellwand');
        el('path', { d: form, fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 1.5, transform: 'translate(' + cx + ' ' + cy + ') scale(0.965) translate(' + (-cx) + ' ' + (-cy) + ')' }, g, 'zellplasma', 'Zellplasma');
      } else {
        el('rect', { x: cx - l / 2, y: cy - w / 2, width: l, height: w, rx: w / 2, fill: 'var(--b-wand)', 'fill-opacity': 0.25, stroke: 'var(--b-wand)', 'stroke-width': 6 }, g, 'zellwand', 'Zellwand');
        el('rect', { x: cx - l / 2 + 7, y: cy - w / 2 + 7, width: l - 14, height: w - 14, rx: (w - 14) / 2, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2 }, g, 'zellmembran', 'Zellmembran');
        el('rect', { x: cx - l / 2 + 10, y: cy - w / 2 + 10, width: l - 20, height: w - 20, rx: (w - 20) / 2, fill: 'var(--b-plasma)' }, g, 'zellplasma', 'Zellplasma');
      }
    }
    function chromosom(g, cx, cy, s) {
      var r = U.rng(11), pts = [];
      for (var k = 0; k < 18; k++) { var a = k / 18 * 6.28; pts.push([cx + Math.cos(a) * (36 + r() * 18) * s, cy + Math.sin(a) * (20 + r() * 16) * s]); }
      el('path', { d: glatt(pts), fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g, 'chromosom', 'Bakterienchromosom');
    }
    function zeichneAufbau() {
      svg = buehne('Modell einer Stäbchenbakterie mit ihren Bestandteilen');
      U.auswahl(svg, function (id) { zeigeInfo(org, id); });
      var g = U.svg('g', {}, svg);
      zelle(g, BX - 40, BY, BL_, BW, zeigen);
      chromosom(g, BX - 60, BY, 1);
      if (zeigen.plasmid) [[BX + 80, BY - 32], [BX + 110, BY + 26], [BX - 190, BY + 30]].forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 9, fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': 2 }, g, 'plasmid', 'Plasmid'); });
      if (zeigen.ribosom) { var r = U.rng(5); for (var i = 0; i < 40; i++) { var x = BX - 40 + (r() - 0.5) * (BL_ - 70), y = BY + (r() - 0.5) * (BW - 40); el('circle', { cx: f1(x), cy: f1(y), r: 2.6, fill: 'var(--b-ribo)' }, g, 'ribosom', 'Ribosom'); } }
      if (etiketten) {
        var pkt = [
          { x: BX - 40, y: BY - BW / 2 + 3, text: 'Zellwand' },
          { x: BX - 40 - BL_ / 2 + 8, y: BY + 30, text: 'Zellmembran' },
          { x: BX - 60, y: BY - 30, text: 'Bakterienchromosom' },
          { x: BX - 150, y: BY - 20, text: 'Zellplasma' },
        ];
        if (zeigen.plasmid) pkt.push({ x: BX + 80, y: BY - 32, text: 'Plasmid' });
        if (zeigen.ribosom) pkt.push({ x: BX + 20, y: BY + 40, text: 'Ribosomen' });
        if (zeigen.kapsel) pkt.push({ x: BX - 40 - 60, y: BY - BW / 2 - 10, text: 'Schleimkapsel' });
        if (zeigen.geissel) pkt.push({ x: BX - 40 + BL_ / 2 + 120, y: BY + 8, text: 'Geißel' });
        if (zeigen.pili) pkt.push({ x: BX - 40 - 60, y: BY + BW / 2 + 12, text: 'Pili' });
        U.beschriftung(g, pkt, VB_W, VB_H, { mitte: BX - 40 });
      }
    }
    // Zweiteilung
    function zeichneTeilung(i, t) {
      if (!svg || !svg._teilung) { svg = buehne('Zweiteilung einer Bakterie in vier Schritten'); svg._teilung = true; }
      U.leeren(svg);
      var g = U.svg('g', {}, svg), l0 = 260, w = 120, s = Math.min(1, t * 1.0);
      var p = i + s;                                // Gesamtfortschritt 0 … 4
      var l = l0 + Math.min(1, p) * 150, cx = VB_W / 2, cy = VB_H / 2;
      if (p < 3) {
        var schnuer = p < 2 ? 0 : (p - 2) * w * 0.48;
        zelle(g, cx, cy, l, w, {}, schnuer || null);
        if (p < 1) chromosom(g, cx, cy, 0.8);
        else { var a = Math.min(1, p - 1); chromosom(g, cx - a * l * 0.24, cy, 0.7); if (p > 1.05) chromosom(g, cx + a * l * 0.24, cy, 0.7); }
      } else {
        var trenn = (p - 3) * 40, hl = l / 2 - 6;
        zelle(g, cx - hl / 2 - 6 - trenn, cy, hl, w, {}); chromosom(g, cx - hl / 2 - 6 - trenn, cy, 0.7);
        zelle(g, cx + hl / 2 + 6 + trenn, cy, hl, w, {}); chromosom(g, cx + hl / 2 + 6 + trenn, cy, 0.7);
      }
    }
    function teilungWerkzeug(box) {
      var pb = U.html('div', {}, box);
      spieler = U.player(pb, {
        schritte: [
          { titel: 'Wachstum', text: 'Die Bakterie nimmt Nährstoffe auf und wird länger.', dauer: 2.5 },
          { titel: 'DNA verdoppeln', text: 'Das ringförmige Bakterienchromosom wird kopiert. Die beiden Kopien wandern auseinander.', dauer: 3 },
          { titel: 'Einschnürung', text: 'In der Mitte wachsen Zellmembran und Zellwand nach innen – eine Querwand entsteht.', dauer: 2.5 },
          { titel: 'Trennung', text: 'Zwei gleiche Tochterzellen entstehen. Unter guten Bedingungen dauert das bei E. coli etwa 20 Minuten.', dauer: 2.5 },
        ],
        zeichne: zeichneTeilung,
      });
      var rech = U.html('div', { class: 'hinweisbox' }, box);
      rech.innerHTML = '<label class="ctrl"><span>Zeit unter idealen Bedingungen <output id="bk-h-o"></output></span><input type="range" id="bk-h" min="0" max="8" step="1" value="' + stunden + '"></label><p id="bk-rech" style="margin:0"></p>';
      function rechne() {
        var n = stunden * 3;                       // alle 20 Minuten eine Teilung
        U.$('bk-h-o').textContent = stunden + ' h';
        U.$('bk-rech').innerHTML = n + ' Teilungen: aus 1 Bakterium werden <span class="f">2<sup>' + n + '</sup></span> = <b>' + U.fmt(Math.pow(2, n), 0) + '</b>.<br><span class="small muted">Gilt nur, solange genug Nährstoffe da sind. In Wirklichkeit bremsen Nährstoffmangel und Abfallstoffe das Wachstum bald.</span>';
      }
      U.$('bk-h').addEventListener('input', function () { stunden = Number(this.value); rechne(); });
      rechne();
    }
    function werkzeuge() {
      W.werkzeug.innerHTML = '';
      var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
      U.seg(seg, [{ wert: 'formen', text: 'Formen' }, { wert: 'aufbau', text: 'Aufbau' }, { wert: 'teilung', text: 'Zweiteilung' }], ansicht, function (v) { ansicht = v; bauen(); }, 'Ansicht');
      if (ansicht === 'formen') {
        U.html('p', { class: 'feld-titel', text: 'Form' }, W.werkzeug);
        var fl = U.html('div', { class: 'orgliste' }, W.werkzeug);
        org.formen.forEach(function (f) {
          var b = U.html('button', { type: 'button', text: f.name, 'aria-pressed': f.id === form ? 'true' : 'false' }, fl);
          b.addEventListener('click', function () { form = f.id; fl.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); zeichneForm(); });
        });
        U.art(W.art, 'schema', 'Alle Formen im gleichen Maßstab (Balken = 1 µm).');
      } else if (ansicht === 'aufbau') {
        U.html('p', { class: 'feld-titel', text: 'Ein- und ausblenden' }, W.werkzeug);
        var cb = U.html('div', { class: 'checks' }, W.werkzeug);
        [['kapsel', 'Schleimkapsel'], ['geissel', 'Geißel'], ['pili', 'Pili'], ['plasmid', 'Plasmide'], ['ribosom', 'Ribosomen']].forEach(function (q) {
          var l = U.html('label', { class: 'check' }, cb); l.innerHTML = '<input type="checkbox"' + (zeigen[q[0]] ? ' checked' : '') + '> ' + q[1];
          l.querySelector('input').addEventListener('change', function () { zeigen[q[0]] = this.checked; zeichneAufbau(); });
        });
        U.html('p', { class: 'small muted', text: 'Nicht jede Bakterie hat Kapsel, Geißel, Pili oder Plasmide. Zellwand, Zellmembran, Zellplasma, Chromosom und Ribosomen haben alle.' }, W.werkzeug);
        bestandteile(W.werkzeug, org);
        orgInfo(org);
        U.art(W.art, 'modell', 'Ein Bakterium ist nur etwa 2 µm lang. Den inneren Aufbau zeigt erst das Elektronenmikroskop.');
      } else {
        teilungWerkzeug(W.werkzeug);
        U.info(W.info, { name: 'Zweiteilung', text: 'Bakterien vermehren sich ungeschlechtlich durch Zweiteilung. Beide Tochterzellen haben dieselbe Erbinformation.' });
        U.art(W.art, 'modell');
      }
    }
    function bauen() {
      if (svg) svg._teilung = false;
      leiste(null);
      if (ansicht === 'formen') zeichneForm(); else if (ansicht === 'aufbau') zeichneAufbau(); else zeichneTeilung(0, 0);
      werkzeuge();
    }
    return {
      start: function () { bauen(); },
      stop: function () { if (spieler) spieler.pause(); },
      neu: function () { if (ansicht === 'aufbau') zeichneAufbau(); },
    };
  })();

  // ------------------------------------------------------------------ Größenvergleich
  A.groessen = (function () {
    var modus = 'linear', breiteUm = 600;
    function form(g, typ, x, y, l) {
      var h = l;
      if (typ === 'virus') { U.svg('circle', { cx: x + l / 2, cy: y, r: l / 2, fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1 }, g); return; }
      if (typ === 'stab') { U.svg('rect', { x: x, y: y - l * 0.22, width: l, height: l * 0.44, rx: l * 0.22, fill: 'var(--b-bakt-f)', stroke: 'var(--b-bakt)', 'stroke-width': 1 }, g); return; }
      if (typ === 'scheibe') { U.svg('circle', { cx: x + l / 2, cy: y, r: l / 2, fill: 'var(--b-o2-f)', stroke: 'var(--b-o2)', 'stroke-width': 1 }, g); return; }
      if (typ === 'oval') { U.svg('ellipse', { cx: x + l / 2, cy: y, rx: l / 2, ry: l * 0.38, fill: 'var(--b-mito-f)', stroke: 'var(--b-mito)', 'stroke-width': 1 }, g); return; }
      if (typ === 'haar') { U.svg('rect', { x: x, y: y - 9, width: l, height: 18, fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 1 }, g); return; }
      var hh = typ === 'spindel' ? 0.22 : typ === 'pantoffel' ? 0.3 : typ === 'floh' ? 0.6 : 0.6;
      U.svg('ellipse', { cx: x + l / 2, cy: y, rx: l / 2, ry: Math.min(16, l * hh / 2), fill: typ === 'spindel' ? 'var(--b-chloro-f)' : 'var(--b-plasma)', stroke: typ === 'spindel' ? 'var(--b-chloro)' : 'var(--b-membran)', 'stroke-width': 1 }, g);
    }
    function zeichne() {
      var svg = buehne('Größenvergleich von Mikroorganismen und Zellen', 460), g = U.svg('g', {}, svg);
      var X0 = 190, X1 = VB_W - 20, zeilen = BL.groessen.slice().sort(function (a, b) { return a.um - b.um; });
      if (modus === 'linear') {
        var k = (X1 - X0) / breiteUm;
        zeilen.forEach(function (o, i) {
          var y = 30 + i * 46, l = o.um * k;
          U.svg('text', { x: 8, y: y + 4, class: 'lbl', text: o.name }, g);
          U.svg('text', { x: 8, y: y + 19, class: 'val', text: o.text }, g);
          if (l < 1) { U.svg('circle', { cx: X0, cy: y, r: 1.5, fill: 'var(--muted)' }, g); U.svg('text', { x: X0 + 8, y: y + 4, class: 'val', text: 'kleiner als ein Bildpunkt' }, g); return; }
          var sicht = Math.min(l, X1 - X0);
          var cp = 'gr-clip-' + i, defs = U.svg('defs', {}, g), c = U.svg('clipPath', { id: cp }, defs);
          U.svg('rect', { x: X0 - 2, y: y - 24, width: X1 - X0 + 4, height: 48 }, c);
          var gg = U.svg('g', { 'clip-path': 'url(#' + cp + ')' }, g);
          form(gg, o.form, X0, y, l);
          if (l > X1 - X0) U.svg('text', { x: X1, y: y - 14, 'text-anchor': 'end', class: 'val', text: 'geht weiter → (' + U.fmt(l / (X1 - X0), 1) + '-mal so breit)' }, g);
          if (l < 6 && sicht >= 1) U.svg('text', { x: X0 + l + 8, y: y + 4, class: 'val', text: 'winzig' }, g);
        });
        // Maßstab
        var ms = BL.optik.massstab(k, 80);
        U.svg('line', { x1: X0, y1: 440, x2: X0 + ms.px, y2: 440, stroke: 'var(--text)', 'stroke-width': 3 }, g);
        U.svg('text', { x: X0 + ms.px + 8, y: 444, class: 'lbl', text: BL.optik.laengeText(ms.um) }, g);
        U.svg('text', { x: X1, y: 444, 'text-anchor': 'end', class: 'val', text: 'Bildbreite: ' + BL.optik.laengeText(breiteUm) }, g);
      } else {
        // logarithmische Übersicht: jede Zehnerpotenz gleich breit
        var lo = -3, hi = 4, lx = function (um) { return 20 + (Math.log10(um) - lo) / (hi - lo) * (VB_W - 40); };
        U.svg('line', { x1: 20, y1: 230, x2: VB_W - 20, y2: 230, class: 'achse' }, g);
        for (var e = lo; e <= hi; e++) {
          var x = lx(Math.pow(10, e));
          U.svg('line', { x1: x, y1: 224, x2: x, y2: 236, class: 'achse' }, g);
          U.svg('text', { x: x, y: 252, 'text-anchor': 'middle', class: 'val', text: BL.optik.laengeText(Math.pow(10, e)) }, g);
        }
        zeilen.forEach(function (o, i) {
          var stufe = Math.floor(i / 2) % 3, x = lx(o.um), y = i % 2 ? 180 - stufe * 40 : 300 + stufe * 40;
          U.svg('line', { x1: x, y1: 230, x2: x, y2: y + (y < 230 ? 8 : -12), stroke: 'var(--muted)', 'stroke-width': 1 }, g);
          U.svg('circle', { cx: x, cy: 230, r: 4, fill: 'var(--accent)' }, g);
          U.svg('text', { x: x, y: y, 'text-anchor': 'middle', class: 'lbl', text: o.name }, g);
        });
        BL.grenzen.forEach(function (gz, i) {
          var x = lx(gz.um);
          U.svg('rect', { x: x, y: 36 + i * 10, width: VB_W - 20 - x, height: 7, rx: 3, fill: 'var(--accent)', opacity: 0.35 }, g);
          U.svg('line', { x1: x, y1: 30, x2: x, y2: 420, stroke: 'var(--accent)', 'stroke-dasharray': '4 4', 'stroke-width': 1.2 }, g);
          U.svg('text', { x: x + 4, y: 22, class: 'val', text: gz.name + ' ab ' + BL.optik.laengeText(gz.um) }, g);
        });
      }
    }
    return {
      start: function () {
        leiste(null);
        W.leiste.innerHTML = '';
        W.werkzeug.innerHTML = '';
        var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
        U.seg(seg, [{ wert: 'linear', text: 'Gleicher Maßstab' }, { wert: 'log', text: 'Übersicht (logarithmisch)' }], modus, function (v) { modus = v; zeichne(); regler.hidden = v !== 'linear'; }, 'Darstellung');
        var regler = U.html('label', { class: 'ctrl' }, W.werkzeug);
        regler.innerHTML = '<span>Bildbreite <output id="gr-o"></output></span><input type="range" id="gr-b" min="0" max="100" step="1">';
        var inp = regler.querySelector('input'), o = regler.querySelector('output');
        var zuUm = function (v) { return Math.pow(10, 0 + v / 100 * 3.7); }, vonUm = function (um) { return (Math.log10(um)) / 3.7 * 100; };
        inp.value = vonUm(breiteUm); o.textContent = BL.optik.laengeText(breiteUm);
        inp.addEventListener('input', function () { breiteUm = zuUm(Number(this.value)); o.textContent = BL.optik.laengeText(breiteUm); zeichne(); });
        regler.hidden = modus !== 'linear';
        var tab = U.html('div', { class: 'hinweisbox' }, W.werkzeug);
        tab.innerHTML = BL.grenzen.map(function (gz) { return '<p style="margin:0 0 4px"><b>' + U.esc(gz.name) + ':</b> ' + U.esc(gz.text) + '</p>'; }).join('');
        U.info(W.info, { name: 'Größenvergleich', text: 'Im gleichen Maßstab sieht man, wie unterschiedlich groß Mikroorganismen sind. Verschiebe die Bildbreite: Bei 1 mm Bildbreite ist ein Virus kleiner als ein Bildpunkt, bei wenigen Mikrometern passt kein Pantoffeltierchen mehr ins Bild.', hinweis: 'Größen sind typische, gerundete Werte.' });
        U.art(W.art, 'schema', 'Formen stark vereinfacht; die Längen sind maßstabsgetreu.');
        zeichne();
      },
      stop: function () {},
    };
  })();

  // ------------------------------------------------------------------ Modul-Steuerung
  function wechsle(id) {
    if (aktiv && A[aktiv].stop) A[aktiv].stop();
    aktiv = id; auswahlId = null;
    U.segSetze(W.unter, id);
    U.leeren(W.leiste); U.leeren(W.flaeche); W.werkzeug.innerHTML = ''; W.art.innerHTML = '';
    A[id].start();
    BL.unterGewechselt && BL.unterGewechselt('mikroorganismen', id);
  }
  M.init = function (panel) {
    W = U.werkbank(panel, { id: 'mo', unter: true });
    U.unterReiter(W.unter, M.unter, 'amoebe', wechsle);
  };
  M.zeigen = function (unter) {
    var ok = M.unter.some(function (u) { return u.wert === unter; });
    if (ok && unter !== aktiv) wechsle(unter);
    else if (!aktiv) wechsle('amoebe');
    else if (!ok || unter === aktiv) wechsle(aktiv);   // nach dem Zurückkehren Animation neu starten
    return aktiv;
  };
  M.verstecken = function () { if (aktiv && A[aktiv].stop) A[aktiv].stop(); };
  BL.module.mikroorganismen = M;
})(window);
