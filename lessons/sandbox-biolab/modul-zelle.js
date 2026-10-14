// BioLab · Modul Zellbiologie: Zellbestandteile erkunden, Pflanzen- und Tierzelle vergleichen, Diffusion und Osmose
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui, OS = BL.osmose, DI = BL.diffusion;
  var VW = 640, VH = 420;

  var M = {
    titel: 'Zellbiologie', kurz: 'Zellbestandteile ein- und ausblenden, Pflanzen- und Tierzelle vergleichen, Diffusion und Osmose im Modell beobachten.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="10" y="6" width="52" height="36" rx="6"/><rect x="15" y="11" width="42" height="26" rx="4" stroke-width="1.6"/><circle cx="46" cy="22" r="6"/><ellipse cx="25" cy="30" rx="6" ry="3"/></svg>',
    unter: [{ wert: 'aufbau', text: 'Zellbestandteile' }, { wert: 'diffusion', text: 'Diffusion' }, { wert: 'osmose', text: 'Osmose' }],
  };
  var W, aktiv = null, etiketten = true;
  function f1(x) { return Math.round(x * 10) / 10; }
  function org(id) { return BL.organellen.filter(function (o) { return o.id === id; })[0]; }

  // ------------------------------------------------------------------ Zellbestandteile
  var Z = { typ: 'pflanze', versteckt: {}, sel: null };
  function mito(g, x, y, rot, s) {
    var gg = U.svg('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')' }, g);
    U.svg('ellipse', { cx: 0, cy: 0, rx: 26, ry: 12, fill: 'var(--b-mito-f)', stroke: 'var(--b-mito)', 'stroke-width': 2 }, gg);
    U.svg('path', { d: 'M-18 0 q4 -9 8 0 t8 0 t8 0 t8 0', fill: 'none', stroke: 'var(--b-mito)', 'stroke-width': 1.5 }, gg);
  }
  function chloro(g, x, y, rot, s) {
    var gg = U.svg('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + s + ')' }, g);
    U.svg('ellipse', { cx: 0, cy: 0, rx: 28, ry: 13, fill: 'var(--b-chloro-f)', stroke: 'var(--b-chloro)', 'stroke-width': 2 }, gg);
    [-14, -4, 6, 16].forEach(function (x2) { for (var k = -1; k <= 1; k++) U.svg('rect', { x: x2 - 3, y: k * 3.2 - 1.4, width: 6, height: 2.6, fill: 'var(--b-chloro)' }, gg); });
  }
  function kern(g, x, y, r) {
    var gk = U.waehlbar(U.svg('g', { 'data-o': 'zellkern' }, g), 'zellkern', 'Zellkern');
    U.svg('circle', { cx: x, cy: y, r: r, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 2.5 }, gk);
    U.svg('circle', { cx: x, cy: y, r: r - 5, fill: 'none', stroke: 'var(--b-kern)', 'stroke-width': 1.2, 'stroke-dasharray': '14 4' }, gk);
    var gn = U.waehlbar(U.svg('g', { 'data-o': 'kernkoerperchen' }, g), 'kernkoerperchen', 'Kernkörperchen');
    U.svg('circle', { cx: x + r * 0.2, cy: y - r * 0.1, r: r * 0.27, fill: 'var(--b-kern)', opacity: 0.85 }, gn);
  }
  function er(g, x, y, r, seiten) {
    var ge = U.waehlbar(U.svg('g', { 'data-o': 'er' }, g), 'er', 'Endoplasmatisches Retikulum');
    seiten.forEach(function (w0) {
      for (var j = 0; j < 3; j++) {
        var rr = r + 12 + j * 11, d = '';
        for (var k = 0; k <= 14; k++) { var w = w0 - 0.7 + k / 14 * 1.4, q = rr + Math.sin(k * 1.4 + j) * 3; d += (k ? ' L' : 'M') + f1(x + Math.cos(w) * q) + ' ' + f1(y + Math.sin(w) * q); }
        U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-er)', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, ge);
      }
    });
    return ge;
  }
  function golgi(g, x, y) {
    var gg = U.waehlbar(U.svg('g', { 'data-o': 'golgi' }, g), 'golgi', 'Golgi-Apparat');
    for (var j = 0; j < 4; j++) U.svg('path', { d: 'M' + (x - 26 + j * 2) + ' ' + (y + j * 7) + ' Q' + x + ' ' + (y - 12 + j * 7) + ' ' + (x + 26 - j * 2) + ' ' + (y + j * 7), fill: 'none', stroke: 'var(--b-golgi)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, gg);
    [[x + 32, y + 2], [x - 32, y + 6], [x + 28, y + 22]].forEach(function (p) { U.svg('circle', { cx: p[0], cy: p[1], r: 4, fill: 'none', stroke: 'var(--b-golgi)', 'stroke-width': 2 }, gg); });
  }
  function ribosomen(g, punkte) {
    var gr = U.waehlbar(U.svg('g', { 'data-o': 'ribosom' }, g), 'ribosom', 'Ribosomen');
    punkte.forEach(function (p) { U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: 2.4, fill: 'var(--b-ribo)' }, gr); });
  }
  /** Zelle zeichnen; gibt Ankerpunkte für Beschriftungen zurück */
  function zeichneZelle(svg, typ, tx, ty, s) {
    var g = U.svg('g', { transform: 'translate(' + tx + ' ' + ty + ') scale(' + s + ')' }, svg), A = {}, r = U.rng(typ === 'pflanze' ? 3 : 8);
    if (typ === 'pflanze') {
      var gw = U.waehlbar(U.svg('g', { 'data-o': 'zellwand' }, g), 'zellwand', 'Zellwand');
      U.svg('rect', { x: 20, y: 20, width: 600, height: 380, rx: 18, fill: 'var(--b-wand)', 'fill-opacity': 0.18, stroke: 'var(--b-wand)', 'stroke-width': 10 }, gw);
      var gp = U.waehlbar(U.svg('g', { 'data-o': 'zellplasma' }, g), 'zellplasma', 'Zellplasma');
      U.svg('rect', { x: 33, y: 33, width: 574, height: 354, rx: 12, fill: 'var(--b-plasma)' }, gp);
      var gm = U.waehlbar(U.svg('g', { 'data-o': 'zellmembran' }, g), 'zellmembran', 'Zellmembran');
      U.svg('rect', { x: 33, y: 33, width: 574, height: 354, rx: 12, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2.5 }, gm);
      U.svg('rect', { x: 33, y: 33, width: 574, height: 354, rx: 12, fill: 'none', stroke: 'transparent', 'stroke-width': 10 }, gm);
      var gv = U.waehlbar(U.svg('g', { 'data-o': 'vakuole' }, g), 'vakuole', 'Vakuole');
      U.svg('path', { d: 'M110 110 C150 70 330 70 360 110 C395 150 390 290 340 320 C290 350 150 345 120 310 C80 270 75 150 110 110 Z', fill: 'var(--b-vak-f)', stroke: 'var(--b-vak)', 'stroke-width': 2 }, gv);
      er(g, 490, 150, 52, [Math.PI * 0.95, Math.PI * 0.5]);
      kern(g, 490, 150, 52);
      golgi(g, 470, 300);
      var gc = U.waehlbar(U.svg('g', { 'data-o': 'chloroplast' }, g), 'chloroplast', 'Chloroplasten');
      [[70, 70, 20], [250, 58, 0], [575, 70, -30], [585, 250, 70], [580, 360, 10], [400, 360, 0], [200, 365, -8], [62, 270, 80], [390, 230, 40]].forEach(function (c) { chloro(gc, c[0], c[1], c[2], 1); });
      var gmi = U.waehlbar(U.svg('g', { 'data-o': 'mitochondrium' }, g), 'mitochondrium', 'Mitochondrien');
      [[400, 80, 10], [560, 160, 80], [300, 362, -10], [70, 180, 90]].forEach(function (c) { mito(gmi, c[0], c[1], c[2], 0.9); });
      var rp = [];
      for (var i = 0; i < 46; i++) { var x = 380 + r() * 220, y = 220 + r() * 150; if (Math.hypot(x - 470, y - 305) < 40) continue; rp.push([x, y]); }
      ribosomen(g, rp);
      A = { zellwand: [320, 20], zellmembran: [33, 200], zellplasma: [420, 210], vakuole: [230, 200], zellkern: [470, 175], kernkoerperchen: [500, 145], er: [420, 120], golgi: [470, 298], chloroplast: [250, 58], mitochondrium: [400, 80], ribosom: [rp[3][0], rp[3][1]] };
    } else {
      var blob = 'M100 90 C170 30 420 25 520 80 C600 125 615 280 545 340 C470 400 230 405 140 360 C50 315 35 160 100 90 Z';
      var gp2 = U.waehlbar(U.svg('g', { 'data-o': 'zellplasma' }, g), 'zellplasma', 'Zellplasma');
      U.svg('path', { d: blob, fill: 'var(--b-plasma)' }, gp2);
      var gm2 = U.waehlbar(U.svg('g', { 'data-o': 'zellmembran' }, g), 'zellmembran', 'Zellmembran');
      U.svg('path', { d: blob, fill: 'none', stroke: 'var(--b-membran)', 'stroke-width': 2.5 }, gm2);
      U.svg('path', { d: blob, fill: 'none', stroke: 'transparent', 'stroke-width': 12 }, gm2);
      er(g, 320, 210, 62, [Math.PI * 0.15, Math.PI * 1.1]);
      kern(g, 320, 210, 62);
      golgi(g, 170, 270);
      var gmi2 = U.waehlbar(U.svg('g', { 'data-o': 'mitochondrium' }, g), 'mitochondrium', 'Mitochondrien');
      [[160, 140, 30], [470, 130, -20], [500, 300, 40], [300, 350, 0], [210, 330, -30], [440, 220, 80]].forEach(function (c) { mito(gmi2, c[0], c[1], c[2], 1); });
      var rp2 = [];
      for (var j = 0; j < 50; j++) { var a = r() * 6.28, d = 0.45 + r() * 0.45, x2 = 320 + Math.cos(a) * d * 235, y2 = 215 + Math.sin(a) * d * 140; rp2.push([x2, y2]); }   // innerhalb der Zelle, außerhalb des Kerns
      ribosomen(g, rp2);
      A = { zellmembran: [100, 90], zellplasma: [420, 300], zellkern: [300, 235], kernkoerperchen: [337, 204], er: [395, 200], golgi: [170, 268], mitochondrium: [470, 130], ribosom: [rp2[2][0], rp2[2][1]] };
    }
    Object.keys(Z.versteckt).forEach(function (id) { var e = g.querySelector('[data-o="' + id + '"]'); if (e && Z.versteckt[id]) e.setAttribute('hidden', ''); });
    Object.keys(A).forEach(function (id) { A[id] = [tx + A[id][0] * s, ty + A[id][1] * s]; });
    return A;
  }
  function zeichneAufbau() {
    U.leeren(W.flaeche); W.extra.innerHTML = '';
    if (Z.typ === 'vergleich') {
      var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 250', role: 'img', 'aria-label': 'Pflanzenzelle und Tierzelle nebeneinander' }, W.flaeche);
      U.auswahl(svg, waehle);
      zeichneZelle(svg, 'pflanze', 4, 18, 0.49);
      zeichneZelle(svg, 'tier', 322, 18, 0.49);
      U.svg('text', { x: 160, y: 14, 'text-anchor': 'middle', class: 'lbl', text: 'Pflanzenzelle' }, svg);
      U.svg('text', { x: 478, y: 14, 'text-anchor': 'middle', class: 'lbl', text: 'Tierzelle' }, svg);
      W.extra.innerHTML = '<div class="lk-card" style="margin-top:14px"><h2>Vergleich</h2><div class="tab-scroll"><table class="bl-tab"><thead><tr><th>Bestandteil</th><th>Pflanzenzelle</th><th>Tierzelle</th><th>sichtbar im</th></tr></thead><tbody>' +
        BL.organellen.map(function (o) { return '<tr><td>' + U.esc(o.name) + '</td><td>' + (o.pflanze ? '✓' : '–') + '</td><td>' + (o.tier ? '✓' : '–') + '</td><td>' + (o.sichtbar === 'LM' ? 'Lichtmikroskop' : 'Elektronenmikroskop') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    } else {
      var svg2 = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': Z.typ === 'pflanze' ? 'Modell einer Pflanzenzelle' : 'Modell einer Tierzelle' }, W.flaeche);
      U.auswahl(svg2, waehle);
      var A = zeichneZelle(svg2, Z.typ, 0, 0, 1);
      if (etiketten) U.beschriftung(svg2, Object.keys(A).filter(function (id) { return !Z.versteckt[id]; }).map(function (id) { return { x: A[id][0], y: A[id][1], text: org(id).name }; }), VW, VH, { rand: 4 });
    }
    if (Z.sel) U.markiere(W.flaeche.querySelector('svg'), Z.sel);
  }
  function waehle(id) {
    var o = org(id);
    if (!o) return;
    Z.sel = id;
    U.info(W.info, { name: o.name, text: o.text, hinweis: 'Pflanzenzelle: ' + (o.pflanze ? 'ja' : 'nein') + ' · Tierzelle: ' + (o.tier ? 'ja' : 'nein') + ' · sichtbar im ' + (o.sichtbar === 'LM' ? 'Lichtmikroskop' : 'Elektronenmikroskop') });
    U.markiere(W.flaeche.querySelector('svg'), id);
  }
  function werkzeugAufbau() {
    W.werkzeug.innerHTML = ''; W.leiste.innerHTML = '';
    var lab = U.html('label', { class: 'check' }, W.leiste);
    lab.innerHTML = '<input type="checkbox"' + (etiketten ? ' checked' : '') + '> Beschriftungen';
    lab.querySelector('input').addEventListener('change', function () { etiketten = this.checked; zeichneAufbau(); });
    var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
    U.seg(seg, [{ wert: 'pflanze', text: 'Pflanzenzelle' }, { wert: 'tier', text: 'Tierzelle' }, { wert: 'vergleich', text: 'Vergleich' }], Z.typ, function (v) { Z.typ = v; werkzeugAufbau(); zeichneAufbau(); }, 'Zelltyp');
    U.html('p', { class: 'feld-titel', text: 'Bestandteile ein- und ausblenden' }, W.werkzeug);
    var cb = U.html('div', { class: 'checks' }, W.werkzeug);
    BL.organellen.filter(function (o) { return Z.typ === 'vergleich' || o[Z.typ === 'pflanze' ? 'pflanze' : 'tier']; }).forEach(function (o) {
      var l = U.html('label', { class: 'check' }, cb);
      l.innerHTML = '<input type="checkbox"' + (Z.versteckt[o.id] ? '' : ' checked') + '> ' + U.esc(o.name);
      l.querySelector('input').addEventListener('change', function () { Z.versteckt[o.id] = !this.checked; zeichneAufbau(); });
    });
    var row = U.html('div', { class: 'row eng', style: 'margin-top:8px' }, W.werkzeug);
    var b1 = U.html('button', { type: 'button', text: 'Wie im Lichtmikroskop' }, row);
    var b2 = U.html('button', { type: 'button', text: 'Alles zeigen' }, row);
    b1.addEventListener('click', function () { BL.organellen.forEach(function (o) { Z.versteckt[o.id] = o.sichtbar === 'EM'; }); werkzeugAufbau(); zeichneAufbau(); });
    b2.addEventListener('click', function () { Z.versteckt = {}; werkzeugAufbau(); zeichneAufbau(); });
    U.html('p', { class: 'small muted', text: 'ER, Golgi-Apparat und Ribosomen erkennt man nur im Elektronenmikroskop.' }, W.werkzeug);
    if (!Z.sel) U.info(W.info, { name: Z.typ === 'tier' ? 'Tierzelle' : Z.typ === 'pflanze' ? 'Pflanzenzelle' : 'Vergleich', text: 'Tippe einen Bestandteil an. Mit den Häkchen blendest du Bestandteile ein und aus.' });
    U.art(W.art, 'modell', 'Zellbestandteile vergrößert und in geringer Zahl gezeichnet; in echten Zellen gibt es z. B. Hunderte Mitochondrien.');
  }

  // ------------------------------------------------------------------ Diffusion
  var DF = { tempo: 1, wand: 'poren', gross: false, d: null, takt: null, kurve: [], svg: null, gT: null, gK: null };
  function durchlaessig() { return DF.wand === 'keine' || (DF.wand === 'poren' && !DF.gross); }
  function diffusionNeu() { DF.d = DI.neu(120, 7); DF.kurve = [[0, 1]]; zeichneDiffusion(); }
  function zeichneDiffusion() {
    var g = DF.gT; U.leeren(g);
    var X = 40, Y = 20, B = 560, H = 230;
    U.svg('rect', { x: X, y: Y, width: B, height: H, rx: 8, fill: 'var(--b-vak-f)', stroke: 'var(--border)', 'stroke-width': 2 }, g);
    if (DF.wand !== 'keine') {
      if (DF.wand === 'poren') { for (var k = 0; k < 9; k++) U.svg('rect', { x: X + B / 2 - 3, y: Y + k * H / 9 + 6, width: 6, height: H / 9 - 12, fill: 'var(--b-membran)' }, g); }
      else U.svg('rect', { x: X + B / 2 - 3, y: Y, width: 6, height: H, fill: 'var(--b-membran)' }, g);
    }
    var r = DF.gross ? 6 : 3.6;
    DF.d.teilchen.forEach(function (p) { U.svg('circle', { cx: f1(X + p.x * B), cy: f1(Y + p.y * H), r: r, fill: 'var(--c3)' }, g); });
    U.svg('text', { x: X + B / 4, y: Y + H + 18, 'text-anchor': 'middle', class: 'val', text: 'linke Kammer' }, g);
    U.svg('text', { x: X + 3 * B / 4, y: Y + H + 18, 'text-anchor': 'middle', class: 'val', text: 'rechte Kammer' }, g);
    // Kurve: Anteil links über die Zeit
    var gk = DF.gK; U.leeren(gk);
    var KX = 60, KY = 290, KB = 540, KH = 110, tmax = Math.max(20, DF.d.zeit);
    U.svg('line', { x1: KX, y1: KY + KH, x2: KX + KB, y2: KY + KH, class: 'achse' }, gk);
    U.svg('line', { x1: KX, y1: KY, x2: KX, y2: KY + KH, class: 'achse' }, gk);
    U.svg('line', { x1: KX, y1: KY + KH / 2, x2: KX + KB, y2: KY + KH / 2, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, gk);
    U.svg('text', { x: KX - 6, y: KY + 4, 'text-anchor': 'end', class: 'val', text: '100 %' }, gk);
    U.svg('text', { x: KX - 6, y: KY + KH / 2 + 4, 'text-anchor': 'end', class: 'val', text: '50 %' }, gk);
    U.svg('text', { x: KX - 6, y: KY + KH + 4, 'text-anchor': 'end', class: 'val', text: '0 %' }, gk);
    U.svg('text', { x: KX + KB, y: KY + KH + 18, 'text-anchor': 'end', class: 'val', text: 'Zeit →' }, gk);
    U.svg('text', { x: KX + 6, y: KY - 6, class: 'val', text: 'Anteil der Teilchen links' }, gk);
    if (DF.kurve.length > 1) U.svg('polyline', { points: DF.kurve.map(function (q) { return f1(KX + q[0] / tmax * KB) + ',' + f1(KY + (1 - q[1]) * KH); }).join(' '), class: 'kurve', stroke: 'var(--c3)' }, gk);
    var a = DI.anteilLinks(DF.d);
    if (U.$('df-l')) { U.$('df-l').textContent = Math.round(a * 100) + ' %'; U.$('df-r').textContent = Math.round((1 - a) * 100) + ' %'; }
  }
  function schrittDiffusion(dt) {
    DI.schritt(DF.d, dt, DF.tempo, durchlaessig());
    var last = DF.kurve[DF.kurve.length - 1];
    if (DF.d.zeit - last[0] > 0.25) DF.kurve.push([DF.d.zeit, DI.anteilLinks(DF.d)]);
    zeichneDiffusion();
  }
  function startDiffusion() {
    U.leeren(W.flaeche); W.extra.innerHTML = ''; W.leiste.innerHTML = ''; W.werkzeug.innerHTML = '';
    DF.svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 420', role: 'img', 'aria-label': 'Zwei Kammern mit Farbstoffteilchen und einer Trennwand, darunter der zeitliche Verlauf' }, W.flaeche);
    DF.gT = U.svg('g', {}, DF.svg); DF.gK = U.svg('g', {}, DF.svg);
    DF.takt = U.takt(schrittDiffusion);
    var bS = U.html('button', { type: 'button', class: 'primary', text: '▶ Start' }, W.leiste);
    var bN = U.html('button', { type: 'button', text: '↺ Neu' }, W.leiste);
    bS.addEventListener('click', function () { if (DF.takt.laeuft) { DF.takt.aus(); bS.textContent = '▶ Weiter'; } else { DF.takt.an(); bS.textContent = '❚❚ Anhalten'; } });
    bN.addEventListener('click', function () { DF.takt.aus(); bS.textContent = '▶ Start'; diffusionNeu(); });
    var w = W.werkzeug;
    U.html('p', { class: 'feld-titel', text: 'Temperatur' }, w);
    U.seg(U.html('div', {}, w), [{ wert: 0.5, text: 'kalt' }, { wert: 1, text: 'Raumtemperatur' }, { wert: 1.7, text: 'warm' }], DF.tempo, function (v) { DF.tempo = v; }, 'Temperatur');
    U.html('p', { class: 'feld-titel', text: 'Trennwand' }, w);
    U.seg(U.html('div', {}, w), [{ wert: 'keine', text: 'keine' }, { wert: 'poren', text: 'mit Poren' }, { wert: 'dicht', text: 'dicht' }], DF.wand, function (v) { DF.wand = v; zeichneDiffusion(); }, 'Trennwand');
    U.html('p', { class: 'feld-titel', text: 'Teilchen' }, w);
    U.seg(U.html('div', {}, w), [{ wert: false, text: 'klein' }, { wert: true, text: 'groß' }], DF.gross, function (v) { DF.gross = v; zeichneDiffusion(); }, 'Teilchengröße');
    U.html('div', { class: 'readouts', html: '<div class="readout"><span>links</span><b id="df-l">–</b></div><div class="readout"><span>rechts</span><b id="df-r">–</b></div>' }, w);
    U.html('p', { class: 'small muted', text: 'Große Teilchen passen nicht durch die Poren. So eine Wand heißt halbdurchlässig (selektiv permeabel) – wie die Zellmembran.' }, w);
    U.info(W.info, { name: 'Diffusion', text: 'Teilchen bewegen sich ständig zufällig. Dadurch verteilen sie sich von selbst vom Ort hoher zum Ort niedriger Konzentration, bis sie gleichmäßig verteilt sind. Die Bewegung hört auch dann nicht auf – es wandern nur gleich viele hin wie zurück.', hinweis: 'Je wärmer, desto schneller bewegen sich die Teilchen.' });
    U.art(W.art, 'simulation', 'Jedes Teilchen macht zufällige kleine Sprünge. Die Größe der Sprünge steigt mit der Temperatur.');
    diffusionNeu();
  }

  // ------------------------------------------------------------------ Osmose
  var OZ = { typ: 'pflanze', c: 2, z: null, takt: null, kurve: [], wasser: [], svg: null, g: null };
  function osmoseNeu() { OZ.z = OS.neu(OZ.typ, OZ.c); OZ.kurve = [[0, 1]]; OZ.wasser = []; zeichneOsmose(); }
  function cText(c) {
    var t = c === 0 ? 'reines Wasser' : c < 1 ? 'schwächer konzentriert (hypotonisch)' : c === 1 ? 'gleich konzentriert (isotonisch)' : 'stärker konzentriert (hypertonisch)';
    return OZ.typ === 'blut' ? t + ' · etwa ' + U.fmt(0.9 * c, 2) + ' % Kochsalz' : t;
  }
  function zeichneOsmose() {
    var g = OZ.g; U.leeren(g);
    var z = OZ.z, cx = 210, cy = 200, r = U.rng(5);
    U.svg('rect', { x: 10, y: 10, width: 400, height: 380, rx: 14, fill: 'var(--b-vak-f)', stroke: 'var(--border)', 'stroke-width': 2 }, g);
    U.svg('text', { x: 24, y: 34, class: 'val', text: 'Außenlösung' }, g);
    // gelöste Teilchen außen: Dichte entspricht der Konzentration
    var n = Math.round(OZ.c * 46);
    for (var i = 0; i < n; i++) { var x = 20 + r() * 380, y = 44 + r() * 336; if (Math.hypot(x - cx, (y - cy) * 1.3) < 175) continue; U.svg('circle', { cx: f1(x), cy: f1(y), r: 3.2, fill: 'var(--c3)', opacity: 0.8 }, g); }
    var f = Math.sqrt(z.V);                               // Fläche ~ Volumen
    if (z.typ === 'pflanze') {
      var bw = 260, bh = 170, wb = 1 + Math.min(0.06, Math.max(0, z.V - 1) * 0.6);
      U.svg('rect', { x: cx - bw / 2 * wb, y: cy - bh / 2 * wb, width: bw * wb, height: bh * wb, rx: 14, fill: 'none', stroke: 'var(--b-wand)', 'stroke-width': 9 }, g);
      var pf = Math.min(1, f), pw = (bw - 14) * pf, ph = (bh - 14) * pf;
      var rx = z.V < 0.97 ? 40 : 10;
      U.svg('rect', { x: f1(cx - pw / 2), y: f1(cy - ph / 2), width: f1(pw), height: f1(ph), rx: rx, fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2.5 }, g);
      U.svg('rect', { x: f1(cx - pw / 2 + 12), y: f1(cy - ph / 2 + 12), width: f1(Math.max(4, pw - 24)), height: f1(Math.max(4, ph - 24)), rx: Math.max(6, rx - 8), fill: 'var(--b-vak-f)', stroke: 'var(--b-vak)', 'stroke-width': 1.5 }, g);
      U.svg('circle', { cx: f1(cx + pw / 2 - 30), cy: f1(cy - ph / 2 + 26), r: 12, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 1.5 }, g);
      var rr = U.rng(9);
      for (var j = 0; j < 46; j++) U.svg('circle', { cx: f1(cx + (rr() - 0.5) * (pw - 40)), cy: f1(cy + (rr() - 0.5) * (ph - 40)), r: 3.2, fill: 'var(--c3)', opacity: 0.85 }, g);
      if (z.V < 0.97) U.svg('text', { x: cx, y: cy + bh / 2 + 30, 'text-anchor': 'middle', class: 'lbl', text: 'Zellinhalt löst sich von der Zellwand' }, g);
    } else {
      var R = 70 * Math.pow(z.V, 1 / 3) * 1.15;
      if (z.geplatzt) {
        U.svg('circle', { cx: cx, cy: cy, r: 95, fill: 'none', stroke: 'var(--b-o2)', 'stroke-width': 2, 'stroke-dasharray': '8 10', opacity: 0.6 }, g);
        U.svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'lbl', text: 'geplatzt' }, g);
      } else {
        var pts = [], zacken = z.V < 0.95 ? Math.min(1, (0.95 - z.V) * 3) : 0;
        for (var k = 0; k < 72; k++) { var w = k / 72 * Math.PI * 2, q = R * (1 + zacken * 0.12 * Math.sin(w * 12)); pts.push(f1(cx + Math.cos(w) * q) + ' ' + f1(cy + Math.sin(w) * q)); }
        U.svg('path', { d: 'M' + pts.join(' L') + ' Z', fill: 'var(--b-o2-f)', stroke: 'var(--b-o2)', 'stroke-width': 2.5 }, g);
        var mitte = z.V <= 1.05 ? Math.max(0, 1 - Math.abs(z.V - 1) * 4) : 0;
        if (mitte > 0) U.svg('circle', { cx: cx, cy: cy, r: R * 0.42, fill: 'var(--card)', opacity: 0.55 * mitte }, g);
        var rr2 = U.rng(9);
        for (var m = 0; m < 46; m++) { var a2 = rr2() * 6.28, d2 = Math.sqrt(rr2()) * (R - 10); U.svg('circle', { cx: f1(cx + Math.cos(a2) * d2), cy: f1(cy + Math.sin(a2) * d2), r: 3.2, fill: 'var(--c3)', opacity: 0.85 }, g); }
      }
    }
    // Wasserteilchen an der Membran (Richtung zeigt den Nettostrom)
    OZ.wasser.forEach(function (wt) { U.svg('circle', { cx: f1(wt.x), cy: f1(wt.y), r: 2.6, fill: 'var(--neg)' }, g); });
    // Verlauf des Volumens
    var KX = 450, KY = 40, KB = 170, KH = 300, vmax = 1.6, tmax = Math.max(12, z.t);
    U.svg('text', { x: KX, y: KY - 16, class: 'val', text: 'Volumen der Zelle' }, g);
    U.svg('line', { x1: KX, y1: KY, x2: KX, y2: KY + KH, class: 'achse' }, g);
    U.svg('line', { x1: KX, y1: KY + KH, x2: KX + KB, y2: KY + KH, class: 'achse' }, g);
    [0.5, 1, 1.5].forEach(function (v) { var y = KY + KH - v / vmax * KH; U.svg('line', { x1: KX, y1: y, x2: KX + KB, y2: y, class: 'gridline' }, g); U.svg('text', { x: KX - 4, y: y + 4, 'text-anchor': 'end', class: 'val', text: Math.round(v * 100) + ' %' }, g); });
    var gl = OS.gleichgewicht(z.typ, z.c);
    if (isFinite(gl) && gl < vmax) { var gy = KY + KH - gl / vmax * KH; U.svg('line', { x1: KX, y1: gy, x2: KX + KB, y2: gy, stroke: 'var(--accent)', 'stroke-dasharray': '5 4' }, g); U.svg('text', { x: KX + KB, y: gy - 4, 'text-anchor': 'end', class: 'val', text: 'Gleichgewicht' }, g); }
    if (OZ.kurve.length > 1) U.svg('polyline', { points: OZ.kurve.map(function (q) { return f1(KX + q[0] / tmax * KB) + ',' + f1(KY + KH - Math.min(vmax, q[1]) / vmax * KH); }).join(' '), class: 'kurve', stroke: 'var(--b-o2)' }, g);
    U.svg('text', { x: KX + KB, y: KY + KH + 16, 'text-anchor': 'end', class: 'val', text: 'Zeit →' }, g);
    if (U.$('os-v')) {
      U.$('os-v').textContent = z.geplatzt ? 'geplatzt' : Math.round(z.V * 100) + ' %';
      U.$('os-ci').textContent = U.fmt(z.n / z.V, 2) + '×';
      var s = OS.strom(z);
      U.$('os-s').textContent = z.geplatzt || Math.abs(s) < 0.005 ? 'ausgeglichen' : s > 0 ? 'in die Zelle' : 'aus der Zelle';
      U.$('os-text').textContent = OS.zustandText(z);
    }
  }
  function schrittOsmose(dt) {
    OS.schritt(OZ.z, dt);
    var last = OZ.kurve[OZ.kurve.length - 1];
    if (OZ.z.t - last[0] > 0.2) OZ.kurve.push([OZ.z.t, OZ.z.V]);
    // Wasserteilchen: beide Richtungen; mehr zur Seite mit mehr gelösten Teilchen
    var ci = OZ.z.n / OZ.z.V, rein = Math.max(0, 1 - 0.2 * OZ.c), raus = Math.max(0, 1 - 0.2 * ci);
    var cx = 210, cy = 200, R = OZ.typ === 'pflanze' ? 110 : 80;
    if (!OZ.z.geplatzt) {
      if (Math.random() < dt * 14 * rein) { var a = Math.random() * 6.28; OZ.wasser.push({ x: cx + Math.cos(a) * (R + 50), y: cy + Math.sin(a) * (R + 30), vx: -Math.cos(a), vy: -Math.sin(a), t: 0 }); }
      if (Math.random() < dt * 14 * raus) { var b = Math.random() * 6.28; OZ.wasser.push({ x: cx + Math.cos(b) * (R - 20), y: cy + Math.sin(b) * (R - 30), vx: Math.cos(b), vy: Math.sin(b), t: 0 }); }
    }
    OZ.wasser.forEach(function (w) { w.x += w.vx * 60 * dt; w.y += w.vy * 60 * dt; w.t += dt; });
    OZ.wasser = OZ.wasser.filter(function (w) { return w.t < 1.1; });
    zeichneOsmose();
  }
  function startOsmose() {
    U.leeren(W.flaeche); W.extra.innerHTML = ''; W.leiste.innerHTML = ''; W.werkzeug.innerHTML = '';
    OZ.svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 400', role: 'img', 'aria-label': 'Zelle in einer Salzlösung mit Verlauf des Zellvolumens' }, W.flaeche);
    OZ.g = U.svg('g', {}, OZ.svg);
    OZ.takt = U.takt(schrittOsmose);
    var bS = U.html('button', { type: 'button', class: 'primary', text: '▶ Start' }, W.leiste);
    var bN = U.html('button', { type: 'button', text: '↺ Neu' }, W.leiste);
    bS.addEventListener('click', function () { if (OZ.takt.laeuft) { OZ.takt.aus(); bS.textContent = '▶ Weiter'; } else { OZ.takt.an(); bS.textContent = '❚❚ Anhalten'; } });
    bN.addEventListener('click', function () { OZ.takt.aus(); bS.textContent = '▶ Start'; osmoseNeu(); });
    var w = W.werkzeug;
    U.html('p', { class: 'feld-titel', text: 'Zelle' }, w);
    U.seg(U.html('div', {}, w), [{ wert: 'pflanze', text: 'Pflanzenzelle' }, { wert: 'blut', text: 'Rotes Blutkörperchen' }], OZ.typ, function (v) { OZ.typ = v; cAnz(); osmoseNeu(); }, 'Zelltyp');
    var l = U.html('label', { class: 'ctrl', style: 'margin-top:10px' }, w);
    l.innerHTML = '<span>Außenlösung <output id="os-c-o"></output></span><input type="range" id="os-c" min="0" max="3" step="0.25" value="' + OZ.c + '">';
    U.html('p', { class: 'small muted', id: 'os-c-t', style: 'margin:-6px 0 8px' }, w);
    function cAnz() { U.$('os-c-o').textContent = U.fmt(OZ.c, 2) + '-fach'; U.$('os-c-t').textContent = cText(OZ.c); }
    U.$('os-c').addEventListener('input', function () { OZ.c = Number(this.value); OZ.z.c = OZ.c; cAnz(); zeichneOsmose(); });
    cAnz();
    U.html('div', { class: 'readouts', html: '<div class="readout"><span>Volumen</span><b id="os-v">–</b></div><div class="readout"><span>Konzentration innen</span><b id="os-ci">–</b></div><div class="readout"><span>Wasser strömt</span><b id="os-s">–</b></div>' }, w);
    U.html('p', { class: 'hinweisbox', id: 'os-text', 'aria-live': 'polite' }, w);
    U.html('p', { class: 'small muted', text: 'Konzentration als Vielfaches der Konzentration im Zellinneren zu Beginn. Die gelösten Teilchen (lila) können die Membran nicht passieren, Wasser (blau) schon.' }, w);
    U.info(W.info, { name: 'Osmose', text: 'Osmose ist die Diffusion von Wasser durch eine halbdurchlässige Membran. Wasser strömt dorthin, wo mehr gelöste Teilchen sind, bis sich die Konzentrationen angleichen – oder bis die Zellwand dagegen drückt.', hinweis: 'Ändere die Außenlösung und starte den Versuch.' });
    U.art(W.art, 'simulation', 'Modell: Wasserstrom proportional zum Konzentrationsunterschied; die Zellwand der Pflanzenzelle gibt nur wenig nach. Zeitachse nicht in echten Sekunden.');
    osmoseNeu();
  }

  // ------------------------------------------------------------------ Steuerung
  function stopAlles() { if (DF.takt) DF.takt.aus(); if (OZ.takt) OZ.takt.aus(); }
  function wechsle(id) {
    stopAlles();
    aktiv = id; Z.sel = null;
    U.segSetze(W.unter, id);
    if (id === 'aufbau') { werkzeugAufbau(); zeichneAufbau(); } else if (id === 'diffusion') startDiffusion(); else startOsmose();
    BL.unterGewechselt && BL.unterGewechselt('zelle', id);
  }
  M.init = function (panel) { W = U.werkbank(panel, { id: 'ze', unter: true }); U.unterReiter(W.unter, M.unter, 'aufbau', wechsle); };
  M.zeigen = function (unter) {
    var ok = M.unter.some(function (u) { return u.wert === unter; });
    if (ok && unter !== aktiv) wechsle(unter); else if (!aktiv) wechsle('aufbau');
    return aktiv;
  };
  M.verstecken = stopAlles;
  BL.module.zelle = M;
})(window);
