// BioLab · Modul Genetik: DNA-Modell mit Basenpaarung, Erbgänge mit Kreuzungsschema und Zufallsstichproben
(function (root) {
  'use strict';
  var BL = root.BL, U = BL.ui, GN = BL.genetik;
  var VW = 640;

  var M = {
    titel: 'Genetik', kurz: 'Ein DNA-Modell zusammensetzen und Erbgänge durchspielen: Allele kombinieren, Wahrscheinlichkeiten ablesen, Familien vergleichen.',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M14 6 C34 18 38 30 58 42 M58 6 C38 18 34 30 14 42"/><path d="M22 11 h28 M30 18 h12 M30 30 h12 M22 37 h28" stroke-width="1.8"/></svg>',
    unter: [{ wert: 'dna', text: 'DNA-Modell' }, { wert: 'erbgang', text: 'Erbgänge' }],
  };
  var W, aktiv = null;
  function f1(x) { return Math.round(x * 10) / 10; }

  // ================================================================== DNA
  var D = { oben: '', unten: [], wahl: 0, helix: false, drehung: 0, takt: null, meldung: '' };
  var N = 10, FARBE = { A: 'var(--b-A)', T: 'var(--b-T)', G: 'var(--b-G)', C: 'var(--b-C)' };
  function neueSequenz() { N = W.flaeche.clientWidth > 0 && W.flaeche.clientWidth < 560 ? 6 : 10; D.oben = GN.zufallsStrang(N, Math.random); D.unten = Array(N).fill(null); D.wahl = 0; D.meldung = ''; zeichneDNA(); }
  // Basen-Form: A spitz, T mit Kerbe; G rund, C mit runder Mulde – Schlüssel-Schloss-artig passend
  function basenPfad(b, x, y0, y1, oben) {
    var w = 26, m = y1, d = oben ? 1 : -1, l = x - w / 2, r = x + w / 2, tip;
    if (b === 'A') tip = ' L' + x + ' ' + (m + 9 * d) + ' L' + r + ' ' + m;
    else if (b === 'T') tip = ' L' + x + ' ' + (m - 9 * d) + ' L' + r + ' ' + m;
    else if (b === 'G') tip = ' Q' + x + ' ' + (m + 18 * d) + ' ' + r + ' ' + m;
    else tip = ' Q' + x + ' ' + (m - 18 * d) + ' ' + r + ' ' + m;
    return 'M' + l + ' ' + y0 + ' L' + l + ' ' + m + tip + ' L' + r + ' ' + y0 + ' Z';
  }
  function zeichneDNA() {
    N = D.oben.length;
    var breite = N > 6 ? VW : 400, svg = W.flaeche.querySelector('svg');
    if (!svg || !svg._dna) {
      U.leeren(W.flaeche);
      svg = U.svg('svg', { viewBox: '0 0 ' + breite + ' 380', role: 'img', 'aria-label': 'DNA-Modell: oberer Strang vorgegeben, unteren Strang ergänzen' }, W.flaeche);
      svg._dna = true;
      U.auswahl(svg, function (id, el) {
        var slot = el.getAttribute('data-slot');
        if (slot !== null) { D.wahl = Number(slot); zeichneDNA(); }
        var t = BL.dnaTeile[id]; if (t) U.info(W.info, { name: t.name, text: t.text });
      });
    }
    U.leeren(svg); svg.setAttribute('viewBox', '0 0 ' + breite + ' 380');
    var g = U.svg('g', {}, svg), x0 = 70, dx = 55;
    var richtig = 0;
    for (var i = 0; i < N; i++) {
      var x = x0 + i * dx, b1 = D.oben[i], b2 = D.unten[i], ok = b2 && GN.passt(b1, b2);
      if (ok) richtig++;
      var phi = i * 0.62 + D.drehung, c = Math.cos(phi);
      var yo = D.helix ? 190 - 95 * c : 70, yu = D.helix ? 190 + 95 * c : 310;
      var mitte = (yo + yu) / 2, vorn = !D.helix || Math.sin(phi) > 0;
      var op = vorn ? 1 : 0.45;
      if (!D.helix) {
        // Rückgrat: Phosphat und Zucker
        U.waehlbar(U.svg('circle', { cx: x - 27, cy: yo - 22, r: 9, fill: 'var(--b-golgi)', opacity: op }, g), 'phosphat', 'Phosphat');
        U.waehlbar(U.svg('path', { d: 'M' + (x - 11) + ' ' + (yo - 30) + ' l11 -7 l11 7 l-4 13 h-14 z', fill: 'var(--b-er)', opacity: op }, g), 'zucker', 'Zucker');
        U.waehlbar(U.svg('circle', { cx: x - 27, cy: yu + 22, r: 9, fill: 'var(--b-golgi)', opacity: op }, g), 'phosphat', 'Phosphat');
        U.waehlbar(U.svg('path', { d: 'M' + (x - 11) + ' ' + (yu + 30) + ' l11 7 l11 -7 l-4 -13 h-14 z', fill: 'var(--b-er)', opacity: op }, g), 'zucker', 'Zucker');
        U.svg('line', { x1: x - 27, y1: yo - 22, x2: x - 11, y2: yo - 30, stroke: 'var(--muted)', 'stroke-width': 2 }, g);
        if (i < N - 1) { U.svg('line', { x1: x + 11, y1: yo - 30, x2: x + dx - 27, y2: yo - 22, stroke: 'var(--muted)', 'stroke-width': 2 }, g); U.svg('line', { x1: x + 11, y1: yu + 30, x2: x + dx - 27, y2: yu + 22, stroke: 'var(--muted)', 'stroke-width': 2 }, g); }
        U.svg('line', { x1: x - 27, y1: yu + 22, x2: x - 11, y2: yu + 30, stroke: 'var(--muted)', 'stroke-width': 2 }, g);
        U.waehlbar(U.svg('path', { d: basenPfad(b1, x, yo - 23, mitte - 14, true), fill: FARBE[b1], stroke: 'var(--line)', 'stroke-width': 1 }, g), b1, b1);
        U.svg('text', { x: x, y: yo + 18, 'text-anchor': 'middle', class: 'lbl', text: b1, 'pointer-events': 'none' }, g);
        if (b2) {
          var p = U.waehlbar(U.svg('path', { d: basenPfad(b2, x, yu + 23, ok ? mitte + 14 : mitte + 22, false), fill: FARBE[b2], stroke: ok ? 'var(--line)' : 'var(--warn)', 'stroke-width': ok ? 1 : 3 }, g), b2, b2);
          p.setAttribute('data-slot', i);
          U.svg('text', { x: x, y: yu - 10, 'text-anchor': 'middle', class: 'lbl', text: b2, 'pointer-events': 'none' }, g);
        } else {
          var leer = U.waehlbar(U.svg('rect', { x: x - 14, y: mitte + 12, width: 28, height: yu + 23 - mitte - 12, rx: 4, fill: 'var(--bg)', stroke: i === D.wahl ? 'var(--accent)' : 'var(--border)', 'stroke-width': i === D.wahl ? 3 : 1.5, 'stroke-dasharray': '4 3' }, g), 'nukleotid', 'Freie Stelle ' + (i + 1));
          leer.setAttribute('data-slot', i);
          U.svg('text', { x: x, y: yu - 10, 'text-anchor': 'middle', class: 'val', text: '?', 'pointer-events': 'none' }, g);
        }
        if (ok) {
          var nb = GN.BRUECKEN[b1], gb = U.waehlbar(U.svg('g', {}, g), 'bruecke', 'Wasserstoffbrücken');
          for (var k = 0; k < nb; k++) { var bx = x - 8 + k * (16 / (nb - 1)); U.svg('line', { x1: bx, y1: mitte - 12, x2: bx, y2: mitte + 12, stroke: 'var(--line)', 'stroke-width': 1.6, 'stroke-dasharray': '2 2' }, gb); }
        }
        if (i === D.wahl && !ok) U.svg('path', { d: 'M' + (x - 8) + ' ' + (yu + 48) + ' l8 -8 l8 8', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 }, g);
      } else {
        // Doppelhelix in der Seitenansicht: Basenpaare als Sprossen, hinten blasser
        var gg = U.svg('g', { opacity: op }, g);
        U.svg('line', { x1: x, y1: yo, x2: x, y2: mitte, stroke: FARBE[b1], 'stroke-width': 9 }, gg);
        U.svg('line', { x1: x, y1: mitte, x2: x, y2: yu, stroke: b2 ? FARBE[b2] : 'var(--border)', 'stroke-width': 9, 'stroke-dasharray': b2 ? null : '4 3' }, gg);
        U.svg('circle', { cx: x, cy: yo, r: 6, fill: 'var(--b-er)' }, gg);
        U.svg('circle', { cx: x, cy: yu, r: 6, fill: 'var(--b-er)' }, gg);
      }
    }
    if (D.helix) {
      // Rückgrate als glatte Kurven
      ['oben', 'unten'].forEach(function (s, j) {
        var d = '';
        for (var t = 0; t <= (N - 1) * 8; t++) { var u = t / 8, xx = x0 + u * dx, ph = u * 0.62 + D.drehung, yy = 190 + (j ? 95 : -95) * Math.cos(ph); d += (t ? ' L' : 'M') + f1(xx) + ' ' + f1(yy); }
        U.svg('path', { d: d, fill: 'none', stroke: 'var(--b-er)', 'stroke-width': 4, opacity: 0.8 }, svg);
      });
      U.svg('text', { x: 20, y: 370, class: 'val', text: N > 6 ? 'Seitenansicht der Doppelhelix: Ein voller Umlauf umfasst etwa 10 Basenpaare.' : 'Seitenansicht der Doppelhelix' }, svg);
    } else {
      U.svg('text', { x: 14, y: 26, class: 'val', text: 'vorgegebener Strang' }, svg);
      U.svg('text', { x: 14, y: 372, class: 'val', text: N > 6 ? 'ergänzter Strang – tippe eine Stelle an und wähle eine Base' : 'ergänzter Strang – Stelle antippen' }, svg);
    }
    var st = U.$('dna-stand');
    if (st) {
      st.textContent = richtig + ' von ' + N + ' Basenpaaren passen.' + (D.meldung ? ' ' + D.meldung : '');
      if (richtig === N) {
        var anteil = function (b) { return (D.oben + D.unten.join('')).split(b).length - 1; };
        st.textContent = 'Der Doppelstrang ist vollständig. A: ' + anteil('A') + ', T: ' + anteil('T') + ', G: ' + anteil('G') + ', C: ' + anteil('C') + ' – es gibt immer gleich viel A wie T und gleich viel G wie C.';
      }
    }
  }
  function setze(b) {
    var i = D.wahl, soll = GN.komplement(D.oben[i]);
    D.unten[i] = b;
    if (b === soll) {
      D.meldung = '';
      for (var k = 1; k <= N; k++) { var j = (i + k) % N; if (!D.unten[j] || !GN.passt(D.oben[j], D.unten[j])) { D.wahl = j; break; } }
      var t = BL.dnaTeile[b]; U.info(W.info, { name: 'Passt: ' + D.oben[i] + '–' + b, text: t.text });
    } else {
      D.meldung = 'Stelle ' + (i + 1) + ': ' + b + ' passt nicht zu ' + D.oben[i] + '.';
      U.info(W.info, { name: 'Passt nicht', text: D.oben[i] + ' paart sich nur mit ' + soll + '. Die Formen der Basen passen nur in diesen Kombinationen zusammen, und nur dann bilden sich die Wasserstoffbrücken.' });
    }
    zeichneDNA();
  }
  function startDNA() {
    U.leeren(W.flaeche); W.leiste.innerHTML = ''; W.werkzeug.innerHTML = ''; W.extra.innerHTML = '';
    var w = W.werkzeug;
    U.html('p', { class: 'feld-titel', text: 'Base für die gewählte Stelle' }, w);
    var row = U.html('div', { class: 'row eng' }, w);
    ['A', 'T', 'G', 'C'].forEach(function (b) {
      var bt = U.html('button', { type: 'button', text: b + ' ' + BL.dnaTeile[b].name.split(' ')[0], style: 'border-left:6px solid ' + FARBE[b] }, row);
      bt.addEventListener('click', function () { setze(b); });
    });
    U.html('p', { class: 'small muted', text: 'Tastatur: Pfeiltasten wählen die Stelle, A, T, G oder C setzt die Base.' }, w);
    U.html('p', { class: 'hinweisbox', id: 'dna-stand', 'aria-live': 'polite' }, w);
    var row2 = U.html('div', { class: 'row eng' }, w);
    var bL = U.html('button', { type: 'button', text: 'Lösung zeigen' }, row2), bN = U.html('button', { type: 'button', text: 'Neue Sequenz' }, row2);
    bL.addEventListener('click', function () { D.unten = D.oben.split('').map(GN.komplement); D.meldung = ''; zeichneDNA(); });
    bN.addEventListener('click', neueSequenz);
    var lab = U.html('label', { class: 'check' }, W.leiste);
    lab.innerHTML = '<input type="checkbox"' + (D.helix ? ' checked' : '') + '> als Doppelhelix';
    lab.querySelector('input').addEventListener('change', function () { D.helix = this.checked; if (D.helix) D.takt.an(); else { D.takt.aus(); D.drehung = 0; } zeichneDNA(); });
    D.takt = U.takt(function (dt) { D.drehung += dt * 0.6; zeichneDNA(); });
    W.flaeche.tabIndex = 0;
    W.flaeche.setAttribute('aria-label', 'DNA-Modell: Pfeiltasten wählen die Stelle, A, T, G oder C setzt die Base');
    W.flaeche.onkeydown = function (e) {
      if (aktiv !== 'dna') return;
      var k = e.key.toUpperCase();
      if ('ATGC'.indexOf(k) >= 0 && k.length === 1) { e.preventDefault(); setze(k); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); D.wahl = (D.wahl + 1) % N; zeichneDNA(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); D.wahl = (D.wahl + N - 1) % N; zeichneDNA(); }
    };
    U.info(W.info, { name: 'DNA', text: 'Die DNA besteht aus zwei Strängen. Jeder Baustein (Nukleotid) hat ein Phosphat, einen Zucker und eine von vier Basen. Ergänze den unteren Strang: A paart mit T, G mit C. Tippe Teile an, um sie zu erklären.' });
    U.art(W.art, 'modell', 'Basenformen sind Symbole für die passende Paarung. In Wirklichkeit ist die DNA nur etwa 2 nm dick.');
    if (!D.oben) neueSequenz(); else zeichneDNA();
    if (D.helix) D.takt.an();
  }

  // ================================================================== Erbgänge
  var E = { id: 'dominant', p1: 'Gg', p2: 'Gg', familie: 4, kinder: [], viele: null };
  var PH_FARBE = {
    'gelb': 'var(--lamp)', 'grün': 'var(--b-chloro)', 'rot': 'var(--b-o2)', 'rosa': 'var(--b-o2-f)', 'weiß': 'var(--card)',
    'A': 'var(--b-A)', 'B': 'var(--b-C)', 'AB': 'var(--c3)', '0': 'var(--muted)',
    'Tochter, normal sehend': 'var(--b-chloro)', 'Tochter, normal sehend (Überträgerin)': 'var(--b-golgi)', 'Tochter, rot-grün-sehschwach': 'var(--b-o2)',
    'Sohn, normal sehend': 'var(--b-chloro)', 'Sohn, rot-grün-sehschwach': 'var(--b-o2)',
  };
  function symbol(g, x, y, ph, r) {
    var sohn = ph.indexOf('Sohn') === 0;
    if (sohn) return U.svg('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 3, fill: PH_FARBE[ph], stroke: 'var(--line)', 'stroke-width': 1.5 }, g);
    return U.svg('circle', { cx: x, cy: y, r: r, fill: PH_FARBE[ph] || 'var(--bg)', stroke: 'var(--line)', 'stroke-width': 1.5 }, g);
  }
  function genotypenListe(seite) {
    var e = GN.ERBGAENGE[E.id];
    if (E.id === 'xrezessiv') return seite === 1 ? e.genotypenMutter : e.genotypenVater;
    return e.genotypen;
  }
  function zeichneErbgang() {
    U.leeren(W.flaeche); W.extra.innerHTML = '';
    E.schmal = W.flaeche.clientWidth > 0 && W.flaeche.clientWidth < 560;
    var e = GN.ERBGAENGE[E.id], svg = U.svg('svg', { viewBox: '0 0 ' + VW + ' 330', role: 'img', 'aria-label': 'Kreuzungsschema ' + E.p1 + ' mal ' + E.p2 }, W.flaeche);
    var X0 = 120, Y0 = 50, C = 110, H = 110;
    var titel1 = E.id === 'xrezessiv' ? 'Mutter ' : 'Elternteil 1: ', titel2 = E.id === 'xrezessiv' ? 'Vater ' : 'Elternteil 2: ';
    U.svg('text', { x: X0 + C, y: 18, 'text-anchor': 'middle', class: 'lbl', text: titel1 + E.p1 + ' (' + e.phaenotyp(E.p1).replace(/^Tochter, /, '').replace(' (Überträgerin)', ', Überträgerin') + ')' }, svg);
    U.svg('text', { x: 18, y: Y0 + 30 + H, 'text-anchor': 'middle', class: 'lbl', transform: 'rotate(-90 18 ' + (Y0 + 30 + H) + ')', text: titel2 + E.p2 + ' (' + e.phaenotyp(E.p2).replace(/^Sohn, /, '') + ')' }, svg);
    var felder = GN.schema(E.id, E.p1, E.p2);
    for (var i = 0; i < 2; i++) {
      U.svg('rect', { x: X0 + i * C, y: Y0 - 4, width: C, height: 34, fill: 'var(--soft-accent)', stroke: 'var(--border)' }, svg);
      U.svg('text', { x: X0 + i * C + C / 2, y: Y0 + 19, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:18px', text: E.p1[i] }, svg);
      U.svg('rect', { x: X0 - 64, y: Y0 + 30 + i * H, width: 64, height: H, fill: 'var(--soft-accent)', stroke: 'var(--border)' }, svg);
      U.svg('text', { x: X0 - 32, y: Y0 + 30 + i * H + H / 2 + 6, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:18px', text: E.p2[i] }, svg);
    }
    felder.forEach(function (f) {
      var x = X0 + f.spalte * C, y = Y0 + 30 + f.zeile * H;
      U.svg('rect', { x: x, y: y, width: C, height: H, fill: 'var(--card)', stroke: 'var(--border)' }, svg);
      symbol(svg, x + C / 2, y + 30, f.phaenotyp, 16);
      U.svg('text', { x: x + C / 2, y: y + 68, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:17px', text: f.genotyp }, svg);
      var teile = f.phaenotyp.replace(/ \(Überträgerin\)/, ', Überträgerin').replace(/normal sehend, /, '').replace(/rot-grün-sehschwach/, 'sehschwach').split(', ');
      teile.forEach(function (t, k) { U.svg('text', { x: x + C / 2, y: y + 91 + (k - (teile.length - 1) / 2) * 15, 'text-anchor': 'middle', class: 'val', text: t }, svg); });
    });
    // Wahrscheinlichkeiten je Kind
    // schmale Ansicht (Handy): Balken unter dem Kreuzungsschema statt daneben
    var v = GN.verteilung(E.id, E.p1, E.p2).phaenotypen, BX = E.schmal ? 30 : 370, y0 = E.schmal ? 370 : 60;
    var liste = e.phaenotypen.filter(function (p) { return v[p]; });
    if (E.schmal) svg.setAttribute('viewBox', '0 0 370 ' + (y0 + liste.length * 42 + 6));
    U.svg('text', { x: BX, y: y0 - 20, class: 'lbl', text: 'Wahrscheinlichkeit für jedes Kind' }, svg);
    liste.forEach(function (p, k) {
      var y = y0 + k * 42;
      symbol(svg, BX + 10, y + 9, p, 9);
      U.svg('text', { x: BX + 26, y: y + 4, class: 'val', text: p }, svg);
      U.svg('rect', { x: BX + 26, y: y + 10, width: 200, height: 12, rx: 3, class: 'balken-bg' }, svg);
      U.svg('rect', { x: BX + 26, y: y + 10, width: f1(200 * v[p]), height: 12, rx: 3, fill: PH_FARBE[p], stroke: 'var(--line)', 'stroke-width': 0.6 }, svg);
      U.svg('text', { x: BX + 232, y: y + 21, class: 'val', text: Math.round(v[p] * 100) + ' %' }, svg);
    });
    // Familie: zufällige Kinder
    var fam = U.html('div', { class: 'lk-card', style: 'margin-top:14px' }, W.extra);
    fam.innerHTML = '<h2>Eine Familie würfeln</h2><div class="row"><label class="ctrl" style="flex:1 1 220px;margin:0"><span>Zahl der Kinder <output id="eg-n-o"></output></span><input type="range" id="eg-n" min="1" max="12" value="' + E.familie + '"></label>' +
      '<button type="button" class="primary" id="eg-w">Kinder würfeln</button><button type="button" id="eg-1000">1000 Nachkommen</button></div><div id="eg-fam"></div>';
    U.$('eg-n-o').textContent = E.familie;
    U.$('eg-n').addEventListener('input', function () { E.familie = Number(this.value); U.$('eg-n-o').textContent = E.familie; });
    U.$('eg-w').addEventListener('click', function () { E.kinder = GN.nachkommen(E.id, E.p1, E.p2, E.familie, Math.random); E.viele = null; familie(); });
    U.$('eg-1000').addEventListener('click', function () { E.viele = GN.zaehle(GN.nachkommen(E.id, E.p1, E.p2, 1000, Math.random)); familie(); });
    familie();
    var gr = U.html('div', { class: 'lk-card', style: 'margin-top:14px' }, W.extra);
    gr.innerHTML = '<h2>Grenzen des Modells</h2><ul class="small">' + BL.erbgangGrenzen.map(function (t) { return '<li>' + U.esc(t) + '</li>'; }).join('') + '</ul>';
  }
  function familie() {
    var box = U.$('eg-fam'); if (!box) return;
    var e = GN.ERBGAENGE[E.id], html = '';
    if (E.kinder.length) {
      var proZeile = E.schmal ? 6 : 12, zeilen = Math.ceil(E.kinder.length / proZeile);
      var s = U.svg('svg', { viewBox: '0 0 ' + (E.schmal ? 310 : VW) + ' ' + (zeilen * 70), role: 'img', 'aria-label': 'Zufällige Kinder: ' + E.kinder.map(function (k) { return k.phaenotyp; }).join(', ') });
      E.kinder.forEach(function (k, i) { var x = 30 + (i % proZeile) * 50, y = Math.floor(i / proZeile) * 70; symbol(s, x, y + 24, k.phaenotyp, 16); U.svg('text', { x: x, y: y + 62, 'text-anchor': 'middle', class: 'val', text: k.genotyp }, s); });
      box.innerHTML = '';
      box.appendChild(s);
      var z = GN.zaehle(E.kinder);
      U.html('p', { class: 'small', text: 'Ergebnis: ' + Object.keys(z).map(function (p) { return z[p] + '× ' + p; }).join(', ') + '. Würfle mehrmals: Jede Familie sieht anders aus, obwohl die Wahrscheinlichkeiten gleich bleiben.' }, box);
    } else box.innerHTML = '<p class="small muted">Würfle eine Familie: Jedes Elternteil gibt zufällig eines seiner beiden Allele weiter.</p>';
    if (E.viele) {
      var v = GN.verteilung(E.id, E.p1, E.p2).phaenotypen;
      html = '<table class="bl-tab"><thead><tr><th>Merkmal</th><th>gezählt bei 1000</th><th>erwartet</th></tr></thead><tbody>' +
        e.phaenotypen.filter(function (p) { return v[p] || E.viele[p]; }).map(function (p) { return '<tr><td>' + U.esc(p) + '</td><td>' + (E.viele[p] || 0) + '</td><td>' + Math.round((v[p] || 0) * 1000) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="small muted">Bei vielen Nachkommen liegen die Zahlen nahe an den erwarteten Werten, aber selten genau darauf.</p>';
      U.html('div', { html: html }, box);
    }
  }
  function werkzeugErbgang() {
    var w = W.werkzeug; w.innerHTML = '';
    U.html('p', { class: 'feld-titel', text: 'Erbgang' }, w);
    var l = U.html('div', { class: 'orgliste' }, w);
    Object.keys(GN.ERBGAENGE).forEach(function (id) {
      var b = U.html('button', { type: 'button', text: GN.ERBGAENGE[id].name, 'aria-pressed': id === E.id ? 'true' : 'false' }, l);
      b.addEventListener('click', function () {
        E.id = id; E.kinder = []; E.viele = null;
        E.p1 = genotypenListe(1)[1]; E.p2 = genotypenListe(2)[id === 'xrezessiv' ? 0 : id === 'ab0' ? 3 : 1];
        werkzeugErbgang(); zeichneErbgang();
      });
    });
    U.html('p', { class: 'small muted', text: GN.ERBGAENGE[E.id].beispiel }, w);
    [1, 2].forEach(function (seite) {
      U.html('p', { class: 'feld-titel', text: E.id === 'xrezessiv' ? (seite === 1 ? 'Mutter' : 'Vater') : 'Elternteil ' + seite }, w);
      var box = U.html('div', {}, w);
      U.seg(box, genotypenListe(seite).map(function (g) { return { wert: g, text: g }; }), seite === 1 ? E.p1 : E.p2, function (v) { if (seite === 1) E.p1 = v; else E.p2 = v; E.kinder = []; E.viele = null; zeichneErbgang(); }, 'Genotyp');
    });
    if (E.id === 'xrezessiv') U.html('p', { class: 'small muted', text: 'X = Allel für normales Farbensehen, x = Allel für Rot-Grün-Sehschwäche. Männer haben nur ein X-Chromosom: Ein einziges x reicht bei ihnen für die Sehschwäche.' }, w);
    if (E.id === 'ab0') U.html('p', { class: 'small muted', text: 'Blutgruppe A kann AA oder A0 sein, B kann BB oder B0 sein. Am Aussehen (Phänotyp) erkennt man den Genotyp nicht immer.' }, w);
    U.info(W.info, { name: 'Erbgang: ' + GN.ERBGAENGE[E.id].name, text: 'Wähle die Genotypen der Eltern. Jedes Elternteil gibt zufällig eines seiner zwei Allele weiter. Das Kreuzungsschema zeigt alle vier gleich wahrscheinlichen Kombinationen.', hinweis: 'Kreis = Tochter bzw. Nachkomme, Quadrat = Sohn (wie im Stammbaum).' });
  }
  function startErbgang() {
    U.leeren(W.flaeche); W.leiste.innerHTML = ''; W.extra.innerHTML = '';
    werkzeugErbgang(); zeichneErbgang();
    U.art(W.art, 'modell', 'Ein Gen, zwei Allele pro Elternteil, alle Keimzellen gleich wahrscheinlich.');
  }

  // ================================================================== Steuerung
  function wechsle(id) {
    if (D.takt) D.takt.aus();
    aktiv = id;
    U.segSetze(W.unter, id);
    W.flaeche.onkeydown = null; W.flaeche.removeAttribute('tabindex');
    if (id === 'dna') startDNA(); else startErbgang();
    BL.unterGewechselt && BL.unterGewechselt('genetik', id);
  }
  M.init = function (panel) {
    W = U.werkbank(panel, { id: 'ge', unter: true }); U.unterReiter(W.unter, M.unter, 'dna', wechsle);
    window.addEventListener('resize', function () {
      if (aktiv !== 'erbgang' || !W.flaeche.clientWidth) return;
      if ((W.flaeche.clientWidth < 560) !== !!E.schmal) zeichneErbgang();
    });
  };
  M.zeigen = function (unter) {
    var ok = M.unter.some(function (u) { return u.wert === unter; });
    if (ok && unter !== aktiv) wechsle(unter); else if (!aktiv) wechsle('dna'); else if (aktiv === 'dna' && D.helix && D.takt) D.takt.an();
    return aktiv;
  };
  M.verstecken = function () { if (D.takt) D.takt.aus(); };
  BL.module.genetik = M;
})(window);
