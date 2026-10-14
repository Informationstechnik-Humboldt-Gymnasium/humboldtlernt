// BioLab · Modul Anatomie: Herz und Kreislauf, Atmung, Verdauung, Nervensystem
// Schematische Darstellungen. Farben nach Konvention: rot = sauerstoffreiches, blau = sauerstoffarmes Blut
// (sauerstoffarmes Blut ist in Wirklichkeit dunkelrot).
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui, AN = BL.anatomie;
  var VW = 640;

  var M = {
    titel: 'Anatomie', kurz: 'Herzschlag und Blutkreislauf, Atmung, Verdauung und Reflexe Schritt für Schritt nachvollziehen.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M36 42 C20 32 12 24 14 15 C16 7 27 5 32 12 L36 17 L40 12 C45 5 56 7 58 15 C60 24 52 32 36 42 Z"/><path d="M14 24 h10 l3 -6 l4 12 l3 -6 h24" stroke-width="1.8"/></svg>',
    unter: [{ wert: 'herz', text: 'Herz und Kreislauf' }, { wert: 'atmung', text: 'Atmung' }, { wert: 'verdauung', text: 'Verdauung' }, { wert: 'nerven', text: 'Nervensystem' }],
  };
  var W, aktiv = null, etiketten = true, sel = null, spieler = null, takt = null;
  function f1(x) { return Math.round(x * 10) / 10; }
  function wb(e, id, daten) { U.waehlbar(e, id, daten[id].name); if (id === sel) e.classList.add('gewaehlt'); return e; }
  function info(daten, id) { sel = id; U.info(W.info, { name: daten[id].name, text: daten[id].text }); var s = W.flaeche.querySelector('svg'); if (s) U.markiere(s, id); }
  function rohr(g, d, w, farbe, rand, id, daten) {
    var gg = U.svg('g', {}, g);
    U.svg('path', { d: d, fill: 'none', stroke: rand, 'stroke-width': w + 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gg);
    U.svg('path', { d: d, fill: 'none', stroke: farbe, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gg);
    if (id) wb(gg, id, daten);
    return gg;
  }
  function stopp() { if (spieler) spieler.pause(); if (takt) takt.aus(); }
  function leisteEtiketten(neu) {
    var lab = U.html('label', { class: 'check' }, W.leiste);
    lab.innerHTML = '<input type="checkbox"' + (etiketten ? ' checked' : '') + '> Beschriftungen';
    lab.querySelector('input').addEventListener('change', function () { etiketten = this.checked; neu(); });
  }
  /** Punkt auf einem Polygonzug bei Anteil f (0 … 1) */
  function aufZug(zug, f) {
    var len = 0, seg = [];
    for (var i = 1; i < zug.length; i++) { var l = Math.hypot(zug[i][0] - zug[i - 1][0], zug[i][1] - zug[i - 1][1]); seg.push(l); len += l; }
    var s = Math.max(0, Math.min(1, f)) * len;
    for (var j = 0; j < seg.length; j++) { if (s <= seg[j]) { var u = seg[j] ? s / seg[j] : 0; return [zug[j][0] + (zug[j + 1][0] - zug[j][0]) * u, zug[j][1] + (zug[j + 1][1] - zug[j][1]) * u]; } s -= seg[j]; }
    return zug[zug.length - 1];
  }

  // ================================================================== Herz und Kreislauf
  var H = { ansicht: 'herz', bpm: 70, lupe: 5, teilchen: [], phase: 0, t: 0 };
  var BLAU = 'var(--b-co2)', ROT = 'var(--b-o2)', BLAU_F = 'var(--b-co2-f)', ROT_F = 'var(--b-o2-f)';
  var WEGE = {
    hvo: { zug: [[205, 15], [205, 120], [222, 170]], farbe: BLAU }, hvu: { zug: [[138, 425], [142, 262], [172, 206], [215, 188]], farbe: BLAU },
    ra_rv: { zug: [[225, 175], [222, 255], [240, 340]], farbe: BLAU }, la_lv: { zug: [[420, 170], [415, 255], [400, 340]], farbe: ROT },
    rv_la: { zug: [[248, 345], [292, 262], [297, 150], [300, 80], [190, 62], [120, 62]], farbe: BLAU }, rv_lb: { zug: [[248, 345], [292, 262], [297, 150], [302, 80], [300, 72]], farbe: BLAU },
    lv_ao: { zug: [[392, 345], [345, 262], [345, 120], [352, 50], [420, 26], [480, 70], [492, 200], [496, 425]], farbe: ROT },
    lvn1: { zug: [[600, 140], [478, 158], [425, 170]], farbe: ROT }, lvn2: { zug: [[600, 205], [478, 188], [425, 172]], farbe: ROT },
  };
  // welche Wege in welcher Phase fließen (0 Vorhofsystole, 1 Kammersystole, 2 Erschlaffung)
  var FLUSS = [['ra_rv', 'la_lv', 'hvo', 'hvu', 'lvn1', 'lvn2'], ['rv_la', 'lv_ao', 'hvo', 'hvu', 'lvn1', 'lvn2'], ['hvo', 'hvu', 'lvn1', 'lvn2', 'ra_rv', 'la_lv']];
  var STARK = [['ra_rv', 'la_lv'], ['rv_la', 'lv_ao'], []];
  function klappe(g, x1, x2, y, offen, nachUnten, id) {
    var gg = U.svg('g', {}, g), l = (x2 - x1) / 2;
    [[x1, 1], [x2, -1]].forEach(function (q) {
      var x = q[0], wn = offen ? (nachUnten ? 80 : -80) : 0, a = wn * Math.PI / 180 * q[1] * (nachUnten ? 1 : 1);
      var ex = x + q[1] * Math.cos(a) * l * 0.95, ey = y + Math.abs(Math.sin(a)) * l * 0.95 * (nachUnten ? 1 : -1);
      U.svg('line', { x1: x, y1: y, x2: f1(ex), y2: f1(ey), stroke: 'var(--line)', 'stroke-width': 4, 'stroke-linecap': 'round' }, gg);
    });
    U.svg('rect', { x: x1 - 4, y: y - 14, width: x2 - x1 + 8, height: 28, fill: 'transparent' }, gg);
    wb(gg, id, AN.herz);
  }
  function zeichneHerz() {
    var svg = W.flaeche.querySelector('svg');
    if (!svg || !svg._herz) { U.leeren(W.flaeche); svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 440', role: 'img', 'aria-label': 'Schema des Herzens in der Vorderansicht mit Blutfluss' }, W.flaeche); svg._herz = true; U.auswahl(svg, function (id) { info(AN.herz, id); }); }
    U.leeren(svg);
    var ph = H.phase, t = H.t, puls = Math.sin(Math.PI * Math.min(1, t));
    var vorhof = ph === 0 ? 1 - 0.12 * puls : 1, kammer = ph === 1 ? 1 - 0.2 * puls : 1;
    var g = U.svg('g', {}, svg);
    // Gefäße
    // Reihenfolge = Lage von hinten nach vorn: Lungenarterie hinter der oberen Hohlvene, Lungenvenen vor der absteigenden Aorta
    rohr(g, 'M297 240 L297 150 L300 80 L190 62 L110 62 M300 80 L300 70', 26, BLAU_F, BLAU, 'lungenarterie', AN.herz);
    rohr(g, 'M205 8 L205 130', 26, BLAU_F, BLAU, 'hohlvene', AN.herz);
    rohr(g, 'M138 432 L142 262 L172 206', 28, BLAU_F, BLAU, 'hohlvene', AN.herz);
    rohr(g, 'M345 240 L345 120 C345 20 480 10 488 80 L494 432', 30, ROT_F, ROT, 'aorta', AN.herz);
    rohr(g, 'M600 140 L470 160 M600 205 L470 186', 16, ROT_F, ROT, 'lungenvene', AN.herz);
    // Kammern (Muskel + Innenraum)
    function kammerForm(pfad, cx, cy, s, fuellung, id, wand) {
      var gg = U.svg('g', {}, g);
      U.svg('path', { d: pfad, fill: 'var(--b-muskel)', 'fill-opacity': 0.35, stroke: 'var(--b-muskel)', 'stroke-width': wand }, gg);
      U.svg('path', { d: pfad, fill: fuellung, transform: 'translate(' + cx + ' ' + cy + ') scale(' + f1(s * 0.82 * 100) / 100 + ') translate(' + (-cx) + ' ' + (-cy) + ')' }, gg);
      wb(gg, id, AN.herz);
    }
    kammerForm('M165 236 C160 320 230 385 314 408 L314 236 Z', 262, 315, kammer, BLAU_F, 'rv', 3);
    kammerForm('M326 236 L326 410 C410 420 490 345 485 236 Z', 400, 315, kammer, ROT_F, 'lv', 8);
    kammerForm('M163 180 C163 120 285 115 287 180 C287 215 270 230 225 230 C180 230 163 215 163 180 Z', 225, 178, vorhof, BLAU_F, 'ra', 3);
    kammerForm('M362 172 C362 118 478 115 478 172 C478 205 460 222 420 222 C380 222 362 205 362 172 Z', 420, 170, vorhof, ROT_F, 'la', 3);
    wb(U.svg('rect', { x: 313, y: 226, width: 14, height: 186, rx: 4, fill: 'var(--b-muskel)', opacity: 0.85 }, g), 'septum', AN.herz);
    // Klappen: Segelklappen offen in Vorhofsystole und Erschlaffung, Taschenklappen nur in der Kammersystole
    var segelOffen = ph !== 1, taschenOffen = ph === 1;
    klappe(g, 188, 262, 233, segelOffen, true, 'segelklappe');
    klappe(g, 375, 455, 228, segelOffen, true, 'segelklappe');
    klappe(g, 284, 310, 238, taschenOffen, false, 'taschenklappe');
    klappe(g, 330, 360, 238, taschenOffen, false, 'taschenklappe');
    // Blutteilchen
    var gt = U.svg('g', { 'pointer-events': 'none' }, svg);
    H.teilchen.forEach(function (q) { var p = aufZug(WEGE[q.weg].zug, q.f); U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: 4, fill: WEGE[q.weg].farbe, stroke: 'var(--card)', 'stroke-width': 1 }, gt); });
    if (etiketten) U.beschriftung(svg, [
      { x: 205, y: 40, text: 'Obere Hohlvene' }, { x: 139, y: 400, text: 'Untere Hohlvene' }, { x: 205, y: 170, text: 'Rechter Vorhof' }, { x: 230, y: 320, text: 'Rechte Kammer' },
      { x: 150, y: 62, text: 'Lungenarterie' }, { x: 440, y: 170, text: 'Linker Vorhof' }, { x: 420, y: 330, text: 'Linke Kammer' }, { x: 470, y: 40, text: 'Aorta' },
      { x: 560, y: 146, text: 'Lungenvenen' }, { x: 225, y: 236, text: 'Segelklappe' }, { x: 345, y: 238, text: 'Taschenklappe' }, { x: 320, y: 380, text: 'Scheidewand' },
    ], VW, 440, { mitte: 330, rand: 4 });
    U.svg('text', { x: 10, y: 432, class: 'val', text: 'Ansicht von vorn: Die rechte Herzhälfte liegt im Bild links.' }, svg);
  }
  function teilchenSchritt(dt) {
    if (!spieler || !spieler.laeuft) return;
    var tempo = H.bpm / 60 / H.lupe;
    FLUSS[H.phase].forEach(function (weg) {
      var stark = STARK[H.phase].indexOf(weg) >= 0;
      if (Math.random() < dt * (stark ? 22 : 5) * tempo * 3) H.teilchen.push({ weg: weg, f: 0, v: stark ? 1.6 : 0.6 });
    });
    H.teilchen.forEach(function (q) {
      var aktivWeg = FLUSS[H.phase].indexOf(q.weg) >= 0, stark = STARK[H.phase].indexOf(q.weg) >= 0;
      if (aktivWeg) q.f += dt * q.v * tempo * (stark ? 2.2 : 0.8);
    });
    H.teilchen = H.teilchen.filter(function (q) { return q.f < 1; }).slice(-160);
    zeichneHerz();
  }
  var KR_ZUG = [[320, 210], [250, 150], [250, 70], [320, 50], [390, 70], [390, 150], [330, 205], [400, 260], [400, 360], [320, 390], [240, 360], [240, 260], [320, 210]];
  function zeichneKreislauf() {
    U.leeren(W.flaeche);
    var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 430', role: 'img', 'aria-label': 'Schema des doppelten Blutkreislaufs' }, W.flaeche);
    U.auswahl(svg, function (id) { info(AN.kreislauf, id); });
    var g = U.svg('g', {}, svg);
    wb(rohr(g, 'M300 205 L250 150 L250 80', 16, BLAU_F, BLAU), 'arterie', AN.kreislauf);
    wb(rohr(g, 'M390 80 L390 150 L340 205', 16, ROT_F, ROT), 'vene', AN.kreislauf);
    wb(rohr(g, 'M340 225 L400 260 L400 340', 16, ROT_F, ROT), 'arterie', AN.kreislauf);
    wb(rohr(g, 'M240 340 L240 260 L300 225', 16, BLAU_F, BLAU), 'vene', AN.kreislauf);
    var gl = wb(U.svg('g', {}, g), 'lunge', AN.kreislauf);
    U.svg('rect', { x: 230, y: 30, width: 180, height: 60, rx: 18, fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, gl);
    for (var i = 0; i < 6; i++) U.svg('path', { d: 'M' + (250 + i * 28) + ' 80 q 6 -30 14 0', fill: 'none', stroke: i < 3 ? BLAU : ROT, 'stroke-width': 2 }, gl);
    U.svg('text', { x: 320, y: 22, 'text-anchor': 'middle', class: 'lbl', text: 'Lungenkreislauf' }, svg);
    var gk = wb(U.svg('g', {}, g), 'koerper', AN.kreislauf);
    U.svg('rect', { x: 220, y: 340, width: 200, height: 70, rx: 18, fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, gk);
    for (var j = 0; j < 7; j++) U.svg('path', { d: 'M' + (238 + j * 26) + ' 352 q 6 40 14 0', fill: 'none', stroke: j > 3 ? BLAU : ROT, 'stroke-width': 2 }, gk);
    U.svg('text', { x: 320, y: 426, 'text-anchor': 'middle', class: 'lbl', text: 'Körperkreislauf' }, svg);
    var gh = wb(U.svg('g', {}, g), 'herz', AN.kreislauf);
    U.svg('path', { d: 'M320 250 C290 230 270 215 272 200 C274 185 300 180 312 195 L320 203 L328 195 C340 180 366 185 368 200 C370 215 350 230 320 250 Z', fill: 'var(--b-muskel)', 'fill-opacity': 0.5, stroke: 'var(--b-muskel)', 'stroke-width': 2 }, gh);
    U.svg('line', { x1: 320, y1: 203, x2: 320, y2: 248, stroke: 'var(--card)', 'stroke-width': 2 }, gh);
    var gt = U.svg('g', { 'pointer-events': 'none', id: 'kr-teilchen' }, svg);
    H.krT = gt;
    U.svg('text', { x: 10, y: 200, class: 'val', text: 'rechte Herzhälfte' }, svg);
    U.svg('text', { x: 630, y: 200, 'text-anchor': 'end', class: 'val', text: 'linke Herzhälfte' }, svg);
    if (etiketten) U.beschriftung(svg, [{ x: 250, y: 120, text: 'Lungenarterie' }, { x: 390, y: 120, text: 'Lungenvene' }, { x: 400, y: 300, text: 'Aorta' }, { x: 240, y: 300, text: 'Hohlvene' }], VW, 430, { oben: 110 });
    H.krPhase = H.krPhase || 0;
  }
  function kreislaufSchritt(dt) {
    if (!H.krT) return;
    H.krPhase = (H.krPhase + dt * 0.06 * H.bpm / 60) % 1;
    U.leeren(H.krT);
    for (var i = 0; i < 18; i++) {
      var f = (H.krPhase + i / 18) % 1, p = aufZug(KR_ZUG, f);
      // nach der Lunge (Mitte des Lungen-Abschnitts) rot, nach den Körperkapillaren blau
      var rot = f > 0.25 && f < 0.75;
      U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: 5, fill: rot ? ROT : BLAU, stroke: 'var(--card)', 'stroke-width': 1 }, H.krT);
    }
  }
  function startHerz() {
    W.leiste.innerHTML = ''; W.werkzeug.innerHTML = ''; W.extra.innerHTML = '';
    var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
    U.seg(seg, [{ wert: 'herz', text: 'Herz' }, { wert: 'kreislauf', text: 'Blutkreislauf' }], H.ansicht, function (v) { stopp(); H.ansicht = v; startHerz(); }, 'Ansicht');
    leisteEtiketten(function () { if (H.ansicht === 'herz') zeichneHerz(); else zeichneKreislauf(); });
    var regler = U.html('div', {}, W.werkzeug);
    regler.innerHTML = '<label class="ctrl"><span>Puls <output id="hz-p-o"></output></span><input type="range" id="hz-p" min="50" max="180" step="5" value="' + H.bpm + '"></label>';
    var ro = U.html('div', { class: 'readouts' }, W.werkzeug);
    ro.innerHTML = '<div class="readout"><span>Dauer eines Herzschlags</span><b id="hz-d">–</b></div><div class="readout"><span>gepumpt pro Minute (Schlagvolumen 70 mL)</span><b id="hz-hmv">–</b></div>';
    function anz() { U.$('hz-p-o').textContent = H.bpm + ' pro Minute'; U.$('hz-d').textContent = U.fmt(60 / H.bpm, 2) + ' s'; U.$('hz-hmv').textContent = U.fmt(70 * H.bpm / 1000, 1) + ' L'; if (spieler) spieler.tempo = H.bpm / 60 / H.lupe; }
    U.$('hz-p').addEventListener('input', function () { H.bpm = Number(this.value); anz(); });
    if (H.ansicht === 'herz') {
      U.html('p', { class: 'feld-titel', text: 'Zeitlupe' }, W.werkzeug);
      U.seg(U.html('div', {}, W.werkzeug), [{ wert: 1, text: 'echt' }, { wert: 5, text: '5-fach' }, { wert: 10, text: '10-fach' }], H.lupe, function (v) { H.lupe = v; anz(); }, 'Zeitlupe');
      var pb = U.html('div', { style: 'margin-top:10px' }, W.werkzeug);
      H.teilchen = [];
      spieler = U.player(pb, {
        schleife: true,
        schritte: [
          { titel: 'Vorhöfe ziehen sich zusammen', text: 'Die Segelklappen sind offen, die Vorhöfe drücken Blut in die Kammern. Die Taschenklappen sind geschlossen.', dauer: 0.15 },
          { titel: 'Kammern ziehen sich zusammen', text: 'Die Segelklappen schließen sich (1. Herzton). Die Taschenklappen öffnen sich, Blut wird in Lungenarterie und Aorta gepresst. Gleichzeitig füllen sich die Vorhöfe.', dauer: 0.35 },
          { titel: 'Herz erschlafft', text: 'Die Taschenklappen schließen sich (2. Herzton). Die Segelklappen öffnen sich, Blut strömt aus den Venen über die Vorhöfe in die Kammern.', dauer: 0.5 },
        ],
        zeichne: function (i, t) { H.phase = i; H.t = t; zeichneHerz(); },
      });
      takt = U.takt(teilchenSchritt); takt.an();
      U.info(W.info, { name: 'Das Herz', text: 'Das Herz ist eine Doppelpumpe aus Muskelgewebe. Starte den Herzschlag in Zeitlupe, tippe Teile an oder gehe die drei Phasen Schritt für Schritt durch.', hinweis: 'Rot: sauerstoffreiches Blut, blau: sauerstoffarmes Blut (Farbkonvention).' });
      U.art(W.art, 'schema', 'Vereinfachter Längsschnitt. Lage der Gefäße und Größen sind angepasst.');
    } else {
      zeichneKreislauf();
      takt = U.takt(kreislaufSchritt); takt.an();
      U.info(W.info, { name: 'Doppelter Blutkreislauf', text: 'Lungenkreislauf: rechte Kammer → Lunge → linker Vorhof. Körperkreislauf: linke Kammer → Organe → rechter Vorhof. In den Kapillaren der Lunge wird das Blut sauerstoffreich, in den Kapillaren der Organe gibt es den Sauerstoff wieder ab.' });
      U.art(W.art, 'schema');
    }
    anz();
  }

  // ================================================================== Atmung
  var AT = { f: 15, vt: 0.5, phase: 0, o2: [], co2: [] };
  function zeichneAtmung() {
    var svg = W.flaeche.querySelector('svg');
    if (!svg || !svg._atmung) { U.leeren(W.flaeche); svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 440', role: 'img', 'aria-label': 'Schema der Atmungsorgane mit Zwerchfell und Ausschnitt eines Lungenbläschens' }, W.flaeche); svg._atmung = true; U.auswahl(svg, function (id) { info(AN.atmung, id); }); }
    U.leeren(svg);
    var ein = (1 - Math.cos(AT.phase * Math.PI * 2)) / 2, a = ein * Math.min(1, AT.vt / 1.5) + ein * 0.25;   // 0 ausgeatmet … 1 eingeatmet
    var g = U.svg('g', {}, svg);
    U.svg('path', { d: 'M150 70 C150 40 290 40 290 70 L300 120 C380 150 400 200 400 300 L400 430 L40 430 L40 300 C40 200 60 150 140 120 Z', fill: 'var(--b-plasma)', stroke: 'var(--border)', 'stroke-width': 2 }, g);
    var gr = wb(U.svg('g', {}, g), 'rippen', AN.atmung);
    for (var r = 0; r < 6; r++) { var y = 175 + r * 34 - a * 6 * (1 - r / 8); U.svg('path', { d: 'M70 ' + f1(y + 20) + ' Q220 ' + f1(y - 18 - a * 6) + ' 370 ' + f1(y + 20), fill: 'none', stroke: 'var(--b-wand)', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.55 }, gr); }
    wb(U.svg('path', { d: 'M180 46 C190 30 250 30 260 46 L262 70 L178 70 Z', fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, g), 'nase', AN.atmung);
    rohr(g, 'M220 66 L220 165', 18, 'var(--card)', 'var(--b-organ-l)', 'luftroehre', AN.atmung);
    var sx = 1 + 0.07 * a, sy = 1 + 0.12 * a;
    [['M210 175 C130 175 85 240 85 330 C85 375 130 380 205 360 Z'], ['M230 175 C310 175 355 240 355 330 C355 375 310 380 235 360 Z']].forEach(function (p, i) {
      var cx = i ? 235 : 205;
      wb(U.svg('path', { d: p[0], fill: 'var(--b-o2-f)', stroke: 'var(--b-o2)', 'stroke-width': 2, transform: 'translate(' + cx + ' 175) scale(' + f1(sx * 100) / 100 + ' ' + f1(sy * 100) / 100 + ') translate(' + (-cx) + ' -175)' }, g), 'lunge', AN.atmung);
    });
    rohr(g, 'M220 160 L220 180 L170 230 L140 280 M220 180 L270 230 L300 280 M170 230 L150 250 M270 230 L292 250', 8, 'var(--card)', 'var(--b-organ-l)', 'bronchien', AN.atmung);
    var zy = 372 + a * 26, kuppel = 60 - a * 30;
    wb(U.svg('path', { d: 'M60 ' + f1(zy + 20) + ' C120 ' + f1(zy - kuppel) + ' 320 ' + f1(zy - kuppel) + ' 380 ' + f1(zy + 20), fill: 'none', stroke: 'var(--b-muskel)', 'stroke-width': 9, 'stroke-linecap': 'round' }, g), 'zwerchfell', AN.atmung);
    // Luftstrom in der Luftröhre
    var richtung = Math.sin(AT.phase * Math.PI * 2) > 0 ? 1 : -1;
    for (var k = 0; k < 5; k++) { var yy = 60 + ((AT.phase * 4 * richtung * 100 + k * 22) % 110 + 110) % 110; U.svg('circle', { cx: 220, cy: f1(yy), r: 3, fill: 'var(--muted)', 'pointer-events': 'none' }, g); }
    U.svg('text', { x: 220, y: 22, 'text-anchor': 'middle', class: 'lbl', text: richtung > 0 ? 'Einatmen' : 'Ausatmen' }, svg);
    // Ausschnitt: Lungenbläschen mit Kapillare
    var gb = wb(U.svg('g', {}, g), 'blaeschen', AN.atmung);
    U.svg('circle', { cx: 525, cy: 170, r: 82, fill: 'var(--card)', stroke: 'var(--border)', 'stroke-width': 2 }, gb);
    U.svg('circle', { cx: 525, cy: 150, r: 46 + a * 6, fill: 'var(--b-vak-f)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, gb);
    U.svg('path', { d: 'M450 215 C490 195 560 195 600 215', fill: 'none', stroke: 'var(--b-o2)', 'stroke-width': 16, opacity: 0.5 }, gb);
    U.svg('text', { x: 525, y: 266, 'text-anchor': 'middle', class: 'val', text: 'Lungenbläschen mit Kapillare' }, svg);
    U.svg('line', { x1: 300, y1: 250, x2: 445, y2: 190, stroke: 'var(--muted)', 'stroke-dasharray': '4 4' }, svg);
    var gp = U.svg('g', { 'pointer-events': 'none' }, svg);
    AT.o2.forEach(function (q) { U.svg('circle', { cx: f1(q.x), cy: f1(q.y), r: 3.5, fill: ROT }, gp); });
    AT.co2.forEach(function (q) { U.svg('circle', { cx: f1(q.x), cy: f1(q.y), r: 3.5, fill: BLAU }, gp); });
    U.svg('circle', { cx: 454, cy: 296, r: 4, fill: ROT }, svg); U.svg('text', { x: 464, y: 300, class: 'val', text: 'Sauerstoff ins Blut' }, svg);
    U.svg('circle', { cx: 454, cy: 314, r: 4, fill: BLAU }, svg); U.svg('text', { x: 464, y: 318, class: 'val', text: 'Kohlenstoffdioxid in die Luft' }, svg);
    if (etiketten) U.beschriftung(svg, [{ x: 220, y: 50, text: 'Nasenhöhle' }, { x: 220, y: 120, text: 'Luftröhre' }, { x: 160, y: 240, text: 'Bronchien' }, { x: 110, y: 300, text: 'Lungenflügel' }, { x: 90, y: f1(zy + 4), text: 'Zwerchfell' }, { x: 360, y: 190, text: 'Rippen' }], 440, 440, { mitte: 220, oben: 40 });
  }
  function atmungSchritt(dt) {
    AT.phase = (AT.phase + dt * AT.f / 60) % 1;
    if (Math.random() < dt * 4) AT.o2.push({ x: 505 + Math.random() * 40, y: 140, vy: 30 });
    if (Math.random() < dt * 3) AT.co2.push({ x: 505 + Math.random() * 40, y: 212, vy: -30 });
    AT.o2.forEach(function (q) { q.y += q.vy * dt; }); AT.co2.forEach(function (q) { q.y += q.vy * dt; });
    AT.o2 = AT.o2.filter(function (q) { return q.y < 212; }); AT.co2 = AT.co2.filter(function (q) { return q.y > 140; });
    zeichneAtmung();
  }
  function startAtmung() {
    W.leiste.innerHTML = ''; W.werkzeug.innerHTML = ''; W.extra.innerHTML = '';
    var bS = U.html('button', { type: 'button', class: 'primary', text: '❚❚ Anhalten' }, W.leiste);
    leisteEtiketten(zeichneAtmung);
    takt = U.takt(atmungSchritt);
    bS.addEventListener('click', function () { if (takt.laeuft) { takt.aus(); bS.textContent = '▶ Weiter'; } else { takt.an(); bS.textContent = '❚❚ Anhalten'; } });
    var w = W.werkzeug;
    w.innerHTML = '<label class="ctrl"><span>Atemfrequenz <output id="at-f-o"></output></span><input type="range" id="at-f" min="8" max="40" step="1" value="' + AT.f + '"></label>' +
      '<label class="ctrl"><span>Atemzugvolumen <output id="at-v-o"></output></span><input type="range" id="at-v" min="0.3" max="3" step="0.1" value="' + AT.vt + '"></label>' +
      '<div class="readouts"><div class="readout"><span>Atemzeitvolumen</span><b id="at-z">–</b></div></div>' +
      '<p class="small muted">Atemzeitvolumen = Atemzugvolumen · Atemfrequenz. In Ruhe etwa 0,5 L · 15 pro Minute = 7,5 L pro Minute, bei starker Belastung ein Vielfaches.</p>';
    function anz() { U.$('at-f-o').textContent = AT.f + ' pro Minute'; U.$('at-v-o').textContent = U.fmt(AT.vt, 1) + ' L'; U.$('at-z').textContent = U.fmt(AT.f * AT.vt, 1) + ' L/min'; }
    U.$('at-f').addEventListener('input', function () { AT.f = Number(this.value); anz(); });
    U.$('at-v').addEventListener('input', function () { AT.vt = Number(this.value); anz(); });
    anz();
    U.info(W.info, { name: 'Atmung', text: 'Beim Einatmen ziehen sich Zwerchfell und Zwischenrippenmuskeln zusammen: Der Brustraum wird größer, die Lunge dehnt sich mit, Luft strömt ein. Beim Ausatmen erschlaffen die Muskeln. In den Lungenbläschen findet der Gasaustausch durch Diffusion statt.' });
    U.art(W.art, 'schema', 'Bewegung von Zwerchfell und Lunge übertrieben dargestellt.');
    zeichneAtmung(); takt.an();
  }

  // ================================================================== Verdauung
  var STATIONEN = [
    { id: 'mund', titel: 'Mund', text: 'Zähne zerkleinern die Nahrung, Speichel macht sie gleitfähig. Ein Enzym im Speichel beginnt, Stärke zu Zucker abzubauen.', dauer: 2.5, ort: [210, 60], n: { staerke: 0.85 } },
    { id: 'speiseroehre', titel: 'Speiseröhre', text: 'Ringmuskeln schieben den Bissen in wenigen Sekunden zum Magen – auch im Liegen.', dauer: 2, ort: [210, 160], n: {} },
    { id: 'magen', titel: 'Magen', text: 'Der Brei bleibt einige Stunden. Salzsäure tötet Keime ab, Enzyme beginnen mit der Eiweißverdauung.', dauer: 3, ort: [265, 235], n: { eiweiss: 0.65 } },
    { id: 'duenndarm', titel: 'Dünndarm', text: 'Galle zerteilt Fette, Enzyme der Bauchspeicheldrüse zerlegen Stärke, Eiweiß und Fett in Bausteine. Die Bausteine gelangen über die Darmzotten ins Blut.', dauer: 4, ort: [215, 330], n: { staerke: 0, eiweiss: 0, fett: 0 } },
    { id: 'dickdarm', titel: 'Dickdarm', text: 'Dem Rest wird über etwa ein bis zwei Tage Wasser entzogen. Darmbakterien zersetzen einen Teil der Ballaststoffe.', dauer: 3.5, ort: [300, 290], n: { wasser: 0.25, ballast: 0.8 } },
    { id: 'enddarm', titel: 'Enddarm', text: 'Unverdauliche Reste werden gesammelt und als Kot ausgeschieden.', dauer: 2.5, ort: [215, 405], n: {} },
  ];
  var NAEHR = [['staerke', 'Stärke', 'var(--b-golgi)'], ['eiweiss', 'Eiweiß', 'var(--b-o2)'], ['fett', 'Fett', 'var(--b-mito)'], ['ballast', 'Ballaststoffe', 'var(--b-chloro)'], ['wasser', 'Wasser', 'var(--b-co2)']];
  var WEG_V = [[210, 40], [210, 75], [210, 180], [240, 215], [285, 240], [262, 268], [190, 290], [255, 315], [175, 335], [245, 355], [150, 290], [150, 220], [300, 210], [300, 360], [215, 375], [215, 420]];
  var WEG_IDX = [1, 2, 5, 9, 13, 15];
  function mengen(i, t) {
    var m = { staerke: 1, eiweiss: 1, fett: 1, ballast: 1, wasser: 1 };
    for (var k = 0; k <= i; k++) {
      var z = STATIONEN[k].n, f = k < i ? 1 : t;
      Object.keys(z).forEach(function (key) { m[key] = m[key] + (z[key] - m[key]) * f; });
    }
    return m;
  }
  function zeichneVerdauung(i, t) {
    U.leeren(W.flaeche);
    var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 440', role: 'img', 'aria-label': 'Schema der Verdauungsorgane mit dem Weg der Nahrung' }, W.flaeche);
    U.auswahl(svg, function (id) { info(AN.verdauung, id); });
    var g = U.svg('g', {}, svg), A = AN.verdauung;
    U.svg('path', { d: 'M150 40 C150 0 270 0 270 40 L290 140 C380 160 390 220 390 300 L380 430 L40 430 L30 300 C30 220 40 160 130 140 Z', fill: 'var(--b-plasma)', stroke: 'var(--border)', 'stroke-width': 2 }, g);
    wb(U.svg('path', { d: 'M185 30 C190 15 230 15 235 30 L232 55 L188 55 Z', fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, g), 'mund', A);
    rohr(g, 'M210 55 L210 185', 12, 'var(--b-organ)', 'var(--b-organ-l)', 'speiseroehre', A);
    wb(U.svg('path', { d: 'M100 175 C110 150 220 150 228 180 C232 215 190 235 150 230 C110 225 95 205 100 175 Z', fill: 'var(--b-organ-l)', 'fill-opacity': 0.45, stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, g), 'leber', A);
    wb(U.svg('ellipse', { cx: 175, cy: 238, rx: 13, ry: 9, fill: 'var(--b-chloro-f)', stroke: 'var(--b-chloro)', 'stroke-width': 2 }, g), 'galle', A);
    wb(U.svg('path', { d: 'M215 180 C250 170 300 190 305 230 C310 265 270 275 250 258 C235 245 240 220 215 205 Z', fill: 'var(--b-organ)', stroke: 'var(--b-organ-l)', 'stroke-width': 2 }, g), 'magen', A);
    wb(U.svg('path', { d: 'M215 268 C240 260 300 262 320 272', fill: 'none', stroke: 'var(--b-golgi)', 'stroke-width': 9, 'stroke-linecap': 'round' }, g), 'bauchspeicheldruese', A);
    wb(U.svg('path', { d: 'M135 380 L135 210 L305 210 L305 370', fill: 'none', stroke: 'var(--b-organ-l)', 'stroke-width': 24, 'stroke-linejoin': 'round', opacity: 0.55 }, g), 'dickdarm', A);
    wb(U.svg('path', { d: 'M135 380 C125 395 120 405 128 412', fill: 'none', stroke: 'var(--b-organ-l)', 'stroke-width': 10, 'stroke-linecap': 'round', opacity: 0.8 }, g), 'blinddarm', A);
    wb(U.svg('path', { d: 'M180 290 C200 280 240 280 255 295 C270 310 200 315 180 325 C160 335 230 345 255 350 C270 355 230 365 200 370 C180 372 160 365 150 380', fill: 'none', stroke: 'var(--b-organ)', 'stroke-width': 15, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g), 'duenndarm', A);
    U.svg('path', { d: 'M180 290 C200 280 240 280 255 295 C270 310 200 315 180 325 C160 335 230 345 255 350 C270 355 230 365 200 370 C180 372 160 365 150 380', fill: 'none', stroke: 'var(--b-organ-l)', 'stroke-width': 1.2, 'pointer-events': 'none' }, g);
    wb(U.svg('path', { d: 'M305 370 C300 395 250 395 225 400 L215 430', fill: 'none', stroke: 'var(--b-organ-l)', 'stroke-width': 14, 'stroke-linecap': 'round', opacity: 0.7 }, g), 'enddarm', A);
    // Nahrungsbissen
    var bis = WEG_IDX[i], von = i ? WEG_IDX[i - 1] : 0, zug = WEG_V.slice(von, bis + 1), p = aufZug(zug, t);
    U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: 9, fill: 'var(--b-golgi)', stroke: 'var(--line)', 'stroke-width': 1.5, 'pointer-events': 'none' }, svg);
    // Nährstoffe
    var m = mengen(i, t), BX = 430, BY = 80;
    U.svg('text', { x: BX, y: BY - 30, class: 'lbl', text: 'Noch im Nahrungsbrei' }, svg);
    NAEHR.forEach(function (n, k) {
      var y = BY + k * 50;
      U.svg('text', { x: BX, y: y - 6, class: 'val', text: n[1] }, svg);
      U.svg('rect', { x: BX, y: y, width: 180, height: 18, rx: 4, class: 'balken-bg' }, svg);
      U.svg('rect', { x: BX, y: y, width: f1(180 * m[n[0]]), height: 18, rx: 4, fill: n[2] }, svg);
    });
    var insBlut = (1 - m.staerke + 1 - m.eiweiss + 1 - m.fett) / 3;
    U.svg('text', { x: BX, y: BY + 5 * 50 + 10, class: 'lbl', text: 'Ins Blut aufgenommen: ' + Math.round(insBlut * 100) + ' %' }, svg);
    U.svg('text', { x: BX, y: BY + 5 * 50 + 30, class: 'val', text: 'als Zucker, Aminosäuren, Fettsäuren' }, svg);
    if (etiketten) U.beschriftung(svg, [{ x: 210, y: 40, text: 'Mund' }, { x: 210, y: 120, text: 'Speiseröhre' }, { x: 130, y: 190, text: 'Leber' }, { x: 175, y: 238, text: 'Gallenblase' }, { x: 280, y: 215, text: 'Magen' }, { x: 300, y: 270, text: 'Bauchspeicheldrüse' }, { x: 230, y: 325, text: 'Dünndarm' }, { x: 305, y: 330, text: 'Dickdarm' }, { x: 125, y: 400, text: 'Blinddarm' }, { x: 215, y: 420, text: 'Enddarm' }], 420, 440, { mitte: 215, oben: 20 });
  }
  function startVerdauung() {
    W.leiste.innerHTML = ''; W.werkzeug.innerHTML = ''; W.extra.innerHTML = '';
    var pb = U.html('div', {}, W.werkzeug);
    var letzte = [0, 0];
    leisteEtiketten(function () { zeichneVerdauung(letzte[0], letzte[1]); });
    spieler = U.player(pb, { schritte: STATIONEN.map(function (s) { return { titel: s.titel, text: s.text, dauer: s.dauer }; }), zeichne: function (i, t) { letzte = [i, t]; zeichneVerdauung(i, t); } });
    U.html('p', { class: 'small muted', text: 'Die Balken zeigen, wie viel der Nährstoffe noch unverdaut im Nahrungsbrei ist. Die Werte sind geschätzte Anteile zur Veranschaulichung, keine Messwerte.' }, W.werkzeug);
    U.info(W.info, { name: 'Verdauung', text: 'Verfolge einen Bissen durch den Verdauungstrakt. Tippe Organe an, um mehr zu erfahren.' });
    U.art(W.art, 'schema', 'Lage und Größe der Organe vereinfacht.');
  }

  // ================================================================== Nervensystem
  var NV = { modus: 'reflex' };
  var N_ZUG = {
    reflex: [[255, 300], [210, 300], [150, 290], [118, 250], [124, 236], [150, 252], [210, 292], [250, 292]],
    bewusst: [[95, 72], [80, 68], [70, 80], [100, 120], [108, 160], [114, 236], [150, 252], [210, 292], [250, 292]],
  };
  function zeichneNerven(i, t) {
    U.leeren(W.flaeche);
    var svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 440', role: 'img', 'aria-label': NV.modus === 'reflex' ? 'Schema des Kniesehnenreflexes' : 'Schema einer bewussten Reaktion' }, W.flaeche);
    U.auswahl(svg, function (id) { info(AN.nerven, id); });
    var A = AN.nerven, g = U.svg('g', {}, svg), fertig = i === 3 ? t : i > 3 ? 1 : 0;
    // Stuhl und Körper (sitzend, von der Seite)
    U.svg('path', { d: 'M90 330 L310 330 M110 330 L110 430 M290 330 L290 430', stroke: 'var(--border)', 'stroke-width': 8, fill: 'none' }, g);
    U.svg('circle', { cx: 100, cy: 75, r: 45, fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, g);
    U.svg('path', { d: 'M80 120 L130 120 L140 320 L90 320 Z', fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, g);
    U.svg('path', { d: 'M110 290 L280 290 L280 322 L110 322 Z', fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, g);
    wb(U.svg('path', { d: 'M150 290 C190 278 240 278 268 292 L262 304 C230 296 190 296 150 302 Z', fill: 'var(--b-muskel)', 'fill-opacity': 0.55 + 0.35 * fertig, stroke: 'var(--b-muskel)', 'stroke-width': 1.5 }, g), 'muskel', A);
    var kick = NV.modus ? fertig * 38 : 0;
    var gb = U.svg('g', { transform: 'rotate(' + f1(-kick) + ' 280 306)' }, g);
    U.svg('path', { d: 'M266 300 L294 300 L292 425 L270 425 Z', fill: 'var(--b-plasma)', stroke: 'var(--b-membran)', 'stroke-width': 2 }, gb);
    U.svg('path', { d: 'M270 425 L320 425 L320 435 L268 435 Z', fill: 'var(--b-membran)' }, gb);
    wb(U.svg('path', { d: 'M75 50 C80 30 125 30 132 52 C140 75 120 95 98 92 C80 90 70 70 75 50 Z', fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 2 }, g), 'gehirn', A);
    wb(U.svg('path', { d: 'M100 95 C104 150 108 200 114 300', fill: 'none', stroke: 'var(--b-nerv)', 'stroke-width': 9, 'stroke-linecap': 'round' }, g), 'rueckenmark', A);
    wb(U.svg('circle', { cx: 132, cy: 72, r: 7, fill: 'var(--card)', stroke: 'var(--line)', 'stroke-width': 2 }, g), 'auge', A);
    wb(U.svg('path', { d: 'M255 300 C210 300 150 290 118 252', fill: 'none', stroke: 'var(--b-co2)', 'stroke-width': 3, 'stroke-dasharray': '7 4' }, g), 'sensorisch', A);
    wb(U.svg('path', { d: 'M124 236 C150 252 210 292 250 292', fill: 'none', stroke: 'var(--b-o2)', 'stroke-width': 3 }, g), 'motorisch', A);
    wb(U.svg('circle', { cx: 120, cy: 243, r: 8, fill: 'var(--b-nerv)', stroke: 'var(--line)', 'stroke-width': 1.5 }, g), 'synapse', A);
    wb(U.svg('ellipse', { cx: 255, cy: 297, rx: 8, ry: 5, fill: 'var(--b-co2-f)', stroke: 'var(--b-co2)', 'stroke-width': 1.5 }, g), 'rezeptor', A);
    // Reiz
    if (NV.modus === 'reflex') {
      var hx = 330 - (i === 0 ? t * 30 : 30);
      U.svg('path', { d: 'M' + (hx + 40) + ' 240 L' + hx + ' 312', stroke: 'var(--muted)', 'stroke-width': 4 }, svg);
      U.svg('rect', { x: hx - 12, y: 306, width: 26, height: 14, rx: 4, fill: 'var(--muted)', transform: 'rotate(-30 ' + hx + ' 312)' }, svg);
    } else {
      var bx = 520 - (i === 0 ? t : 1) * 140 - fertig * 40;
      U.svg('circle', { cx: f1(bx), cy: 400, r: 18, fill: 'var(--b-golgi)', stroke: 'var(--line)', 'stroke-width': 1.5 }, svg);
      if (i <= 1) U.svg('line', { x1: 136, y1: 72, x2: f1(bx), y2: 400, stroke: 'var(--lamp)', 'stroke-width': 2, 'stroke-dasharray': '3 5' }, svg);
    }
    // Signal
    if (i >= 1 && i <= 2) {
      var zug = N_ZUG[NV.modus], half = Math.floor(zug.length / 2) + (NV.modus === 'reflex' ? 0 : 1);
      var f = i === 1 ? t * 0.5 : 0.5 + t * 0.5, p = aufZug(zug, f);
      U.svg('circle', { cx: f1(p[0]), cy: f1(p[1]), r: 8, fill: 'var(--lamp)', stroke: 'var(--line)', 'stroke-width': 2, 'pointer-events': 'none' }, svg);
    }
    if (etiketten) U.beschriftung(svg, [{ x: 100, y: 45, text: 'Gehirn' }, { x: 134, y: 72, text: 'Auge' }, { x: 106, y: 170, text: 'Rückenmark' }, { x: 120, y: 243, text: 'Umschaltstelle (Synapse)' }, { x: 200, y: 296, text: 'Sensorische Nervenfaser' }, { x: 190, y: 278, text: 'Motorische Nervenfaser' }, { x: 230, y: 287, text: 'Oberschenkelmuskel' }, { x: 255, y: 297, text: 'Dehnungsrezeptor' }], VW, 440, { mitte: 200, oben: 20, unten: 30 });
  }
  var NEU = { t: 0, laeuft: false };
  function zeichneNeuron() {
    var svg = W.flaeche.querySelector('svg');
    if (!svg || !svg._neuron) { U.leeren(W.flaeche); svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 300', role: 'img', 'aria-label': 'Schema einer Nervenzelle' }, W.flaeche); svg._neuron = true; U.auswahl(svg, function (id) { info(AN.neuron, id); }); }
    U.leeren(svg);
    var A = AN.neuron, g = U.svg('g', {}, svg);
    var gd = wb(U.svg('g', {}, g), 'dendrit', A);
    [[-60, -50], [-70, 0], [-55, 55], [-20, -70], [-20, 70]].forEach(function (d) { U.svg('path', { d: 'M110 150 l' + d[0] + ' ' + d[1] + ' m' + (-d[0] * 0.4) + ' ' + (-d[1] * 0.4) + ' l' + (d[1] * 0.25) + ' ' + (-d[0] * 0.25), fill: 'none', stroke: 'var(--b-nerv)', 'stroke-width': 5, 'stroke-linecap': 'round' }, gd); });
    wb(U.svg('circle', { cx: 110, cy: 150, r: 38, fill: 'var(--b-nerv)', 'fill-opacity': 0.35, stroke: 'var(--b-nerv)', 'stroke-width': 3 }, g), 'soma', A);
    wb(U.svg('circle', { cx: 106, cy: 146, r: 14, fill: 'var(--b-kern-f)', stroke: 'var(--b-kern)', 'stroke-width': 2 }, g), 'kern', A);
    wb(U.svg('path', { d: 'M148 150 L560 150', stroke: 'var(--b-nerv)', 'stroke-width': 6 }, g), 'axon', A);
    var gm = wb(U.svg('g', {}, g), 'myelin', A);
    for (var k = 0; k < 6; k++) U.svg('rect', { x: 170 + k * 64, y: 138, width: 54, height: 24, rx: 12, fill: 'var(--card)', stroke: 'var(--b-nerv)', 'stroke-width': 2 }, gm);
    var ge = wb(U.svg('g', {}, g), 'endknoepfchen', A);
    [[-40, 30], [0, 40], [40, 30]].forEach(function (d) { U.svg('path', { d: 'M560 150 l' + d[0] + ' ' + d[1], stroke: 'var(--b-nerv)', 'stroke-width': 4, fill: 'none' }, ge); U.svg('circle', { cx: 560 + d[0], cy: 150 + d[1] + 8, r: 9, fill: 'var(--b-nerv)' }, ge); });
    // Signal springt von Lücke zu Lücke (saltatorisch)
    if (NEU.laeuft || NEU.t > 0) {
      var knoten = [150, 167, 231, 295, 359, 423, 487, 560], j = Math.min(knoten.length - 1, Math.floor(NEU.t * knoten.length));
      U.svg('circle', { cx: knoten[j], cy: 150, r: 9, fill: 'var(--lamp)', stroke: 'var(--line)', 'stroke-width': 2, 'pointer-events': 'none' }, svg);
      if (NEU.t > 0.95) for (var b = 0; b < 6; b++) U.svg('circle', { cx: 520 + b * 16, cy: 210 + (b % 2) * 8, r: 3, fill: 'var(--c3)', 'pointer-events': 'none' }, svg);
    }
    if (etiketten) U.beschriftung(svg, [{ x: 60, y: 100, text: 'Dendriten' }, { x: 110, y: 185, text: 'Zellkörper' }, { x: 106, y: 146, text: 'Zellkern' }, { x: 197, y: 138, text: 'Myelinscheide' }, { x: 230, y: 150, text: 'Axon' }, { x: 560, y: 198, text: 'Endknöpfchen' }], VW, 300, { mitte: 140 });
  }
  function startNerven() {
    W.leiste.innerHTML = ''; W.werkzeug.innerHTML = ''; W.extra.innerHTML = '';
    var s = U.html('div', { class: 'row' }, W.werkzeug), seg = U.html('div', {}, s);
    U.seg(seg, [{ wert: 'reflex', text: 'Kniesehnenreflex' }, { wert: 'bewusst', text: 'Bewusste Reaktion' }, { wert: 'neuron', text: 'Nervenzelle' }], NV.modus, function (v) { stopp(); NV.modus = v; startNerven(); }, 'Ablauf');
    if (NV.modus === 'neuron') {
      var bS = U.html('button', { type: 'button', class: 'primary', text: 'Signal senden' }, W.leiste);
      leisteEtiketten(zeichneNeuron);
      takt = U.takt(function (dt) { NEU.t += dt / 2.2; if (NEU.t >= 1.15) { NEU.t = 0; NEU.laeuft = false; takt.aus(); } zeichneNeuron(); });
      bS.addEventListener('click', function () { NEU.t = 0; NEU.laeuft = true; takt.an(); });
      U.info(W.info, { name: 'Nervenzelle', text: 'Tippe die Teile an. „Signal senden“ zeigt, wie der elektrische Impuls an den Lücken der Myelinscheide entlangspringt und am Ende Botenstoffe freigesetzt werden.' });
      U.art(W.art, 'schema');
      zeichneNeuron();
      return;
    }
    var letzte = [0, 0];
    leisteEtiketten(function () { zeichneNerven(letzte[0], letzte[1]); });
    var pb = U.html('div', {}, W.werkzeug);
    var reflex = NV.modus === 'reflex';
    spieler = U.player(pb, {
      schritte: reflex ? [
        { titel: 'Reiz', text: 'Der Hammer trifft die Sehne unter der Kniescheibe. Dadurch wird der Oberschenkelmuskel kurz gedehnt; Dehnungsrezeptoren im Muskel werden erregt.', dauer: 2 },
        { titel: 'Zum Rückenmark', text: 'Eine sensorische Nervenfaser leitet das Signal zum Rückenmark.', dauer: 2 },
        { titel: 'Umschalten und zurück', text: 'Im Rückenmark wird das Signal direkt auf eine motorische Nervenfaser umgeschaltet – ohne Umweg über das Gehirn.', dauer: 2 },
        { titel: 'Reaktion', text: 'Der Muskel zieht sich zusammen, das Bein schnellt nach vorn. Das Ganze dauert nur etwa 0,03 bis 0,05 Sekunden. Erst danach erfährt das Gehirn davon.', dauer: 2 },
      ] : [
        { titel: 'Reiz', text: 'Ein Ball rollt heran. Das Auge nimmt den Lichtreiz auf.', dauer: 2 },
        { titel: 'Zum Gehirn', text: 'Der Sehnerv leitet das Signal zum Gehirn. Dort wird es verarbeitet: Was ist das? Was tue ich?', dauer: 2.4 },
        { titel: 'Entscheidung und Befehl', text: 'Das Gehirn schickt einen Befehl über das Rückenmark und eine motorische Nervenfaser zum Muskel.', dauer: 2.4 },
        { titel: 'Reaktion', text: 'Der Muskel zieht sich zusammen, das Bein kickt. Eine bewusste Reaktion dauert meist etwa 0,2 bis 0,3 Sekunden – deutlich länger als ein Reflex.', dauer: 2 },
      ],
      zeichne: function (i, t) { letzte = [i, t]; zeichneNerven(i, t); },
    });
    U.html('p', { class: 'small muted', text: 'Stark verlangsamt. Zeiten sind typische, gerundete Werte.' }, W.werkzeug);
    U.info(W.info, { name: reflex ? 'Kniesehnenreflex' : 'Bewusste Reaktion', text: reflex ? 'Ein Reflex läuft unwillkürlich und sehr schnell ab, weil das Signal schon im Rückenmark umgeschaltet wird.' : 'Bei einer bewussten Reaktion muss das Gehirn den Reiz erst verarbeiten. Das kostet Zeit.' });
    U.art(W.art, 'schema', 'Nervenbahnen stark vereinfacht: In Wirklichkeit sind es Bündel aus vielen Nervenfasern.');
  }

  // ================================================================== Steuerung
  function wechsle(id) {
    stopp(); spieler = null; takt = null; sel = null;
    aktiv = id;
    U.segSetze(W.unter, id);
    if (id === 'herz') startHerz(); else if (id === 'atmung') startAtmung(); else if (id === 'verdauung') startVerdauung(); else startNerven();
    BL.unterGewechselt && BL.unterGewechselt('anatomie', id);
  }
  M.init = function (panel) { W = U.werkbank(panel, { id: 'an', unter: true }); U.unterReiter(W.unter, M.unter, 'herz', wechsle); };
  M.zeigen = function (unter) {
    var ok = M.unter.some(function (u) { return u.wert === unter; });
    if (ok && unter !== aktiv) wechsle(unter); else if (!aktiv) wechsle('herz'); else wechsle(aktiv);
    return aktiv;
  };
  M.verstecken = stopp;
  BL.module.anatomie = M;
})(window);
