// BioLab · Modul Mikroskopie: virtuelles Lichtmikroskop
//
// Jedes Präparat wird als Schema in echten Maßen (µm) erzeugt. Das Sehfeld zeigt immer den Ausschnitt,
// den ein Schulmikroskop bei der gewählten Vergrößerung zeigt. Details werden nur gezeichnet, wenn sie
// mindestens einen Bildpunkt groß sind, und nur beschriftet und antippbar, wenn sie laut optik.js erkennbar
// sind (Auflösung des Objektivs und Größe auf dem Bildschirm). So entsteht kein erfundenes Detail durch Vergrößern.
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui, O = BL.optik;
  var D = 520, C = 260, R = 250;            // SVG-Größe, Mitte, Radius des Sehfelds in px
  var DURCHMESSER = 2 * R;

  // ------------------------------------------------------------------ Hilfen zum Erzeugen
  function f1(x) { return Math.round(x * 10) / 10; }
  function poly(pts) { return 'M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L') + ' Z'; }
  function rechteck(x, y, w, h) { return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  function imOval(x, y, a, b) { return (x * x) / (a * a) + (y * y) / (b * b) <= 1; }
  function zwischen(r, a, b) { return a + r() * (b - a); }
  /** Punkte einer geschlossenen, leicht unregelmäßigen Form (n Ecken) */
  function klecks(r, cx, cy, rad, n, unruhe) {
    var pts = [], ph = r() * 6.28;
    for (var i = 0; i < n; i++) {
      var a = ph + i / n * Math.PI * 2, q = rad * (1 - unruhe + r() * unruhe * 2);
      pts.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]);
    }
    return pts;
  }
  /** glatte geschlossene Kurve durch Punkte (Catmull-Rom → Bézier) */
  function glatt(pts) {
    var n = pts.length, d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return d + ' Z';
  }
  function dreh(px, py, cx, cy, w) { var c = Math.cos(w), s = Math.sin(w); return [cx + px * c - py * s, cy + px * s + py * c]; }

  // Ein „Teil“: { s (Struktur-ID oder null), f: 'c'|'e'|'p'|'l', Geometrie in µm, x, y, r (für Ausschnitt), g (Detailgröße µm),
  //              fill, stroke, sw (px), skal (Strichstärke in µm statt px), op, pe (pointer-events), dash }

  // ------------------------------------------------------------------ Präparate
  var GEN = {};

  GEN.zwiebel = function (r, opt) {
    var T = [], W = 2400, H = 1600, y = -H / 2, iod = opt.faerbung;
    while (y < H / 2) {
      var h = 44 + r() * 18, x = -W / 2 - r() * 300;
      while (x < W / 2) {
        var l = 170 + r() * 170, cx = x + l / 2, cy = y + h / 2;
        if (imOval(cx, cy, W / 2, H / 2)) {
          var nx = x + 14 + r() * (l - 28), ny = cy + (r() - 0.5) * (h - 28), rx = 8.5 + r() * 3, ry = 6.5 + r() * 2;
          T.push({ s: 'vakuole', f: 'p', d: rechteck(x + 2.5, y + 2.5, l - 5, h - 5), x: cx, y: cy, ax: nx < cx ? x + l * 0.78 : x + l * 0.22, ay: cy, r: l / 2, g: 40,
            fill: iod ? 'var(--mk-iod-f)' : 'rgba(255,255,255,0.01)', op: iod ? 0.45 : 1 });
          T.push({ s: 'zellwand', f: 'p', d: rechteck(x, y, l, h), x: cx, y: cy, ax: cx, ay: y, r: l / 2, g: 50, fill: 'none', stroke: 'var(--mk-linie)', sw: 1.3, pe: 'stroke' });
          T.push({ s: 'zellkern', f: 'e', cx: nx, cy: ny, rx: rx, ry: ry, x: nx, y: ny, r: rx, g: 15,
            fill: iod ? 'var(--mk-iod)' : '#ddd8c9', stroke: iod ? '#6b4a17' : '#a9a392', sw: 1, op: iod ? 0.85 : 0.6 });
          var nk = r() < 0.35 ? 2 : 1;
          for (var k = 0; k < nk; k++) {
            var kx = nx + (r() - 0.5) * rx * 0.8, ky = ny + (r() - 0.5) * ry * 0.6;
            T.push({ s: 'kernkoerperchen', f: 'c', cx: kx, cy: ky, rr: 1.5 + r() * 0.6, x: kx, y: ky, r: 2, g: 3, fill: iod ? '#4a3310' : '#9a9483', op: iod ? 0.9 : 0.7 });
          }
        }
        x += l;
      }
      y += h;
    }
    return { w: W, h: H, teile: T };
  };

  GEN.wasserpest = function (r) {
    var T = [], zellen = [], W = 2800, H = 700, y = -H / 2;
    // Blattrand (zweischichtiges Blatt, oval)
    T.push({ s: null, f: 'e', cx: 0, cy: 0, rx: W / 2 + 10, ry: H / 2 + 10, x: 0, y: 0, r: W, g: 1000, fill: 'rgba(120,170,90,0.10)', stroke: '#7a9a5f', sw: 1.5 });
    while (y < H / 2) {
      var h = 18 + r() * 8, x = -W / 2 - r() * 80;
      while (x < W / 2) {
        var l = 55 + r() * 40, cx = x + l / 2, cy = y + h / 2;
        if (imOval(cx, cy, W / 2, H / 2)) {
          T.push({ s: 'vakuole', f: 'p', d: rechteck(x + 1.5, y + 1.5, l - 3, h - 3), x: cx, y: cy, r: l / 2, g: 15, fill: 'rgba(110,170,90,0.30)' });
          T.push({ s: 'zellwand', f: 'p', d: rechteck(x, y, l, h), x: cx, y: cy, ax: cx, ay: y, r: l / 2, g: 20, fill: 'none', stroke: '#5f7d48', sw: 1.2, pe: 'stroke' });
          var n = 10 + Math.floor(r() * 7), ch = [];
          for (var k = 0; k < n; k++) ch.push({ p: (k + r() * 0.6) / n, v: 0.9 + r() * 0.2 });
          zellen.push({ x: x, y: y, l: l, h: h, cx: cx, cy: cy, ch: ch });
          // ruhende Lage der Chloroplasten (wird bei Bewegung durch die dynamische Ebene ersetzt)
        }
        x += l;
      }
      y += h;
    }
    // Plasmaströmung: Chloroplasten wandern im Plasmasaum an der Wand entlang (etwa 6 µm/s)
    function lage(z, p) {
      var a = z.l - 7, b = z.h - 7, u = 2 * (a + b), s = ((p % 1) + 1) % 1 * u, x0 = z.x + 3.5, y0 = z.y + 3.5;
      if (s < a) return [x0 + s, y0, 0];
      if (s < a + b) return [x0 + a, y0 + s - a, 90];
      if (s < 2 * a + b) return [x0 + a - (s - a - b), y0 + b, 180];
      return [x0, y0 + b - (s - 2 * a - b), 270];
    }
    function dyn(t, sicht) {
      var D2 = [];
      zellen.forEach(function (z) {
        if (Math.abs(z.cx - sicht.x) > sicht.r + z.l || Math.abs(z.cy - sicht.y) > sicht.r + z.h) return;
        var u = 2 * (z.l + z.h - 14);
        z.ch.forEach(function (c) {
          var q = lage(z, c.p + t * 6 * c.v / u);
          D2.push({ s: 'chloroplast', f: 'e', cx: q[0], cy: q[1], rx: 2.7, ry: 1.6, rot: q[2], x: q[0], y: q[1], r: 3, g: 5, fill: 'var(--mk-gruen, #3f9a4a)', stroke: '#2b6b33', sw: 0.6 });
        });
      });
      return D2;
    }
    return { w: W, h: H, teile: T, dyn: dyn, dynAb: 5 };
  };

  GEN.kartoffel = function (r, opt) {
    var T = [], W = 2400, H = 1800, S = 95, iod = opt.faerbung;
    // Sechseckgitter mit verschobenen, gemeinsamen Eckpunkten → zusammenhängende Zellwände
    var ecke = {};
    function e(i, j) {
      var k = i + ',' + j;
      if (!ecke[k]) { var rr = BL.ui.rng((i * 7349 + j * 9157 + 17) >>> 0); rr(); ecke[k] = [(rr() - 0.5) * 22, (rr() - 0.5) * 22]; }
      return ecke[k];
    }
    var dx = S * 1.5, dy = S * Math.sqrt(3);
    for (var i = -Math.ceil(W / dx / 2) - 1; i <= Math.ceil(W / dx / 2) + 1; i++) {
      for (var j = -Math.ceil(H / dy / 2) - 1; j <= Math.ceil(H / dy / 2) + 1; j++) {
        var cx = i * dx, cy = j * dy + (i & 1 ? dy / 2 : 0);
        if (!imOval(cx, cy, W / 2, H / 2)) continue;
        var pts = [];
        for (var k = 0; k < 6; k++) {
          var a = k * Math.PI / 3, vx = cx + S * Math.cos(a), vy = cy + S * Math.sin(a);
          var off = e(Math.round(vx * 2), Math.round(vy * 2));
          pts.push([vx + off[0], vy + off[1]]);
        }
        T.push({ s: 'zellwand', f: 'p', d: poly(pts), x: cx, y: cy, ax: (pts[4][0] + pts[5][0]) / 2, ay: (pts[4][1] + pts[5][1]) / 2, r: S, g: 60, fill: 'rgba(250,247,235,0.6)', stroke: 'var(--mk-linie)', sw: 1.1, pe: 'stroke' });
        var n = 4 + Math.floor(r() * 6), lage = [];
        for (var m = 0, versuch = 0; m < n && versuch < 60; versuch++) {
          var ang = r() * 6.28, d = r() * S * 0.6, gx = cx + Math.cos(ang) * d, gy = cy + Math.sin(ang) * d;
          var rx = 8 + r() * 16, ry = rx * (0.65 + r() * 0.2), rot = r() * 180;
          if (lage.some(function (q) { return Math.hypot(q[0] - gx, q[1] - gy) < (q[2] + rx) * 0.85; })) continue;
          lage.push([gx, gy, rx]); m++;
          T.push({ s: 'staerkekorn', f: 'e', cx: gx, cy: gy, rx: rx, ry: ry, rot: rot, x: gx, y: gy, r: rx, g: 12,
            fill: iod ? '#262a4f' : '#f1efe6', stroke: iod ? '#141633' : '#a7a293', sw: 0.9, op: iod ? 0.92 : 0.95 });
          // Schichtung: exzentrische Ringe um den Bildungspunkt (zum schmalen Ende hin verschoben)
          for (var q = 1; q <= 3; q++) {
            var f = 1 - q * 0.22, w = rot * Math.PI / 180, sh = rx * (1 - f) * 0.6;
            var sx = gx - Math.cos(w) * sh, sy = gy - Math.sin(w) * sh;
            T.push({ s: 'schichtung', f: 'e', cx: sx, cy: sy, rx: rx * f, ry: ry * f, rot: rot, x: sx, y: sy, ax: sx + Math.cos(w) * rx * f, ay: sy + Math.sin(w) * rx * f, r: rx * f, g: 2,
              fill: 'none', stroke: iod ? '#5a5f99' : '#c4bfaf', sw: 0.7, pe: 'stroke' });
          }
        }
      }
    }
    return { w: W, h: H, teile: T };
  };

  GEN.mundschleimhaut = function (r, opt) {
    var T = [], W = 1600, H = 1200, mb = opt.faerbung, n = 46;
    for (var i = 0; i < n; i++) {
      var cx = zwischen(r, -W / 2 + 60, W / 2 - 60), cy = zwischen(r, -H / 2 + 60, H / 2 - 60);
      var rad = 26 + r() * 10, pts = klecks(r, cx, cy, rad, 7 + Math.floor(r() * 3), 0.18);
      var d = poly(pts);
      T.push({ s: 'zellplasma', f: 'p', d: d, x: cx, y: cy, r: rad, g: 40, fill: mb ? 'var(--mk-blau-f)' : 'rgba(225,220,205,0.25)', op: mb ? 0.55 : 1 });
      T.push({ s: 'zellmembran', f: 'p', d: d, x: cx, y: cy, ax: pts[0][0], ay: pts[0][1], r: rad, g: 40, fill: 'none', stroke: mb ? '#6f8fcf' : '#bdb7a6', sw: 1.2, pe: 'stroke' });
      var kx = cx + (r() - 0.5) * 8, ky = cy + (r() - 0.5) * 8, kr = 4 + r() * 1.5;
      T.push({ s: 'zellkern', f: 'e', cx: kx, cy: ky, rx: kr, ry: kr * 0.85, rot: r() * 180, x: kx, y: ky, r: kr, g: 8,
        fill: mb ? 'var(--mk-blau)' : '#cfc9b8', stroke: mb ? '#24407e' : '#a39d8c', sw: 0.8, op: mb ? 0.9 : 0.6 });
      var nb = 6 + Math.floor(r() * 14);
      for (var b = 0; b < nb; b++) {
        var bx = cx + (r() - 0.5) * rad * 1.4, by = cy + (r() - 0.5) * rad * 1.4;
        if (r() < 0.6) T.push({ s: 'bakterien', f: 'c', cx: bx, cy: by, rr: 0.5, x: bx, y: by, r: 1, g: 2, fill: mb ? '#1d3570' : '#8c8676' });
        else { var w = r() * 3.14; T.push({ s: 'bakterien', f: 'l', x1: bx, y1: by, x2: bx + Math.cos(w) * 2.2, y2: by + Math.sin(w) * 2.2, x: bx, y: by, r: 2, g: 2, stroke: mb ? '#1d3570' : '#8c8676', sw: 0.7, skal: true }); }
      }
    }
    return { w: W, h: H, teile: T };
  };

  GEN.blut = function (r) {
    var T = [], W = 1200, H = 900, g = 8.6;
    // rote Blutkörperchen: lockeres Gitter mit Zufallsversatz (dünne Stelle des Ausstrichs)
    var ery = [];
    for (var x = -W / 2; x < W / 2; x += g) for (var y = -H / 2; y < H / 2; y += g) {
      if (r() < 0.32) continue;
      ery.push([x + (r() - 0.5) * 2.4, y + (r() - 0.5) * 2.4, 3.5 + r() * 0.5]);
    }
    T.push({ s: null, f: 'flaeche', x: 0, y: 0, r: W, g: 1000, muster: 'blut', w: W, h: H, bisPx: 3, groesse: 7 });
    ery.forEach(function (e) {
      T.push({ s: 'erythrozyt', f: 'c', cx: e[0], cy: e[1], rr: e[2], x: e[0], y: e[1], r: 4, g: 7, ab: 3, fill: 'var(--mk-rot-f)', stroke: 'var(--mk-rot)', sw: 0.8 });
      T.push({ s: 'erythrozyt', f: 'c', cx: e[0], cy: e[1], rr: e[2] * 0.38, x: e[0], y: e[1], r: 2, g: 7, ab: 3, fill: '#fbe6e1', op: 0.9 });
    });
    for (var i = 0; i < 46; i++) {
      var wx = zwischen(r, -W / 2 + 20, W / 2 - 20), wy = zwischen(r, -H / 2 + 20, H / 2 - 20);
      if (r() < 0.62) {
        T.push({ s: 'granulozyt', f: 'c', cx: wx, cy: wy, rr: 6, x: wx, y: wy, r: 6, g: 6, fill: '#e9dcef', stroke: '#9c80b0', sw: 0.8 });
        var lappen = 3 + Math.floor(r() * 2), w0 = r() * 6.28;
        for (var l = 0; l < lappen; l++) {
          var lx = wx + Math.cos(w0 + l * 1.4) * 2.6, ly = wy + Math.sin(w0 + l * 1.4) * 2.6;
          T.push({ s: 'granulozyt', f: 'c', cx: lx, cy: ly, rr: 1.7, x: lx, y: ly, r: 2, g: 6, fill: '#5b2d82', op: 0.9 });
        }
      } else {
        T.push({ s: 'lymphozyt', f: 'c', cx: wx, cy: wy, rr: 4.6, x: wx, y: wy, r: 5, g: 6, fill: '#c9d3f0', stroke: '#7d8cc0', sw: 0.8 });
        T.push({ s: 'lymphozyt', f: 'c', cx: wx + 0.4, cy: wy - 0.3, rr: 3.7, x: wx, y: wy, r: 4, g: 6, fill: '#3e2a78', op: 0.92 });
      }
    }
    for (var t = 0; t < ery.length / 18; t++) {
      var tx = zwischen(r, -W / 2, W / 2), ty = zwischen(r, -H / 2, H / 2);
      T.push({ s: 'thrombozyt', f: 'c', cx: tx, cy: ty, rr: 1.2, x: tx, y: ty, r: 1.5, g: 2, fill: '#7b4a9a', op: 0.85 });
    }
    return { w: W, h: H, teile: T };
  };

  GEN.joghurt = function (r) {
    var T = [], W = 600, H = 600;
    T.push({ s: null, f: 'e', cx: 0, cy: 0, rx: W / 2, ry: H / 2, x: 0, y: 0, r: W, g: 1000, fill: 'rgba(80,110,190,0.07)' });
    for (var i = 0; i < 1500; i++) {
      var x = zwischen(r, -W / 2, W / 2), y = zwischen(r, -H / 2, H / 2);
      if (!imOval(x, y, W / 2, H / 2)) continue;
      var w = r() * 3.14, l = 1 + r() * 1.2;
      T.push({ s: 'staebchen', f: 'l', x1: x - Math.cos(w) * l, y1: y - Math.sin(w) * l, x2: x + Math.cos(w) * l, y2: y + Math.sin(w) * l, x: x, y: y, r: 2, g: 2.5, stroke: '#2c4c9c', sw: 0.75, skal: true });
    }
    for (var c = 0; c < 260; c++) {
      var cx = zwischen(r, -W / 2, W / 2), cy = zwischen(r, -H / 2, H / 2), wk = r() * 6.28, n = 4 + Math.floor(r() * 6);
      if (!imOval(cx, cy, W / 2, H / 2)) continue;
      for (var k = 0; k < n; k++) {
        wk += (r() - 0.5) * 0.7;
        cx += Math.cos(wk) * 0.9; cy += Math.sin(wk) * 0.9;
        T.push({ s: 'kokken', f: 'c', cx: cx, cy: cy, rr: 0.42, x: cx, y: cy, r: 1, g: 3, fill: '#2c4c9c' });
      }
    }
    return { w: W, h: H, teile: T };
  };

  GEN.heuaufguss = function (r) {
    var W = 2400, H = 2400, tiere = [];
    for (var i = 0; i < 9; i++) {
      tiere.push({ x: zwischen(r, -W / 2 + 200, W / 2 - 200), y: zwischen(r, -H / 2 + 200, H / 2 - 200), w: r() * 6.28, dw: 0,
        l: 180 + r() * 50, ph: r() * 6.28, nv: [0.1, 0.25, 0.4, 0.55].map(function () { return [(r() - 0.5) * 0.9, (r() - 0.5) * 0.5, 2.5 + r() * 2]; }) });
    }
    // Umriss eines Pantoffeltierchens in eigenen Koordinaten (Länge L in x-Richtung, Mundfeld seitlich)
    function umriss(L) {
      var B = L * 0.28, pts = [];
      for (var k = 0; k < 28; k++) {
        var t = k / 28 * Math.PI * 2, x = Math.cos(t) * L / 2, y = Math.sin(t) * B / 2;
        if (x < 0) y *= 0.85 + 0.15 * (1 + x / (L / 2));        // Hinterende etwas schmaler
        if (y > 0 && x > -L * 0.1 && x < L * 0.2) y -= B * 0.12 * Math.sin((x + L * 0.1) / (L * 0.3) * Math.PI); // Mundbucht
        pts.push([x, y]);
      }
      return pts;
    }
    var letzt = 0;
    function bewege(t) {
      var dt = Math.max(0, Math.min(0.1, t - letzt)); letzt = t;
      tiere.forEach(function (a) {
        a.dw += (Math.random() - 0.5) * 2.4 * dt; a.dw *= 0.97;
        a.w += a.dw * dt * 3;
        var v = 420;                                  // µm/s, Pantoffeltierchen sind etwa 1 mm/s schnell
        a.x += Math.cos(a.w) * v * dt; a.y += Math.sin(a.w) * v * dt;
        if (Math.abs(a.x) > W / 2 - 100) { a.w = Math.PI - a.w; a.x = Math.sign(a.x) * (W / 2 - 101); }
        if (Math.abs(a.y) > H / 2 - 100) { a.w = -a.w; a.y = Math.sign(a.y) * (H / 2 - 101); }
      });
    }
    function dyn(t, sicht, laeuft) {
      if (laeuft) bewege(t); else letzt = t;
      var T = [];
      tiere.forEach(function (a) {
        if (Math.hypot(a.x - sicht.x, a.y - sicht.y) > sicht.r + a.l) return;
        var pts = umriss(a.l).map(function (p) { return dreh(p[0], p[1], a.x, a.y, a.w); });
        var aussen = umriss(a.l * 1.06).map(function (p) { return dreh(p[0] * 1.0, p[1] * 1.25, a.x, a.y, a.w); });
        T.push({ s: 'wimpern', f: 'p', d: glatt(aussen), x: a.x, y: a.y, ax: aussen[7][0], ay: aussen[7][1], r: a.l / 2, g: 3, fill: 'none', stroke: '#7d7a6c', sw: 0.35, skal: true, dash: '0.4 2.2', pe: 'stroke', op: 0.8 });
        var hinten = dreh(-a.l * 0.4, 0, a.x, a.y, a.w);
        T.push({ s: 'pantoffeltierchen', f: 'p', d: glatt(pts), x: a.x, y: a.y, ax: hinten[0], ay: hinten[1], r: a.l / 2, g: 60, fill: 'rgba(214,206,170,0.55)', stroke: '#8a826a', sw: 1.2 });
        var m = dreh(a.l * 0.05, a.l * 0.07, a.x, a.y, a.w);
        T.push({ s: 'mundfeld', f: 'e', cx: m[0], cy: m[1], rx: a.l * 0.11, ry: a.l * 0.035, rot: a.w * 180 / Math.PI, x: m[0], y: m[1], r: 12, g: 20, fill: 'rgba(140,130,100,0.35)', stroke: '#8a826a', sw: 0.8 });
        var k = dreh(a.l * 0.02, -a.l * 0.02, a.x, a.y, a.w);
        T.push({ s: 'grosskern', f: 'e', cx: k[0], cy: k[1], rx: a.l * 0.12, ry: a.l * 0.055, rot: a.w * 180 / Math.PI, x: k[0], y: k[1], r: 18, g: 15, fill: '#cbbf9a', stroke: '#8f8460', sw: 0.8 });
        a.nv.forEach(function (n) {
          var p = dreh(n[0] * a.l / 2, n[1] * a.l * 0.22, a.x, a.y, a.w);
          T.push({ s: 'nahrungsvakuole', f: 'c', cx: p[0], cy: p[1], rr: n[2], x: p[0], y: p[1], r: n[2], g: 6, fill: '#c2a26a', stroke: '#8e7344', sw: 0.6, op: 0.85 });
        });
        [-0.32, 0.32].forEach(function (pos, j) {
          var p = dreh(pos * a.l, 0, a.x, a.y, a.w);
          var puls = 0.5 + 0.5 * Math.sin(t * 1.6 + a.ph + j * 2.2);              // füllt sich und entleert sich
          var rr = 2 + puls * 5;
          T.push({ s: 'pulsierende_vakuole', f: 'c', cx: p[0], cy: p[1], rr: rr, x: p[0], y: p[1], r: 7, g: 8, fill: 'rgba(225,238,248,0.9)', stroke: '#7c97b3', sw: 0.8 });
          for (var s = 0; s < 6; s++) {
            var ws = a.w + s * Math.PI / 3, l2 = 6 + 6 * (1 - puls);
            T.push({ s: 'pulsierende_vakuole', f: 'l', x1: p[0] + Math.cos(ws) * rr, y1: p[1] + Math.sin(ws) * rr, x2: p[0] + Math.cos(ws) * (rr + l2), y2: p[1] + Math.sin(ws) * (rr + l2), x: p[0], y: p[1], r: 8, g: 8, stroke: '#a7bcd0', sw: 1.2, skal: true });
          }
        });
      });
      return T;
    }
    return { w: W, h: H, teile: [{ s: null, f: 'e', cx: 0, cy: 0, rx: W / 2, ry: H / 2, x: 0, y: 0, r: W, g: 1000, fill: 'rgba(200,190,140,0.06)' }], dyn: dyn, dynAb: 0, lebend: true, ziele: function () { return tiere.map(function (a) { return [a.x, a.y]; }); } };
  };

  GEN.spaltoeffnung = function (r, opt) {
    var T = [], W = 1300, H = 1000, Z = 52, offen = opt.offen;
    // Hintergrundzellen als Trefferflächen, darüber wellige Wände (Puzzle-Form)
    var nx = Math.ceil(W / Z), ny = Math.ceil(H / Z), x0 = -nx * Z / 2, y0 = -ny * Z / 2;
    for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) {
      var cx = x0 + (i + 0.5) * Z, cy = y0 + (j + 0.5) * Z;
      T.push({ s: 'epidermiszelle', f: 'p', d: rechteck(x0 + i * Z, y0 + j * Z, Z, Z), x: cx, y: cy, r: Z, g: 30, fill: 'rgba(240,238,228,0.02)' });
    }
    function welle(ax, ay, bx, by, amp, ph) {
      var n = 10, d = 'M' + f1(ax) + ' ' + f1(ay);
      for (var k = 1; k <= n; k++) {
        var t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, o = Math.sin(t * Math.PI * 3 + ph) * amp * Math.sin(t * Math.PI);
        if (ax === bx) x += o; else y += o;
        d += ' L' + f1(x) + ' ' + f1(y);
      }
      return d;
    }
    for (var a = 0; a <= nx; a++) for (var b = 0; b < ny; b++) {
      var xa = x0 + a * Z, ya = y0 + b * Z;
      T.push({ s: 'epidermiszelle', f: 'p', d: welle(xa, ya, xa, ya + Z, 6, r() * 3), x: xa, y: ya + Z / 2, ax: xa, ay: ya, r: Z, g: 30, fill: 'none', stroke: '#8f8a78', sw: 1.1, pe: 'stroke' });
    }
    for (var c = 0; c <= ny; c++) for (var e = 0; e < nx; e++) {
      var xb = x0 + e * Z, yb = y0 + c * Z;
      T.push({ s: 'epidermiszelle', f: 'p', d: welle(xb, yb, xb + Z, yb, 6, r() * 3), x: xb + Z / 2, y: yb, ax: xb, ay: yb, r: Z, g: 30, fill: 'none', stroke: '#8f8a78', sw: 1.1, pe: 'stroke' });
    }
    // Spaltöffnungen: Schließzellenpaare an zufälligen Zellecken
    for (var s = 0; s < (nx * ny) / 5; s++) {
      var sx = x0 + Math.round(r() * nx) * Z, sy = y0 + Math.round(r() * ny) * Z, w = r() * 180;
      if (!imOval(sx, sy, W / 2, H / 2)) continue;
      T.push({ s: 'epidermiszelle', f: 'e', cx: sx, cy: sy, rx: 24, ry: 19, rot: w, x: sx, y: sy, r: 24, g: 30, fill: '#f4f1e6', stroke: '#a7a290', sw: 1 });
      var spalt = 0.6 + offen * 3.2, rad = w * Math.PI / 180;
      [-1, 1].forEach(function (seite) {
        var pts = [];
        for (var k = 0; k <= 16; k++) {
          var t = k / 16 * Math.PI, xx = Math.cos(t) * 15, aussenY = seite * (spalt / 2 + 9 * Math.sin(t)), innenY = seite * (spalt / 2) * Math.sin(t);
          pts.push(dreh(xx, aussenY, sx, sy, rad));
          if (k === 16) for (var m = 16; m >= 0; m--) { var t2 = m / 16 * Math.PI; pts.push(dreh(Math.cos(t2) * 15, seite * (spalt / 2) * Math.sin(t2) * 0.9, sx, sy, rad)); }
        }
        T.push({ s: 'schliesszelle', f: 'p', d: poly(pts), x: sx, y: sy, r: 16, g: 8, fill: '#cfe3c0', stroke: '#5f7d48', sw: 1 });
        for (var q = 0; q < 6; q++) {
          var p = dreh(-10 + q * 4, seite * (spalt / 2 + 3.5 + (q % 2) * 1.8), sx, sy, rad);
          T.push({ s: 'chloroplast', f: 'c', cx: p[0], cy: p[1], rr: 1.2, x: p[0], y: p[1], r: 1.5, g: 3, fill: '#3f8a45' });
        }
      });
      var sp = [];
      for (var k2 = 0; k2 <= 12; k2++) { var t3 = k2 / 12 * Math.PI; sp.push(dreh(Math.cos(t3) * 14, (spalt / 2) * Math.sin(t3) * 0.9, sx, sy, rad)); }
      for (var k3 = 12; k3 >= 0; k3--) { var t4 = k3 / 12 * Math.PI; sp.push(dreh(Math.cos(t4) * 14, -(spalt / 2) * Math.sin(t4) * 0.9, sx, sy, rad)); }
      T.push({ s: 'spalt', f: 'p', d: poly(sp), x: sx, y: sy, r: 8, g: 5, fill: '#4b463a', op: 0.75 });
    }
    return { w: W, h: H, teile: T };
  };

  GEN.blattquerschnitt = function (r) {
    var T = [], W = 2000, top = -115, x;
    // Hintergrund: Lufträume im Schwammgewebe
    T.push({ s: 'interzellulare', f: 'p', d: rechteck(-W / 2, top + 92, W, 108), x: 0, y: top + 146, r: W, g: 10, fill: 'rgba(235,240,225,0.6)' });
    T.push({ s: 'kutikula', f: 'p', d: rechteck(-W / 2, top - 2.5, W, 2.5), x: 0, y: top, r: W, g: 3, fill: '#d8c46a', stroke: 'none' });
    for (x = -W / 2; x < W / 2;) {               // obere Epidermis
      var bw = 24 + r() * 12;
      T.push({ s: 'obere_epidermis', f: 'p', d: rechteck(x, top, bw, 19), x: x + bw / 2, y: top + 9, r: bw, g: 15, fill: 'rgba(250,250,245,0.9)', stroke: '#8f8a78', sw: 1 });
      x += bw;
    }
    for (x = -W / 2; x < W / 2;) {               // Palisadengewebe
      var pw = 12 + r() * 5, px0 = x + 0.8, py0 = top + 21, ph = 66 + r() * 6;
      T.push({ s: 'palisaden', f: 'p', d: 'M' + f1(px0) + ' ' + f1(py0 + 4) + ' Q' + f1(px0) + ' ' + f1(py0) + ' ' + f1(px0 + pw / 2) + ' ' + f1(py0) + ' Q' + f1(px0 + pw) + ' ' + f1(py0) + ' ' + f1(px0 + pw) + ' ' + f1(py0 + 4) + ' L' + f1(px0 + pw) + ' ' + f1(py0 + ph - 4) + ' Q' + f1(px0 + pw) + ' ' + f1(py0 + ph) + ' ' + f1(px0 + pw / 2) + ' ' + f1(py0 + ph) + ' Q' + f1(px0) + ' ' + f1(py0 + ph) + ' ' + f1(px0) + ' ' + f1(py0 + ph - 4) + ' Z',
        x: px0 + pw / 2, y: py0 + ph / 2, r: ph / 2, g: 12, fill: 'rgba(214,236,200,0.7)', stroke: '#6f8f58', sw: 0.9 });
      for (var k = 0; k < 12; k++) {
        var cxp = px0 + (k % 2 ? pw - 2.6 : 2.6), cyp = py0 + 6 + k * (ph - 12) / 11;
        T.push({ s: 'chloroplast', f: 'e', cx: cxp, cy: cyp, rx: 1.5, ry: 2.4, x: cxp, y: cyp, r: 2.5, g: 3, fill: '#3f8a45' });
      }
      x += pw + 1.6;
    }
    // Leitbündel in der Mitte
    var lx = 0, ly = top + 140;
    T.push({ s: 'leitbuendel', f: 'c', cx: lx, cy: ly, rr: 48, x: lx, y: ly, r: 48, g: 40, fill: 'rgba(245,240,225,0.95)', stroke: '#8f8a78', sw: 1.2 });
    for (var g = 0; g < 14; g++) {               // Gefäße des Holzteils (oben), dickwandig
      var gx = lx + (r() - 0.5) * 60, gy = ly - 6 - r() * 30;
      T.push({ s: 'leitbuendel', f: 'c', cx: gx, cy: gy, rr: 4 + r() * 3, x: gx, y: gy, r: 6, g: 5, fill: '#f6e9e2', stroke: '#a3483b', sw: 1.6 });
    }
    for (var h = 0; h < 24; h++) {               // Siebteil (unten), kleine dünnwandige Zellen
      var hx = lx + (r() - 0.5) * 58, hy = ly + 10 + r() * 26;
      T.push({ s: 'leitbuendel', f: 'c', cx: hx, cy: hy, rr: 2 + r() * 1.5, x: hx, y: hy, r: 3, g: 3, fill: '#efeee6', stroke: '#8f8a78', sw: 0.7 });
    }
    // Schwammgewebe
    var unten = top + 200;
    for (var s = 0; s < 260; s++) {
      var sx = zwischen(r, -W / 2 + 8, W / 2 - 8), sy = zwischen(r, top + 100, unten - 10);
      if (Math.hypot(sx - lx, sy - ly) < 56) continue;
      var rad = 9 + r() * 6, pts = klecks(r, sx, sy, rad, 7, 0.22);
      T.push({ s: 'schwamm', f: 'p', d: glatt(pts), x: sx, y: sy, r: rad, g: 15, fill: 'rgba(220,236,205,0.85)', stroke: '#6f8f58', sw: 0.8 });
      for (var c = 0; c < 4; c++) {
        var a = c * 1.57 + r(), q = dreh(rad * 0.62, 0, sx, sy, a);
        T.push({ s: 'chloroplast', f: 'c', cx: q[0], cy: q[1], rr: 1.4, x: q[0], y: q[1], r: 2, g: 3, fill: '#3f8a45' });
      }
    }
    // untere Epidermis mit Spaltöffnungen
    var spalten = [-700, -260, 330, 760];
    for (x = -W / 2; x < W / 2;) {
      var uw = 20 + r() * 12, nah = spalten.some(function (p) { return Math.abs(x + uw / 2 - p) < 18; });
      if (!nah) T.push({ s: 'untere_epidermis', f: 'p', d: rechteck(x, unten, uw, 15), x: x + uw / 2, y: unten + 7, r: uw, g: 12, fill: 'rgba(250,250,245,0.9)', stroke: '#8f8a78', sw: 1 });
      x += uw;
    }
    spalten.forEach(function (p) {
      T.push({ s: 'interzellulare', f: 'e', cx: p, cy: unten - 10, rx: 22, ry: 14, x: p, y: unten - 10, r: 20, g: 10, fill: 'rgba(235,240,225,0.95)' });
      [-1, 1].forEach(function (seite) {
        T.push({ s: 'spaltoeffnung', f: 'e', cx: p + seite * 6, cy: unten + 6, rx: 5, ry: 7, x: p, y: unten + 6, r: 10, g: 10, fill: '#cfe3c0', stroke: '#5f7d48', sw: 1 });
      });
    });
    return { w: W, h: 330, teile: T };
  };

  GEN.komplexauge = function () {
    var T = [], RA = 600, A = 25;              // Augenradius, Facettenabstand in µm
    T.push({ s: null, f: 'c', cx: 0, cy: 0, rr: RA * 1.5, x: 0, y: 0, r: RA * 2, g: 1000, fill: '#4b3a2c' });
    T.push({ s: 'auge', f: 'c', cx: 0, cy: 0, rr: RA, x: 0, y: 0, r: RA, g: 300, fill: '#8e2f22', stroke: '#3b1d14', sw: 1.5 });
    // Sechseckgitter auf der Augenoberfläche, senkrecht von oben gesehen (Halbkugel → am Rand verkürzt)
    function proj(u, v) {
      var s = Math.hypot(u, v), th = s / RA;
      if (th >= Math.PI / 2 * 0.97) return null;
      var rr = RA * Math.sin(th), f = s ? rr / s : 1;
      return [u * f, v * f];
    }
    var n = Math.ceil(RA * 1.6 / A);
    for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++) {
      var u = i * A * 0.866, v = j * A + (i & 1 ? A / 2 : 0);   // Spalten versetzt → Sechsecke mit flacher Oberseite
      var c = proj(u, v);
      if (!c) continue;
      var pts = [], ok = true;
      for (var k = 0; k < 6; k++) {
        var w = k * Math.PI / 3, p = proj(u + Math.cos(w) * A * 0.574, v + Math.sin(w) * A * 0.574);
        if (!p) { ok = false; break; }
        pts.push(p);
      }
      if (!ok) continue;
      T.push({ s: 'facette', f: 'p', d: poly(pts), x: c[0], y: c[1], r: A, g: 15, fill: '#b5473a', stroke: '#5b2219', sw: 0.8 });
      T.push({ s: 'facette', f: 'c', cx: c[0] - A * 0.12, cy: c[1] - A * 0.14, rr: A * 0.1, x: c[0], y: c[1], r: A / 2, g: 15, fill: '#f1c7b8', op: 0.55, pe: 'none' });
    }
    return { w: RA * 2.4, h: RA * 2.4, teile: T, auflicht: true };
  };

  // ------------------------------------------------------------------ Modul
  var M = {
    titel: 'Mikroskopie', kurz: 'Virtuelles Lichtmikroskop: Präparate wählen, Objektiv wechseln, verschieben, scharf stellen und Strukturen bestimmen.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 6 l8 0 M34 6 v6 M28 12 h12 l-2 14 h-8 z M34 26 v4 M22 36 h24 M26 36 c0-6 2-10 8-10 M18 42 h36 M50 42 c2-8-2-16-10-20"/></svg>',
    unter: null,
  };
  var S = { prep: null, obj: 4, cx: 0, cy: 0, z: 0, z0: 0, faerbung: true, offen: 0.7, etiketten: true, ruhig: false, sel: null };
  var W, svg, gFeld, gSzene, gStatisch, gDyn, gOben, blur, prepDaten, gen, taktGeber, zeit = 0;

  M.init = function (panel) {
    W = U.werkbank(panel, { id: 'mk' });
    U.art(W.art, 'schema', 'Die Präparate sind in echten Größen gezeichnet (Maßstab im Bild). Details erscheinen erst, wenn die Vergrößerung sie auflösen kann.');
    // Werkzeuge
    W.werkzeug.innerHTML =
      '<label class="feld-titel" for="mk-prep">Präparat</label>' +
      '<select id="mk-prep" class="bl-select"></select>' +
      '<p class="small muted" id="mk-herst"></p>' +
      '<p class="feld-titel">Objektiv</p><div id="mk-obj" class="objektive"></div>' +
      '<label class="ctrl" style="margin-top:10px"><span>Feintrieb (Fokus) <output id="mk-fokus-o"></output></span>' +
      '<input type="range" id="mk-fokus" min="-30" max="30" step="0.25" value="0" aria-describedby="mk-schaerfe"></label>' +
      '<div class="row eng"><button type="button" id="mk-auto">Scharf stellen</button></div>' +
      '<div id="mk-zusatz"></div>' +
      '<label class="check"><input type="checkbox" id="mk-eti" checked> Beschriftungen</label>' +
      '<p class="feld-titel">Im Bild erkennbar</p><div class="orgliste" id="mk-liste"></div>' +
      '<div class="readouts">' +
        '<div class="readout"><span>Vergrößerung</span><b id="mk-r-v">–</b></div>' +
        '<div class="readout"><span>Sehfeld</span><b id="mk-r-sf">–</b></div>' +
        '<div class="readout"><span>Auflösung</span><b id="mk-r-a">–</b></div>' +
      '</div>' +
      '<p class="small" id="mk-schaerfe" aria-live="polite"></p>';
    var sel = U.$('mk-prep'), gruppen = {};
    BL.praeparate.forEach(function (p) {
      if (!gruppen[p.gruppe]) { gruppen[p.gruppe] = U.html('optgroup', { label: p.gruppe }, sel); }
      U.html('option', { value: p.id, text: p.name }, gruppen[p.gruppe]);
    });
    sel.addEventListener('change', function () { waehlePraeparat(sel.value); });
    U.$('mk-fokus').addEventListener('input', function () { S.z = Number(this.value); fokus(); });
    U.$('mk-auto').addEventListener('click', function () { S.z = Math.round(S.z0 * 4) / 4; U.$('mk-fokus').value = S.z; fokus(); });
    U.$('mk-eti').addEventListener('change', function () { S.etiketten = this.checked; zeichneOben(); });

    // Bühne: rundes Sehfeld
    W.flaeche.innerHTML = '<div class="mk-wrap"></div><div class="mk-steuer" role="group" aria-label="Präparat verschieben">' +
      '<span></span><button type="button" data-d="0,-1" aria-label="nach oben">↑</button><span></span>' +
      '<button type="button" data-d="-1,0" aria-label="nach links">←</button><button type="button" data-d="0,0" aria-label="zur Mitte">◎</button><button type="button" data-d="1,0" aria-label="nach rechts">→</button>' +
      '<span></span><button type="button" data-d="0,1" aria-label="nach unten">↓</button><span></span></div>' +
      '<p class="small muted" style="text-align:center;margin:6px 0 0">Ziehen oder Pfeiltasten verschieben den Ausschnitt.</p>';
    var wrap = W.flaeche.querySelector('.mk-wrap');
    svg = U.svg('svg', { viewBox: '0 0 ' + D + ' ' + D, class: 'mk', role: 'img', tabindex: '0', 'aria-label': 'Sehfeld des Mikroskops. Mit den Pfeiltasten verschieben, Strukturen antippen.' }, wrap);
    var defs = U.svg('defs', {}, svg);
    var cp = U.svg('clipPath', { id: 'mk-clip' }, defs);
    U.svg('circle', { cx: C, cy: C, r: R }, cp);
    var fl = U.svg('filter', { id: 'mk-blur', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    blur = U.svg('feGaussianBlur', { stdDeviation: 0 }, fl);
    var pat = U.svg('pattern', { id: 'mk-blut', patternUnits: 'userSpaceOnUse', width: 17, height: 17 }, defs);
    [[3, 4], [11, 2], [7, 11], [15, 13], [1, 14]].forEach(function (p) { U.svg('circle', { cx: p[0], cy: p[1], r: 3.7, fill: '#f0b3a9', stroke: '#c4473b', 'stroke-width': 0.5 }, pat); });
    U.svg('rect', { x: 0, y: 0, width: D, height: D, class: 'mk-rand' }, svg);
    gFeld = U.svg('g', { 'clip-path': 'url(#mk-clip)' }, svg);
    U.svg('circle', { cx: C, cy: C, r: R, class: 'mk-feld' }, gFeld);
    var gBlur = U.svg('g', { filter: 'url(#mk-blur)' }, gFeld);
    gSzene = U.svg('g', {}, gBlur);
    gStatisch = U.svg('g', {}, gSzene);
    gDyn = U.svg('g', {}, gSzene);
    gOben = U.svg('g', {}, gFeld);

    bedienung(wrap);
    U.auswahl(svg, function (id, el) { waehle(id, el); });
    taktGeber = U.takt(function (dt) {
      if (!gen || !gen.dyn) return;
      if (!S.ruhig) zeit += dt;
      zeichneDyn(true);
    });
    waehlePraeparat(BL.praeparate[0].id);
  };

  function waehlePraeparat(id) {
    listeSchluessel = null; dynGezeichnet = [];
    prepDaten = BL.praeparate.filter(function (p) { return p.id === id; })[0];
    U.$('mk-prep').value = id;
    S.prep = id; S.cx = 0; S.cy = 0; S.sel = null; zeit = 0;
    S.z0 = Math.round((Math.random() - 0.5) * 24 * 4) / 4;    // Präparat liegt nicht exakt in der Fokusebene
    S.z = 0; U.$('mk-fokus').value = 0;
    if (S.obj > prepDaten.maxObjektiv) S.obj = prepDaten.maxObjektiv;
    var h = '<b>Herstellung:</b> ' + prepDaten.herstellung;
    if (prepDaten.hinweis) h += '<br>' + prepDaten.hinweis;
    U.$('mk-herst').innerHTML = h;
    zusatz();
    objektivKnoepfe();
    erzeugen();
    BL.unterGewechselt && BL.unterGewechselt('mikroskopie', id);
  }

  function zusatz() {
    var z = U.$('mk-zusatz'), p = prepDaten, html = '';
    if (p.faerbung) html += '<label class="check"><input type="checkbox" id="mk-farbe"' + (S.faerbung ? ' checked' : '') + '> gefärbt mit ' + U.esc(p.faerbung.name) + '</label>' +
      '<p class="small muted" style="margin:0 0 6px 24px">' + U.esc(p.faerbung.wirkung) + '</p>';
    if (p.id === 'spaltoeffnung') html += '<label class="ctrl"><span>Spaltöffnungen <output id="mk-offen-o"></output></span><input type="range" id="mk-offen" min="0" max="1" step="0.05" value="' + S.offen + '"></label>' +
      '<p class="small muted" style="margin:-4px 0 6px">' + U.esc(p.parameter) + '</p>';
    if (p.bewegung) html += '<label class="check"><input type="checkbox" id="mk-ruhig"' + (S.ruhig ? ' checked' : '') + '> Bewegung anhalten</label><p class="small muted" style="margin:0 0 6px 24px">' + U.esc(p.bewegung) + '</p>';
    if (p.id === 'heuaufguss') html += '<div class="row eng" style="margin-bottom:8px"><button type="button" id="mk-suche">Nächstes Pantoffeltierchen suchen</button></div>';
    z.innerHTML = html;
    var cb = U.$('mk-farbe'); if (cb) cb.addEventListener('change', function () { S.faerbung = this.checked; erzeugen(true); });
    var sl = U.$('mk-offen'); if (sl) {
      var lab = function () { U.$('mk-offen-o').textContent = S.offen < 0.15 ? 'geschlossen' : S.offen > 0.7 ? 'weit offen' : 'halb offen'; };
      lab(); sl.addEventListener('input', function () { S.offen = Number(this.value); lab(); erzeugen(true); });
    }
    var ru = U.$('mk-ruhig'); if (ru) ru.addEventListener('change', function () { S.ruhig = this.checked; });
    var su = U.$('mk-suche'); if (su) su.addEventListener('click', function () {
      if (!gen || !gen.ziele) return;
      var z = gen.ziele().sort(function (a, b) { return Math.hypot(a[0] - S.cx, a[1] - S.cy) - Math.hypot(b[0] - S.cx, b[1] - S.cy); });
      var t = z.filter(function (q) { return Math.hypot(q[0] - S.cx, q[1] - S.cy) > 30; })[0] || z[0];
      if (t) { S.cx = t[0]; S.cy = t[1]; begrenzen(); neuZeichnen(); }
    });
  }

  function objektivKnoepfe() {
    var box = U.$('mk-obj');
    U.seg(box, O.OBJEKTIVE.map(function (o) { return { wert: o.v, text: o.v + '×', titel: 'Gesamtvergrößerung ' + O.gesamt(o.v) + '-fach' + (o.oel ? ' (Ölimmersion)' : '') }; }), S.obj, function (v) {
      var alt = S.obj; S.obj = v;
      // Objektive sind nur annähernd abgeglichen: nach dem Wechsel ist meist ein kleines Nachstellen nötig
      if (v !== alt) S.z0 += Math.round((Math.random() - 0.5) * Math.min(8, 3 * O.schaerfentiefe(v)) * 4) / 4;
      begrenzen(); neuZeichnen(); fokus();
    }, 'Objektiv wählen');
    box.querySelectorAll('button').forEach(function (b) {
      var v = Number(b.getAttribute('data-wert'));
      if (v > prepDaten.maxObjektiv) { b.disabled = true; b.title = 'Für dieses Präparat nicht sinnvoll (' + (prepDaten.id === 'komplexauge' ? 'Auflicht/Stereolupe' : 'Frisch- oder Lebendpräparat') + ')'; }
    });
  }

  function erzeugen(behalteAusschnitt) {
    var r = U.rng(prepDaten.id.length * 1013 + prepDaten.id.charCodeAt(0) * 7);
    gen = GEN[prepDaten.id](r, { faerbung: S.faerbung, offen: S.offen });
    if (!behalteAusschnitt) { S.cx = 0; S.cy = 0; }
    begrenzen(); neuZeichnen(); fokus();
    if (gen.dyn) taktGeber.an(); else taktGeber.aus();
  }

  function massstabPx() { return O.pxProUm(S.obj, DURCHMESSER); }
  function sicht() { return { x: S.cx, y: S.cy, r: O.sehfeld(S.obj) / 2 }; }
  function begrenzen() {
    S.cx = Math.max(-gen.w / 2, Math.min(gen.w / 2, S.cx));
    S.cy = Math.max(-gen.h / 2, Math.min(gen.h / 2, S.cy));
  }

  // ------------------------------------------------------------------ Zeichnen
  var gezeichnet = [];                       // [element, teil] der erkennbaren Teile (für Beschriftung)
  function zeichneTeil(t, parent, k) {
    var pxGroesse = t.g * k;
    if (t.f === 'flaeche') {
      // ganze Fläche als Muster, solange einzelne Zellen kleiner als bisPx Bildpunkte sind
      if (t.groesse * k >= t.bisPx) return null;
      return U.svg('rect', { x: -t.w / 2, y: -t.h / 2, width: t.w, height: t.h, fill: 'url(#mk-' + t.muster + ')', opacity: 0.95 }, parent);
    }
    if (t.ab && t.g * k < t.ab) return null;   // Einzelheiten erst ab einer Mindestgröße einzeln zeichnen
    if (pxGroesse < 0.8) return null;
    var e, a = {};
    if (t.f === 'c') { a = { cx: f1(t.cx), cy: f1(t.cy), r: t.rr }; e = 'circle'; }
    else if (t.f === 'e') { a = { cx: f1(t.cx), cy: f1(t.cy), rx: t.rx, ry: t.ry }; if (t.rot) a.transform = 'rotate(' + f1(t.rot) + ' ' + f1(t.cx) + ' ' + f1(t.cy) + ')'; e = 'ellipse'; }
    else if (t.f === 'p') { a = { d: t.d }; e = 'path'; }
    else if (t.f === 'l') { a = { x1: f1(t.x1), y1: f1(t.y1), x2: f1(t.x2), y2: f1(t.y2), 'stroke-linecap': 'round' }; e = 'line'; }
    a.fill = t.fill || 'none';
    if (t.stroke) {
      a.stroke = t.stroke;
      if (t.skal) a['stroke-width'] = t.sw; else { a['stroke-width'] = t.sw || 1; a['vector-effect'] = 'non-scaling-stroke'; }
      if (t.dash) a['stroke-dasharray'] = t.dash;
    }
    if (t.op !== undefined) a.opacity = t.op;
    if (t.pe) a['pointer-events'] = t.pe;
    var el = U.svg(e, a, parent);
    if (t.s && prepDaten.strukturen[t.s] && O.erkennbar(prepDaten.strukturen[t.s].groesse, S.obj, DURCHMESSER)) {
      el.setAttribute('data-s', t.s);
      el.classList.add('wahl');
      gezeichnet.push([el, t]);
      if (t.pe === 'stroke' && !t.skal) {
        // unsichtbare, breitere Trefferfläche für dünne Wände
        var hit = el.cloneNode(false);
        hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', 9); hit.removeAttribute('opacity'); hit.removeAttribute('stroke-dasharray');
        hit.classList.remove('wahl'); hit.removeAttribute('tabindex');
        parent.appendChild(hit);
      }
    } else if (!t.pe) el.setAttribute('pointer-events', 'none');
    return el;
  }

  function transform() {
    var k = massstabPx();
    gSzene.setAttribute('transform', 'translate(' + C + ' ' + C + ') scale(' + k + ') translate(' + f1(-S.cx) + ' ' + f1(-S.cy) + ')');
  }

  var geplant = false;
  function neuZeichnen() {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(function () { geplant = false; zeichneStatisch(); zeichneDyn(false); zeichneOben(); anzeigen(); });
  }

  function zeichneStatisch() {
    U.leeren(gStatisch);
    gezeichnet = [];
    transform();
    var k = massstabPx(), si = sicht();
    gen.teile.forEach(function (t) {
      if (Math.abs(t.x - si.x) > si.r + t.r || Math.abs(t.y - si.y) > si.r + t.r) return;
      zeichneTeil(t, gStatisch, k);
    });
  }
  var dynGezeichnet = [];
  function zeichneDyn(laeuft) {
    if (!gen.dyn) { U.leeren(gDyn); dynGezeichnet = []; return; }
    var k = massstabPx();
    if (gen.dynAb && gen.dynAb * k < 2.5) { U.leeren(gDyn); dynGezeichnet = []; return; }
    // viele bewegte Teile (Plasmaströmung) nur etwa 12-mal pro Sekunde neu zeichnen
    var jetzt = performance.now();
    if (laeuft && dynGezeichnet.length > 600 && jetzt - (zeichneDyn.zuletzt || 0) < 80) return;
    zeichneDyn.zuletzt = jetzt;
    var vorher = gezeichnet; gezeichnet = [];
    U.leeren(gDyn);
    gen.dyn(zeit, sicht(), laeuft && !S.ruhig).forEach(function (t) { zeichneTeil(t, gDyn, k); });
    dynGezeichnet = gezeichnet; gezeichnet = vorher;
    if (S.sel) markierungAktualisieren();
    if (S.etiketten && laeuft) zeichneOben();
  }

  // Beschriftungen: je erkennbarer Struktur eine Instanz nahe der Mitte, Text am Rand des Sehfelds
  function zeichneOben() {
    U.leeren(gOben);
    var k = massstabPx();
    // Maßstab
    var ms = O.massstab(k, 60), mx = C - ms.px / 2, my = D - 34;
    U.svg('rect', { x: mx - 8, y: my - 22, width: ms.px + 16, height: 32, rx: 6, class: 'mk-skala-bg' }, gOben);
    U.svg('line', { x1: mx, y1: my, x2: mx + ms.px, y2: my, class: 'mk-skala' }, gOben);
    U.svg('text', { x: C, y: my - 8, 'text-anchor': 'middle', class: 'mk-skala-text', text: O.laengeText(ms.um) }, gOben);
    if (S.sel) markierungAktualisieren();
    var alle = gezeichnet.concat(dynGezeichnet), beste = {};
    // unscharfes Bild: keine Einzelheiten erkennbar, also auch keine Beschriftung
    if (O.unschaerfePx(S.z - S.z0, S.obj) > 2) alle = [];
    liste(alle);
    if (!S.etiketten) return;
    alle.forEach(function (p) {
      var t = p[1], ax = t.ax !== undefined ? t.ax : t.x, ay = t.ay !== undefined ? t.ay : t.y;
      var sx = C + (ax - S.cx) * k, sy = C + (ay - S.cy) * k, d = Math.hypot(sx - C, sy - C);
      if (d > R - 12) return;
      if (!beste[t.s] || d < beste[t.s].d) beste[t.s] = { d: d, x: sx, y: sy };
    });
    // Beschriftungen in zwei Spalten am Rand, von oben nach unten nach der Lage geordnet
    var punkte = Object.keys(beste).map(function (id) { return { id: id, x: beste[id].x, y: beste[id].y }; });
    var links = punkte.filter(function (q) { return q.x < C; }), rechts = punkte.filter(function (q) { return q.x >= C; });
    var nachX = function (a, b) { return a.x - b.x; };
    while (links.length - rechts.length > 2) { links.sort(nachX); rechts.push(links.pop()); }
    while (rechts.length - links.length > 2) { rechts.sort(nachX); links.push(rechts.shift()); }
    [[links, -1], [rechts, 1]].forEach(function (sp) {
      var col = sp[0].sort(function (a, b) { return a.y - b.y; }), y0 = C - R + 34, y1 = D - 66, ab = 18, n = col.length;
      col.forEach(function (q) { q.ty = Math.max(y0, Math.min(y1, q.y)); });
      for (var i = 1; i < n; i++) if (col[i].ty < col[i - 1].ty + ab) col[i].ty = col[i - 1].ty + ab;
      if (n && col[n - 1].ty > y1) { col[n - 1].ty = y1; for (var j = n - 2; j >= 0; j--) if (col[j].ty > col[j + 1].ty - ab) col[j].ty = col[j + 1].ty - ab; }
      col.forEach(function (q) {
        var dx = Math.sqrt(Math.max(0, R * R - (q.ty - C) * (q.ty - C))), tx = C + sp[1] * (dx - 12);
        var t = U.svg('text', { x: tx, y: q.ty, 'dominant-baseline': 'middle', 'text-anchor': sp[1] < 0 ? 'start' : 'end', class: 'mk-label', text: prepDaten.strukturen[q.id].name }, gOben);
        var w = t.getComputedTextLength ? t.getComputedTextLength() : 60;
        var lx = tx - sp[1] * (w + 4);
        gOben.insertBefore(U.svg('line', { x1: q.x, y1: q.y, x2: lx, y2: q.ty, class: 'mk-label-linie' }), t);
        gOben.insertBefore(U.svg('circle', { cx: q.x, cy: q.y, r: 2.5, fill: '#1d1c1a', 'pointer-events': 'none' }), t);
      });
    });
  }

  // Knöpfe für alle erkennbaren Strukturen (Tastatur, Touch): wählt die Instanz nahe der Bildmitte
  var listeSchluessel = '';
  function liste(alle) {
    var box = U.$('mk-liste'), ids = [], naechste = {}, k = massstabPx();
    alle.forEach(function (p) {
      var t = p[1], d = Math.hypot(t.x - S.cx, t.y - S.cy);
      if (d * k > R) return;
      if (!naechste[t.s] || d < naechste[t.s].d) naechste[t.s] = { d: d, el: p[0] };
    });
    Object.keys(prepDaten.strukturen).forEach(function (id) { if (naechste[id]) ids.push(id); });
    box._naechste = naechste;
    var schluessel = ids.join(',');
    if (schluessel === listeSchluessel) return;
    listeSchluessel = schluessel;
    U.leeren(box);
    if (!ids.length) { box.innerHTML = '<p class="small muted" style="margin:0">' + (O.unschaerfePx(S.z - S.z0, S.obj) > 2 ? 'Das Bild ist unscharf – stelle zuerst scharf.' : 'Noch nichts erkennbar – stärker vergrößern oder das Präparat ins Sehfeld schieben.') + '</p>'; return; }
    ids.forEach(function (id) {
      var b = U.html('button', { type: 'button', text: prepDaten.strukturen[id].name }, box);
      b.addEventListener('click', function () { var n = box._naechste[id]; if (n) waehle(id, n.el); });
    });
  }

  function markierungAktualisieren() {
    var alt = gOben.querySelector('.mk-gewaehlt'); if (alt) alt.remove();
    if (!S.sel || !S.sel.el || !S.sel.el.isConnected) return;
    var bb = S.sel.el.getBBox(), k = massstabPx();
    var x = C + (bb.x + bb.width / 2 - S.cx) * k, y = C + (bb.y + bb.height / 2 - S.cy) * k;
    U.svg('circle', { cx: x, cy: y, r: Math.max(8, Math.max(bb.width, bb.height) * k / 2 + 5), class: 'mk-gewaehlt' }, gOben);
  }

  function waehle(id, el) {
    var st = prepDaten.strukturen[id];
    if (!st) return;
    S.sel = { id: id, el: el };
    var ab = O.erkennbarAb(st.groesse, DURCHMESSER);
    BL.ui.info(W.info, { name: st.name, text: st.text, hinweis: 'Präparat: ' + prepDaten.name + (ab ? ' · erkennbar ab etwa ' + ab + '-facher Vergrößerung' : '') });
    markierungAktualisieren();
  }

  function fokus() {
    var ab = S.z - S.z0, u = O.unschaerfePx(ab, S.obj);
    var vorher = Number(blur.getAttribute('stdDeviation')) > 2;
    blur.setAttribute('stdDeviation', u.toFixed(2));
    if (vorher !== (u > 2)) { listeSchluessel = null; zeichneOben(); }
    U.$('mk-fokus-o').textContent = (S.z > 0 ? '+' : '') + U.fmt(S.z, 2) + ' µm';
    var t = O.schaerfentiefe(S.obj), txt;
    if (u === 0) txt = '✓ Das Bild ist scharf. Schärfentiefe bei diesem Objektiv: etwa ' + O.laengeText(t) + '.';
    else txt = 'Unscharf: Die Fokusebene liegt ' + O.laengeText(Math.abs(ab)) + ' ' + (ab > 0 ? 'über' : 'unter') + ' dem Präparat. Drehe am Feintrieb.';
    U.$('mk-schaerfe').textContent = txt;
  }

  function anzeigen() {
    var o = O.objektiv(S.obj);
    U.$('mk-r-v').textContent = O.gesamt(S.obj) + '×';
    U.$('mk-r-sf').textContent = O.laengeText(O.sehfeld(S.obj));
    U.$('mk-r-a').textContent = O.laengeText(O.aufloesung(S.obj));
    if (!S.sel) BL.ui.info(W.info, {
      name: prepDaten.name,
      text: 'Tippe eine Struktur im Sehfeld an. Erkennbar und beschriftet ist nur, was die gewählte Vergrößerung auflösen kann.' + (o.oel ? ' Beim 100×-Objektiv wird ein Tropfen Immersionsöl zwischen Deckglas und Objektiv gegeben.' : ''),
      hinweis: 'Okular 10× · Objektiv ' + S.obj + '× (NA ' + U.fmt(o.na, 2) + ')' + (gen.auflicht ? ' · Beobachtung im Auflicht' : ' · Hellfeld im Durchlicht'),
    });
  }

  // ------------------------------------------------------------------ Bedienung: Ziehen, Tasten, Knöpfe
  function bedienung(wrap) {
    var zug = null;
    svg.addEventListener('pointerdown', function (e) {
      zug = { x: e.clientX, y: e.clientY, cx: S.cx, cy: S.cy, bewegt: false, id: e.pointerId };
    });
    svg.addEventListener('pointermove', function (e) {
      if (!zug) return;
      var r = svg.getBoundingClientRect(), f = D / r.width / massstabPx();
      var dx = e.clientX - zug.x, dy = e.clientY - zug.y;
      if (!zug.bewegt && Math.hypot(dx, dy) < 4) return;
      if (!zug.bewegt) { zug.bewegt = true; svg.setPointerCapture(zug.id); svg.classList.add('ziehen'); }
      S.cx = zug.cx - dx * f; S.cy = zug.cy - dy * f;
      begrenzen(); neuZeichnen();
    });
    function ende() { if (zug && zug.bewegt) { svg.classList.remove('ziehen'); svg._klickSperre = Date.now(); } zug = null; }
    svg.addEventListener('pointerup', ende);
    svg.addEventListener('pointercancel', ende);
    // nach dem Ziehen keinen Klick auslösen
    svg.addEventListener('click', function (e) { if (svg._klickSperre && Date.now() - svg._klickSperre < 120) e.stopImmediatePropagation(); }, true);
    svg.addEventListener('keydown', function (e) {
      var d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (!d) return;
      e.preventDefault(); schiebe(d[0], d[1]);
    });
    W.flaeche.querySelectorAll('.mk-steuer button').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-d').split(',').map(Number);
        if (!d[0] && !d[1]) { S.cx = 0; S.cy = 0; begrenzen(); neuZeichnen(); } else schiebe(d[0], d[1]);
      });
    });
  }
  function schiebe(dx, dy) {
    var s = O.sehfeld(S.obj) * 0.2;
    S.cx += dx * s; S.cy += dy * s;
    begrenzen(); neuZeichnen();
  }

  M.zeigen = function (unter) {
    if (unter && unter !== S.prep && BL.praeparate.some(function (p) { return p.id === unter; })) waehlePraeparat(unter);
    if (gen && gen.dyn) taktGeber.an();
    return S.prep;
  };
  M.verstecken = function () { if (taktGeber) taktGeber.aus(); };

  BL.module.mikroskopie = M;
  BL.mikroskopGeneratoren = GEN;      // für Tests
})(window);
