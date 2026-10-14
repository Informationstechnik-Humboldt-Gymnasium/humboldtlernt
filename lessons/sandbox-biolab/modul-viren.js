// BioLab · Modul Viren: Virusmodelle, Infektionsabläufe, Vergleich mit Bakterien
// Viren sind kleiner als die Auflösungsgrenze des Lichtmikroskops. Echte Bilder stammen aus dem Elektronenmikroskop;
// hier gibt es nur gezeichnete Modelle (Schnittbilder), deutlich als solche gekennzeichnet.
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui;
  var VW = 640, VH = 420;

  var M = {
    titel: 'Viren', kurz: 'Virusmodelle vergleichen, Bestandteile erkunden, den Ablauf einer Infektion verfolgen und Viren mit Bakterien vergleichen.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="36" cy="24" r="12"/><path d="M36 12 v-6 M36 36 v6 M24 24 h-6 M48 24 h6 M27.5 15.5 l-4 -4 M44.5 32.5 l4 4 M44.5 15.5 l4 -4 M27.5 32.5 l-4 4"/><circle cx="36" cy="5" r="2"/><circle cx="36" cy="43" r="2"/><circle cx="17" cy="24" r="2"/><circle cx="55" cy="24" r="2"/></svg>',
    unter: [{ wert: 'modelle', text: 'Virusmodelle' }, { wert: 'zyklus', text: 'Infektion' }, { wert: 'vergleich', text: 'Virus und Bakterium' }],
  };
  var W, aktiv = null, virus = 'influenza', alleMassstab = false, etiketten = true, auswahlId = null, zyklus = 'phage', spieler = null;

  function f1(x) { return Math.round(x * 10) / 10; }
  function el(tag, a, p, id, name) {
    var e = U.svg(tag, a, p);
    if (id) { U.waehlbar(e, id, name || id); if (id === auswahlId) e.classList.add('gewaehlt'); }
    return e;
  }
  function vDaten(id) { return BL.viren.filter(function (v) { return v.id === id; })[0]; }

  // ------------------------------------------------------------------ Zeichnungen (Koordinaten in nm, k = Bildpunkte je nm)
  // Jede Funktion gibt Beschriftungspunkte zurück: [{ id, x, y }]
  var ZEICHNE = {};

  ZEICHNE.t4 = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false;
    function P(x, y) { return f1(cx + x * k) + ' ' + f1(cy + y * k); }
    var kontr = o.kontrahiert || 0;                     // 0 … 1: Schwanzscheide zieht sich zusammen
    var kopf = 'M' + P(0, -215) + ' L' + P(42, -195) + ' L' + P(42, -125) + ' L' + P(0, -105) + ' L' + P(-42, -125) + ' L' + P(-42, -195) + ' Z';
    el('path', { d: kopf, fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1.8 }, g, w && 'kopf', 'Kopf (Kapsid)');
    if (k > 0.6) U.svg('path', { d: 'M' + P(0, -215) + ' L' + P(0, -105) + ' M' + P(-42, -195) + ' L' + P(0, -160) + ' L' + P(42, -195) + ' M' + P(-42, -125) + ' L' + P(0, -160) + ' L' + P(42, -125), fill: 'none', stroke: 'var(--b-virus)', 'stroke-width': 0.8, opacity: 0.45, 'pointer-events': 'none' }, g);
    if (!o.leer) {
      var d = 'M' + P(-28, -190), r = U.rng(4);
      for (var i = 0; i < 26; i++) d += ' L' + P((r() - 0.5) * 64, -200 + r() * 86);
      el('path', { d: d, fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': Math.max(1, 2 * k), 'stroke-linejoin': 'round', opacity: 0.9 }, g, w && 'dna', 'DNA');
    }
    el('rect', { x: f1(cx - 14 * k), y: f1(cy - 105 * k), width: f1(28 * k), height: f1(7 * k), fill: 'var(--b-protein)', opacity: 0.8 }, g, w && 'kragen', 'Kragen');
    var oben = -98, unten = -10, laenge = (unten - oben) * (1 - kontr * 0.55), breite = 12 + kontr * 6;
    U.svg('rect', { x: f1(cx - 4 * k), y: f1(cy + oben * k), width: f1(8 * k), height: f1((unten - oben + kontr * 20) * k), fill: 'var(--b-protein)', 'pointer-events': 'none' }, g);
    var sch = el('g', {}, g, w && 'schwanz', 'Schwanz mit Scheide');
    U.svg('rect', { x: f1(cx - breite * k), y: f1(cy + oben * k), width: f1(breite * 2 * k), height: f1(laenge * k), fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1.4 }, sch);
    if (k > 0.6) for (var s = oben + 6; s < oben + laenge; s += 6) U.svg('line', { x1: f1(cx - breite * k), x2: f1(cx + breite * k), y1: f1(cy + s * k), y2: f1(cy + s * k), stroke: 'var(--b-virus)', 'stroke-width': 0.7, opacity: 0.6 }, sch);
    var gp = unten + kontr * 20 - (laenge - (unten - oben)) * 0;      // Grundplatte bleibt an der Wand
    var gpY = cy + (unten + kontr * 0) * k;
    el('rect', { x: f1(cx - 22 * k), y: f1(gpY), width: f1(44 * k), height: f1(9 * k), rx: 2, fill: 'var(--b-protein)' }, g, w && 'grundplatte', 'Grundplatte');
    var fg = el('g', {}, g, w && 'fasern', 'Schwanzfasern');
    [[-1, 20, 72, -40, 98, 22], [1, 20, 72, -40, 98, 22], [-1, 12, 44, -30, 60, 24], [1, 12, 44, -30, 60, 24]].forEach(function (f) {
      U.svg('path', { d: 'M' + P(f[0] * f[1], unten + 4) + ' L' + P(f[0] * f[2], unten + f[3] * (1 - kontr * 0.3)) + ' L' + P(f[0] * f[4], unten + f[5]), fill: 'none', stroke: 'var(--b-virus)', 'stroke-width': Math.max(1, 2.2 * k), 'stroke-linejoin': 'round' }, fg);
    });
    U.svg('path', { d: 'M' + P(-98, unten + 22) + ' L' + P(98, unten + 22), stroke: 'transparent', 'stroke-width': 20 * k }, fg);
    return [
      { id: 'kopf', x: cx + 42 * k, y: cy - 170 * k }, { id: 'dna', x: cx - 10 * k, y: cy - 160 * k }, { id: 'kragen', x: cx + 14 * k, y: cy - 101 * k },
      { id: 'schwanz', x: cx + breite * k, y: cy - 60 * k }, { id: 'grundplatte', x: cx + 22 * k, y: gpY + 4 * k }, { id: 'fasern', x: cx - 72 * k, y: cy - 30 * k },
    ];
  };

  function huelle(g, cx, cy, r, k, id, w) {
    el('circle', { cx: cx, cy: cy, r: f1(r * k), fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': Math.max(1.2, 3 * k) }, g, w && id, 'Virushülle');
    U.svg('circle', { cx: cx, cy: cy, r: f1((r - 2.5) * k), fill: 'none', stroke: 'var(--b-virus)', 'stroke-width': Math.max(0.6, 1 * k), opacity: 0.7, 'pointer-events': 'none' }, g);
  }

  ZEICHNE.influenza = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false, R = 50;
    var sp = el('g', {}, g, w && 'haemagglutinin', 'Hämagglutinin'), np = el('g', {}, g, w && 'neuraminidase', 'Neuraminidase');
    for (var i = 0; i < 36; i++) {
      var a = i / 36 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), x0 = cx + c * R * k, y0 = cy + s * R * k, x1 = cx + c * (R + 13) * k, y1 = cy + s * (R + 13) * k;
      if (i % 5 === 2) {
        U.svg('line', { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), stroke: 'var(--b-co2)', 'stroke-width': Math.max(1, 1.5 * k) }, np);
        U.svg('rect', { x: f1(x1 - 3 * k), y: f1(y1 - 3 * k), width: f1(6 * k), height: f1(6 * k), fill: 'var(--b-co2)', transform: 'rotate(' + f1(a * 57.3) + ' ' + f1(x1) + ' ' + f1(y1) + ')' }, np);
      } else {
        U.svg('line', { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), stroke: 'var(--b-o2)', 'stroke-width': Math.max(1, 2.6 * k), 'stroke-linecap': 'round' }, sp);
        U.svg('circle', { cx: f1(x1), cy: f1(y1), r: f1(2.4 * k), fill: 'var(--b-o2)' }, sp);
      }
    }
    huelle(g, cx, cy, R, k, 'huelle', w);
    el('circle', { cx: cx, cy: cy, r: f1((R - 6) * k), fill: 'none', stroke: 'var(--b-protein)', 'stroke-width': Math.max(1, 2.5 * k), 'stroke-dasharray': f1(3 * k) + ' ' + f1(1.5 * k) }, g, w && 'matrix', 'Matrixprotein');
    var rg = el('g', {}, g, w && 'rna', 'RNA mit Nukleoprotein');
    var lagen = [[-18, -18, 40], [2, -24, 90], [20, -10, 120], [-24, 6, 70], [-4, 0, 10], [16, 14, 60], [-14, 22, 160], [6, 26, 20]];
    lagen.forEach(function (q) {
      var a = q[2] / 57.3, d = '';
      for (var j = 0; j <= 10; j++) { var t = j / 10 - 0.5, x = cx + (q[0] + Math.cos(a) * t * 26 - Math.sin(a) * Math.sin(j * 1.6) * 2.5) * k, y = cy + (q[1] + Math.sin(a) * t * 26 + Math.cos(a) * Math.sin(j * 1.6) * 2.5) * k; d += (j ? ' L' : 'M') + f1(x) + ' ' + f1(y); }
      U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-rna)', 'stroke-width': Math.max(1.2, 3 * k), 'stroke-linecap': 'round' }, rg);
    });
    return [{ id: 'haemagglutinin', x: cx + Math.cos(-0.5) * (R + 12) * k, y: cy + Math.sin(-0.5) * (R + 12) * k }, { id: 'neuraminidase', x: cx + Math.cos(2 / 36 * 6.283) * (R + 14) * k, y: cy + Math.sin(2 / 36 * 6.283) * (R + 14) * k },
      { id: 'huelle', x: cx - R * k * 0.7, y: cy + R * k * 0.71 }, { id: 'matrix', x: cx + (R - 6) * k * 0.7, y: cy + (R - 6) * k * 0.71 }, { id: 'rna', x: cx + 2 * k, y: cy - 24 * k }];
  };

  ZEICHNE.corona = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false, R = 45;
    var sp = el('g', {}, g, w && 'spike', 'Spike-Protein');
    for (var i = 0; i < 26; i++) {
      var a = i / 26 * Math.PI * 2 + 0.1, c = Math.cos(a), s = Math.sin(a);
      U.svg('line', { x1: f1(cx + c * R * k), y1: f1(cy + s * R * k), x2: f1(cx + c * (R + 12) * k), y2: f1(cy + s * (R + 12) * k), stroke: 'var(--b-o2)', 'stroke-width': Math.max(1, 2 * k) }, sp);
      U.svg('ellipse', { cx: f1(cx + c * (R + 16) * k), cy: f1(cy + s * (R + 16) * k), rx: f1(4.5 * k), ry: f1(6 * k), transform: 'rotate(' + f1(a * 57.3 + 90) + ' ' + f1(cx + c * (R + 16) * k) + ' ' + f1(cy + s * (R + 16) * k) + ')', fill: 'var(--b-o2)' }, sp);
    }
    huelle(g, cx, cy, R, k, 'huelle', w);
    var mp = el('g', {}, g, w && 'membranprotein', 'Membran- und Hüllproteine');
    for (var m = 0; m < 14; m++) { var b = m / 14 * Math.PI * 2 + 0.33; U.svg('rect', { x: f1(cx + Math.cos(b) * (R - 1) * k - 2 * k), y: f1(cy + Math.sin(b) * (R - 1) * k - 2 * k), width: f1(4 * k), height: f1(4 * k), fill: m % 4 ? 'var(--b-mito)' : 'var(--b-golgi)' }, mp); }
    var rg = el('g', {}, g, w && 'rna', 'RNA mit Nukleokapsid-Protein'), d = '', r = U.rng(9), pts = [];
    for (var j = 0; j < 40; j++) { var ang = j * 0.9, rad = 8 + (j % 7) * 4 + r() * 4; pts.push([cx + Math.cos(ang) * rad * k, cy + Math.sin(ang) * rad * k]); }
    pts.forEach(function (p, q) { d += (q ? ' L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); });
    U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-rna)', 'stroke-width': Math.max(1, 1.6 * k), 'stroke-linejoin': 'round' }, rg);
    pts.forEach(function (p, q) { if (q % 3 === 0) U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: f1(2.2 * k), fill: 'var(--b-protein)' }, rg); });
    return [{ id: 'spike', x: cx + Math.cos(0.1) * (R + 16) * k, y: cy + Math.sin(0.1) * (R + 16) * k }, { id: 'huelle', x: cx - R * k * 0.7, y: cy + R * k * 0.71 },
      { id: 'membranprotein', x: cx + Math.cos(0.33) * (R - 1) * k, y: cy + Math.sin(0.33) * (R - 1) * k }, { id: 'rna', x: pts[10][0], y: pts[10][1] }];
  };

  ZEICHNE.hiv = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false, R = 55;
    var op = el('g', {}, g, w && 'oberflaechenprotein', 'Oberflächenprotein');
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2 + 0.2, c = Math.cos(a), s = Math.sin(a);
      U.svg('line', { x1: f1(cx + c * R * k), y1: f1(cy + s * R * k), x2: f1(cx + c * (R + 8) * k), y2: f1(cy + s * (R + 8) * k), stroke: 'var(--b-chloro)', 'stroke-width': Math.max(1, 2 * k) }, op);
      [-0.06, 0, 0.06].forEach(function (dw, q) { var aa = a + dw * (q === 1 ? 0 : 1); U.svg('circle', { cx: f1(cx + Math.cos(aa) * (R + 11 + (q === 1 ? 3 : 0)) * k), cy: f1(cy + Math.sin(aa) * (R + 11 + (q === 1 ? 3 : 0)) * k), r: f1(3.2 * k), fill: 'var(--b-chloro)' }, op); });
    }
    huelle(g, cx, cy, R, k, 'huelle', w);
    el('circle', { cx: cx, cy: cy, r: f1((R - 6) * k), fill: 'none', stroke: 'var(--b-protein)', 'stroke-width': Math.max(1, 2.5 * k), 'stroke-dasharray': f1(3 * k) + ' ' + f1(1.5 * k) }, g, w && 'matrix', 'Matrixprotein');
    var kap = 'M' + f1(cx - 40 * k) + ' ' + f1(cy - 30 * k) + ' L' + f1(cx + 34 * k) + ' ' + f1(cy - 9 * k) + ' Q' + f1(cx + 42 * k) + ' ' + f1(cy) + ' ' + f1(cx + 34 * k) + ' ' + f1(cy + 9 * k) + ' L' + f1(cx - 40 * k) + ' ' + f1(cy + 30 * k) + ' Q' + f1(cx - 55 * k) + ' ' + f1(cy) + ' ' + f1(cx - 40 * k) + ' ' + f1(cy - 30 * k) + ' Z';
    el('path', { d: kap, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': Math.max(1, 2 * k) }, g, w && 'kapsid', 'Kapsid');
    var rg = el('g', {}, g, w && 'rna', 'RNA');
    [-7, 7].forEach(function (dy) { var d = ''; for (var j = 0; j <= 14; j++) { var x = cx + (-34 + j * 4.6) * k, y = cy + (dy * (1 - j / 18) + Math.sin(j * 1.3) * 3) * k; d += (j ? ' L' : 'M') + f1(x) + ' ' + f1(y); } U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-rna)', 'stroke-width': Math.max(1, 2 * k) }, rg); });
    var eg = el('g', {}, g, w && 'enzym', 'Reverse Transkriptase');
    [[-30, -16], [10, 10], [-12, 18]].forEach(function (p) { U.svg('circle', { cx: f1(cx + p[0] * k), cy: f1(cy + p[1] * k), r: f1(3.5 * k), fill: 'var(--b-golgi)' }, eg); });
    return [{ id: 'oberflaechenprotein', x: cx + Math.cos(0.2) * (R + 12) * k, y: cy + Math.sin(0.2) * (R + 12) * k }, { id: 'huelle', x: cx - R * k * 0.7, y: cy + R * k * 0.71 },
      { id: 'matrix', x: cx + (R - 6) * k * 0.6, y: cy - (R - 6) * k * 0.8 }, { id: 'kapsid', x: cx - 20 * k, y: cy - 24 * k }, { id: 'rna', x: cx + 4 * k, y: cy + 5 * k }, { id: 'enzym', x: cx - 12 * k, y: cy + 18 * k }];
  };

  ZEICHNE.adeno = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false, R = 45, ecken = [];
    for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 - Math.PI / 2; ecken.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k, a]); }
    var fg = el('g', {}, g, w && 'fasern', 'Fasern');
    ecken.forEach(function (e) {
      var x2 = e[0] + Math.cos(e[2]) * 30 * k, y2 = e[1] + Math.sin(e[2]) * 30 * k;
      U.svg('line', { x1: f1(e[0]), y1: f1(e[1]), x2: f1(x2), y2: f1(y2), stroke: 'var(--b-virus)', 'stroke-width': Math.max(1, 1.8 * k) }, fg);
      U.svg('circle', { cx: f1(x2), cy: f1(y2), r: f1(4 * k), fill: 'var(--b-virus)' }, fg);
    });
    var d = 'M' + ecken.map(function (e) { return f1(e[0]) + ' ' + f1(e[1]); }).join(' L') + ' Z';
    el('path', { d: d, fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': Math.max(1.2, 2 * k) }, g, w && 'kapsid', 'Kapsid');
    // Dreiecksflächen andeuten
    var inner = [];
    for (var j = 0; j < 6; j++) { var b = j / 6 * Math.PI * 2 - Math.PI / 2 + Math.PI / 6; inner.push([cx + Math.cos(b) * R * 0.52 * k, cy + Math.sin(b) * R * 0.52 * k]); }
    var dl = '';
    for (var q = 0; q < 6; q++) dl += 'M' + f1(inner[q][0]) + ' ' + f1(inner[q][1]) + ' L' + f1(ecken[q][0]) + ' ' + f1(ecken[q][1]) + ' M' + f1(inner[q][0]) + ' ' + f1(inner[q][1]) + ' L' + f1(ecken[(q + 1) % 6][0]) + ' ' + f1(ecken[(q + 1) % 6][1]) + ' ';
    dl += 'M' + inner.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L') + ' Z';
    U.svg('path', { d: dl, fill: 'none', stroke: 'var(--b-virus)', 'stroke-width': Math.max(0.6, 1 * k), opacity: 0.5, 'pointer-events': 'none' }, g);
    if (o.schnitt !== false) {
      // Schnitt: ein Teil der Hülle ist weggelassen, damit man die DNA sieht
      U.svg('circle', { cx: cx, cy: cy, r: f1(20 * k), fill: 'var(--card)', stroke: 'var(--b-virus)', 'stroke-dasharray': '3 3', 'stroke-width': 1, 'pointer-events': 'none' }, g);
      var dd = 'M' + f1(cx - 12 * k) + ' ' + f1(cy), r = U.rng(2);
      for (var s = 0; s < 16; s++) dd += ' L' + f1(cx + (r() - 0.5) * 30 * k) + ' ' + f1(cy + (r() - 0.5) * 30 * k);
      el('path', { d: dd, fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': Math.max(1, 2 * k), 'stroke-linejoin': 'round' }, g, w && 'dna', 'DNA');
    }
    return [{ id: 'fasern', x: ecken[1][0] + Math.cos(ecken[1][2]) * 30 * k, y: ecken[1][1] + Math.sin(ecken[1][2]) * 30 * k }, { id: 'kapsid', x: (ecken[3][0] + ecken[4][0]) / 2, y: (ecken[3][1] + ecken[4][1]) / 2 }, { id: 'dna', x: cx + 6 * k, y: cy - 6 * k }];
  };

  ZEICHNE.tmv = function (g, cx, cy, k, o) {
    o = o || {}; var w = o.waehlbar !== false, L = 300, D = 18, x0 = cx - L / 2 * k, schnitt = 0.68;
    var kg = el('g', {}, g, w && 'kapsid', 'Kapsid aus Proteinbausteinen');
    U.svg('rect', { x: f1(x0), y: f1(cy - D / 2 * k), width: f1(L * schnitt * k), height: f1(D * k), fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1.2 }, kg);
    if (k > 0.8) for (var s = 0; s < L * schnitt; s += 2.3) U.svg('line', { x1: f1(x0 + s * k), y1: f1(cy - D / 2 * k), x2: f1(x0 + (s + 3) * k), y2: f1(cy + D / 2 * k), stroke: 'var(--b-virus)', 'stroke-width': 0.6, opacity: 0.55 }, kg);
    // aufgeschnittener Teil: Bausteine nur unten, RNA-Schraube sichtbar
    U.svg('rect', { x: f1(x0 + L * schnitt * k), y: f1(cy), width: f1(L * (1 - schnitt) * k), height: f1(D / 2 * k), fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1.2 }, kg);
    var d = '';
    for (var j = 0; j <= 160; j++) { var x = x0 + (L * (schnitt - 0.04) + j / 160 * L * (1 - schnitt + 0.04)) * k, y = cy + Math.sin(j * 0.6) * 4 * k; d += (j ? ' L' : 'M') + f1(x) + ' ' + f1(y); }
    el('path', { d: d, fill: 'none', stroke: 'var(--b-rna)', 'stroke-width': Math.max(1, 1.6 * k) }, g, w && 'rna', 'RNA');
    return [{ id: 'kapsid', x: x0 + L * 0.3 * k, y: cy - D / 2 * k }, { id: 'rna', x: x0 + L * 0.85 * k, y: cy }];
  };

  // ------------------------------------------------------------------ Ansicht Virusmodelle
  function massstab(svg, k, x, y) {
    var ms = BL.optik.massstab(k * 1000, 70);         // k in Bildpunkten je nm → je µm
    U.svg('line', { x1: x, y1: y, x2: x + ms.px, y2: y, stroke: 'var(--text)', 'stroke-width': 3 }, svg);
    U.svg('text', { x: x + ms.px / 2, y: y - 7, 'text-anchor': 'middle', class: 'lbl', text: BL.optik.laengeText(ms.um) }, svg);
  }
  function zeichneModell() {
    U.leeren(W.flaeche);
    var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': alleMassstab ? 'Alle Virusmodelle im gleichen Maßstab' : 'Schnittmodell: ' + vDaten(virus).name }, W.flaeche);
    U.auswahl(svg, function (id) { waehle(id); });
    if (alleMassstab) {
      var k = 0.62, plaetze = [['t4', 110, 210], ['influenza', 270, 120], ['corona', 420, 120], ['hiv', 560, 120], ['adeno', 290, 300], ['tmv', 470, 310]];
      plaetze.forEach(function (p) {
        var g = U.svg('g', { class: 'wahl', 'data-v': p[0], role: 'button', tabindex: '0', 'aria-label': vDaten(p[0]).name }, svg);
        ZEICHNE[p[0]](g, p[1], p[2] + (p[0] === 't4' ? 70 : 0), p[0] === 'tmv' ? k : k, { waehlbar: false, schnitt: false });
        U.svg('text', { x: p[1], y: p[0] === 't4' ? 305 : p[0] === 'tmv' ? 345 : p[2] + 72, 'text-anchor': 'middle', class: 'lbl', text: vDaten(p[0]).kurz }, g);
        g.addEventListener('click', function () { virus = p[0]; alleMassstab = false; werkzeuge(); zeichneModell(); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.dispatchEvent(new MouseEvent('click')); } });
      });
      massstab(svg, k, 30, 395);
      U.art(W.art, 'modell', 'Alle Modelle im gleichen Maßstab. Tippe ein Virus an, um es genauer zu untersuchen.');
      return;
    }
    var v = vDaten(virus), ks = { t4: 1.4, influenza: 2.6, corona: 2.8, hiv: 2.5, adeno: 2.8, tmv: 1.75 }, k2 = ks[virus];
    var cy = virus === 't4' ? 330 : 205, g = U.svg('g', {}, svg);
    var punkte = ZEICHNE[virus](g, 320, cy, k2, {});
    massstab(svg, k2, 24, 400);
    if (etiketten) U.beschriftung(svg, punkte.map(function (p) { return { x: p.x, y: p.y, text: v.strukturen[p.id].name }; }), VW, VH - 30);
    U.art(W.art, 'modell', 'Schnittmodell, Farben frei gewählt. Echte Viren sieht man nur im Elektronenmikroskop – in Schwarz-Weiß.');
  }
  function waehle(id) {
    var v = vDaten(virus), s = v.strukturen[id];
    if (!s) return;
    auswahlId = id;
    U.info(W.info, { name: s.name, text: s.text, hinweis: v.name });
    U.markiere(W.flaeche.querySelector('svg'), id);
  }
  function virusInfo() {
    var v = vDaten(virus);
    auswahlId = null;
    W.info.innerHTML = '<h3>' + U.esc(v.name) + '</h3><p>' + U.esc(v.text) + '</p>' +
      '<table class="bl-tab"><tr><th>Größe</th><td>' + U.esc(v.groesse) + '</td></tr><tr><th>Erbinformation</th><td>' + U.esc(v.erbgut) + '</td></tr>' +
      '<tr><th>Fetthülle</th><td>' + (v.huelle ? 'ja (behülltes Virus)' : 'nein (unbehülltes Virus)') + '</td></tr><tr><th>Wirt</th><td>' + U.esc(v.wirt) + '</td></tr><tr><th>Krankheit</th><td>' + U.esc(v.krankheit) + '</td></tr></table>';
  }

  // ------------------------------------------------------------------ Ansicht Infektion
  function zeichneZyklus(i, t) {
    var svg = W.flaeche.querySelector('svg');
    if (!svg) svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': BL.zyklen[zyklus].name }, W.flaeche);
    U.leeren(svg);
    var e = function (x) { return x * x * (3 - 2 * x); }, s = e(Math.min(1, t)), p = i + s;
    if (zyklus === 'phage') zyklusPhage(svg, i, s); else zyklusGrippe(svg, i, s);
  }
  function bakterium(svg, offen) {
    var x = 70, y = 200, w = 500, h = 190;
    if (!offen) {
      U.svg('rect', { x: x, y: y, width: w, height: h, rx: h / 2, fill: 'var(--b-bakt-f)', stroke: 'var(--b-wand)', 'stroke-width': 7 }, svg);
    } else {
      U.svg('rect', { x: x, y: y, width: w, height: h, rx: h / 2, fill: 'var(--b-bakt-f)', 'fill-opacity': 1 - offen * 0.8, stroke: 'var(--b-wand)', 'stroke-width': 7, 'stroke-dasharray': f1(30 - offen * 26) + ' ' + f1(4 + offen * 30), opacity: 1 - offen * 0.5 }, svg);
    }
    U.svg('text', { x: x + 20, y: y + h - 16, class: 'val', text: 'Bakterium (Ausschnitt)' }, svg);
  }
  function zyklusPhage(svg, i, s) {
    var wandY = 200, kk = 0.62;
    var chromAlpha = i < 2 ? 1 : i === 2 ? 1 - s : 0;
    bakterium(svg, i === 4 ? s : 0);
    if (chromAlpha > 0) U.svg('path', { d: 'M150 300 C170 240 260 250 280 300 C300 350 200 360 180 330 C160 300 230 280 250 320', fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': 2.5, opacity: chromAlpha * 0.8 }, svg);
    // anheftender Phage
    if (i <= 1 || (i >= 2 && i < 4)) {
      var py = i === 0 ? 60 + s * (wandY - 6 - 60) : wandY - 6;
      ZEICHNE.t4(svg, 330, py, kk, { waehlbar: false, kontrahiert: i === 1 ? s : i > 1 ? 1 : 0, leer: i > 1 || (i === 1 && s > 0.8) });
      if (i === 1) {
        var l = s * 110;
        U.svg('path', { d: 'M330 ' + wandY + ' q -10 ' + f1(l * 0.4) + ' 10 ' + f1(l * 0.6) + ' t -14 ' + f1(l * 0.4), fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': 2.4 }, svg);
      }
    }
    var r = U.rng(21);
    if (i === 2) {
      var n = Math.floor(1 + s * 9);
      for (var a = 0; a < n; a++) { var x = 130 + r() * 380, y = 245 + r() * 110; U.svg('path', { d: 'M' + f1(x) + ' ' + f1(y) + ' q 6 -8 12 0 t 12 0 t 12 0', fill: 'none', stroke: 'var(--b-dna)', 'stroke-width': 2 }, svg); }
      for (var b = 0; b < Math.floor(s * 16); b++) { var bx = 130 + r() * 380, by = 245 + r() * 110; if (b % 2) U.svg('path', { d: 'M' + f1(bx) + ' ' + f1(by - 8) + ' l7 4 v8 l-7 4 l-7 -4 v-8 z', fill: 'var(--b-virus-f)', stroke: 'var(--b-virus)', 'stroke-width': 1 }, svg); else U.svg('rect', { x: f1(bx), y: f1(by), width: 4, height: 14, fill: 'var(--b-virus)' }, svg); }
    }
    var plaetze = [[150, 300], [215, 270], [280, 320], [345, 270], [410, 320], [475, 280], [520, 330], [250, 345]];
    if (i === 3) plaetze.forEach(function (q, j) { if (j < 1 + s * plaetze.length) ZEICHNE.t4(svg, q[0], q[1] + 25, 0.22, { waehlbar: false }); });
    if (i === 4) plaetze.forEach(function (q) {
      var dx = q[0] - 320, dy = q[1] - 295, d = Math.hypot(dx, dy) || 1;
      ZEICHNE.t4(svg, q[0] + dx / d * s * 140, q[1] + 25 + dy / d * s * 120, 0.22, { waehlbar: false });
    });
  }
  function zyklusGrippe(svg, i, s) {
    var k = 0.42, memY = 130;
    // Zelle: Membran oben als Linie, Zellkern unten
    var dellt = i === 1 ? s : 0, vesikelY = i === 1 ? memY + 40 * s : i === 2 ? memY + 40 + s * 30 : null;
    var dip = i === 0 ? 0 : i === 1 ? 46 * s : 0;
    U.svg('path', { d: 'M0 ' + memY + ' L250 ' + memY + ' C 280 ' + memY + ' 285 ' + f1(memY + dip) + ' 310 ' + f1(memY + dip) + ' C 335 ' + f1(memY + dip) + ' 340 ' + memY + ' 370 ' + memY + ' L' + VW + ' ' + memY + ' L' + VW + ' ' + VH + ' L0 ' + VH + ' Z', fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 3 }, svg);
    U.svg('text', { x: 12, y: memY + 22, class: 'val', text: 'Zellmembran' }, svg);
    U.svg('text', { x: 12, y: 24, class: 'val', text: 'außerhalb der Zelle' }, svg);
    U.svg('ellipse', { cx: 470, cy: 330, rx: 130, ry: 70, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 2 }, svg);
    U.svg('text', { x: 470, y: 392, 'text-anchor': 'middle', class: 'val', text: 'Zellkern' }, svg);
    // Ribosomen
    var r = U.rng(8);
    for (var q = 0; q < 26; q++) U.svg('circle', { cx: f1(30 + r() * 300), cy: f1(200 + r() * 200), r: 2.4, fill: 'var(--b-ribo)', opacity: 0.6 }, svg);
    if (i === 0) ZEICHNE.influenza(svg, 140 + s * 170, 50 + s * (memY - 24 - 50), k, { waehlbar: false });
    if (i === 1) ZEICHNE.influenza(svg, 310, memY - 24 + s * 70, k, { waehlbar: false });
    if (i === 1 && s > 0.85) U.svg('circle', { cx: 310, cy: memY - 24 + s * 70, r: 30, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2 }, svg);
    if (i === 2) {
      U.svg('circle', { cx: 310, cy: memY + 46, r: 30, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2, opacity: 1 - s }, svg);
      for (var a = 0; a < 8; a++) {
        var sx = 310 + Math.cos(a) * 8, sy = memY + 46 + Math.sin(a * 2) * 8, tx = 420 + (a % 4) * 25, ty = 310 + Math.floor(a / 4) * 30;
        rnaStueck(svg, sx + (tx - sx) * s, sy + (ty - sy) * s, a);
      }
    }
    if (i >= 3) {
      var n = i === 3 ? 8 + Math.floor(s * 20) : 28;
      for (var b = 0; b < n; b++) rnaStueck(svg, 370 + (b % 9) * 24, 295 + Math.floor(b / 9) * 22, b);
    }
    if (i >= 3) {
      // Virusproteine entstehen an Ribosomen und wandern in die Membran
      var m = i === 3 ? s : 1;
      for (var c = 0; c < 10; c++) {
        var x0 = 60 + c * 26, y0 = 260, x1 = 100 + c * 22, y1 = memY;
        var x = x0 + (x1 - x0) * m, y = y0 + (y1 - y0) * m;
        U.svg('line', { x1: f1(x), y1: f1(y), x2: f1(x), y2: f1(y - 7), stroke: c % 4 === 1 ? 'var(--b-co2)' : 'var(--b-o2)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg);
      }
    }
    if (i === 4) for (var d = 0; d < 6; d++) {
      var sx2 = 380 + (d % 3) * 30, sy2 = 290, tx2 = 110 + d * 34, ty2 = memY + 20;
      rnaStueck(svg, sx2 + (tx2 - sx2) * s, sy2 + (ty2 - sy2) * s, d);
    }
    if (i === 5) for (var v = 0; v < 3; v++) {
      var bx = 140 + v * 70, hoch = s * 70;
      ZEICHNE.influenza(svg, bx, memY - 6 - hoch, k * (0.6 + 0.4 * s), { waehlbar: false });
    }
  }
  function rnaStueck(svg, x, y, i) {
    var d = 'M' + f1(x - 9) + ' ' + f1(y);
    for (var j = 1; j <= 6; j++) d += ' L' + f1(x - 9 + j * 3) + ' ' + f1(y + (j % 2 ? -2.5 : 2.5));
    U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-rna)', 'stroke-width': 2.4, 'stroke-linecap': 'round', transform: 'rotate(' + (i * 37 % 180) + ' ' + f1(x) + ' ' + f1(y) + ')' }, svg);
  }

  // ------------------------------------------------------------------ Ansicht Vergleich
  function zeichneVergleich() {
    U.leeren(W.flaeche);
    var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 360', role: 'img', 'aria-label': 'Bakterium mit Bakteriophagen und Grippeviren im gleichen Maßstab' }, W.flaeche);
    var k = 0.24;                                       // px je nm
    var bx = 70, by = 110, bl = 2000 * k, bw = 800 * k;
    U.svg('rect', { x: bx, y: by, width: bl, height: bw, rx: bw / 2, fill: 'var(--b-bakt-f)', stroke: 'var(--b-bakt)', 'stroke-width': 3 }, svg);
    [[bx + 120, by], [bx + 220, by], [bx + 330, by]].forEach(function (q) { ZEICHNE.t4(svg, q[0], q[1] - 3, k, { waehlbar: false }); });
    ZEICHNE.influenza(svg, bx + bl + 50, by + 40, k, { waehlbar: false });
    ZEICHNE.corona(svg, bx + bl + 50, by + 120, k, { waehlbar: false });
    U.beschriftung(svg, [
      { x: bx + 60, y: by + bw / 2, text: 'Bakterium (E. coli), etwa 2 µm' },
      { x: bx + 220, y: by - 30, text: 'Bakteriophagen' },
      { x: bx + bl + 50, y: by + 40, text: 'Grippevirus' },
      { x: bx + bl + 50, y: by + 120, text: 'Coronavirus' },
    ], VW, 330, { mitte: bx + bl - 20 });
    var px = 500 * k;
    U.svg('line', { x1: 30, y1: 345, x2: 30 + px, y2: 345, stroke: 'var(--text)', 'stroke-width': 3 }, svg);
    U.svg('text', { x: 30 + px + 8, y: 350, class: 'lbl', text: '500 nm' }, svg);
    var tab = '<div class="tab-scroll"><table class="bl-tab"><thead><tr><th></th><th>Bakterium</th><th>Virus</th></tr></thead><tbody>' +
      BL.virusBakterium.map(function (z) { return '<tr><th>' + U.esc(z[0]) + '</th><td>' + U.esc(z[1]) + '</td><td>' + U.esc(z[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    W.extra.innerHTML = '<div class="lk-card" style="margin-top:14px"><h2>Virus und Bakterium im Vergleich</h2>' + tab + '</div>';
    U.art(W.art, 'modell', 'Alle Objekte im gleichen Maßstab (Balken = 500 nm). Selbst das Bakterium sieht man im Lichtmikroskop nur als winziges Stäbchen.');
  }

  // ------------------------------------------------------------------ Werkzeuge und Steuerung
  function werkzeuge() {
    W.werkzeug.innerHTML = ''; W.leiste.innerHTML = ''; W.extra.innerHTML = '';
    if (aktiv === 'modelle') {
      var lab = U.html('label', { class: 'check' }, W.leiste);
      lab.innerHTML = '<input type="checkbox"' + (etiketten ? ' checked' : '') + '> Beschriftungen';
      lab.querySelector('input').addEventListener('change', function () { etiketten = this.checked; zeichneModell(); });
      var lab2 = U.html('label', { class: 'check' }, W.leiste);
      lab2.innerHTML = '<input type="checkbox"' + (alleMassstab ? ' checked' : '') + '> alle im gleichen Maßstab';
      lab2.querySelector('input').addEventListener('change', function () { alleMassstab = this.checked; zeichneModell(); });
      U.html('p', { class: 'feld-titel', text: 'Virus' }, W.werkzeug);
      var l = U.html('div', { class: 'orgliste' }, W.werkzeug);
      BL.viren.forEach(function (v) {
        var b = U.html('button', { type: 'button', text: v.kurz, 'aria-pressed': v.id === virus ? 'true' : 'false' }, l);
        b.addEventListener('click', function () { virus = v.id; alleMassstab = false; werkzeuge(); zeichneModell(); virusInfo(); BL.unterGewechselt('viren', 'modelle'); });
      });
      U.html('p', { class: 'feld-titel', text: 'Bestandteile' }, W.werkzeug);
      var bl = U.html('div', { class: 'orgliste' }, W.werkzeug), v = vDaten(virus);
      Object.keys(v.strukturen).forEach(function (id) {
        var b = U.html('button', { type: 'button', text: v.strukturen[id].name }, bl);
        b.addEventListener('click', function () { if (alleMassstab) { alleMassstab = false; werkzeuge(); zeichneModell(); } waehle(id); });
      });
      U.html('p', { class: 'hinweisbox', html: 'Viren sind 20 bis 300 nm groß und damit kleiner als die Auflösungsgrenze des Lichtmikroskops (etwa 200 nm). Bilder von Viren entstehen mit dem <b>Elektronenmikroskop</b>.' }, W.werkzeug);
    } else if (aktiv === 'zyklus') {
      var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
      U.seg(seg, [{ wert: 'phage', text: 'Bakteriophage' }, { wert: 'grippe', text: 'Grippevirus' }], zyklus, function (z) { zyklus = z; werkzeuge(); }, 'Ablauf wählen');
      var pb = U.html('div', {}, W.werkzeug);
      U.leeren(W.flaeche);
      spieler = U.player(pb, { schritte: BL.zyklen[zyklus].schritte, zeichne: zeichneZyklus });
      U.info(W.info, { name: BL.zyklen[zyklus].name, text: 'Starte den Ablauf oder gehe mit den Schritt-Knöpfen einzeln durch. Ein Virus vermehrt sich nur in einer passenden Wirtszelle.', hinweis: 'Vereinfachtes Modell: Größen und Zeiten sind nicht maßstabsgetreu.' });
      U.art(W.art, 'modell', 'Stark vereinfachter Ablauf. Viele Einzelschritte (z. B. das Umschreiben von RNA in Proteine) sind zusammengefasst.');
    } else {
      zeichneVergleich();
      U.info(W.info, { name: 'Virus und Bakterium', text: 'Bakterien sind Lebewesen aus einer Zelle. Viren sind keine Zellen und haben keinen eigenen Stoffwechsel. Deshalb wirken Antibiotika nur gegen Bakterien.' });
    }
  }
  function wechsle(id) {
    if (spieler) { spieler.pause(); spieler = null; }
    aktiv = id; auswahlId = null;
    U.segSetze(W.unter, id);
    W.art.innerHTML = '';
    werkzeuge();
    if (id === 'modelle') { zeichneModell(); virusInfo(); }
    BL.unterGewechselt && BL.unterGewechselt('viren', id);
  }
  M.init = function (panel) { W = U.werkbank(panel, { id: 'vi', unter: true }); U.unterReiter(W.unter, M.unter, 'modelle', wechsle); };
  M.zeigen = function (unter) {
    var ok = M.unter.some(function (u) { return u.wert === unter; });
    if (ok && unter !== aktiv) wechsle(unter); else if (!aktiv) wechsle('modelle');
    return aktiv;
  };
  M.verstecken = function () { if (spieler) spieler.pause(); };
  BL.module.viren = M;
  BL.virusZeichnungen = ZEICHNE;
})(window);
