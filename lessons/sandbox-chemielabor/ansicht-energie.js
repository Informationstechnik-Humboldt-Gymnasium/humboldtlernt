// Atom- & Chemielabor · Reiter „Elektronen & Energie“
(function (root) {
  'use strict';
  var CL = root.CL, U = CL.ui, C = CL.chemie, D = CL.daten;
  var esc = U.esc, s = U.svg;
  var NMAX = 6, TOLERANZ = 0.02;
  var st = { n: 1, frei: false, photon: null, z: 11 };

  function y(E) { return 30 + (0.6 - E) / 14.6 * 330; }

  function init() {
    var r = U.$('en-photon');
    r.addEventListener('input', function () { U.$('en-photon-out').textContent = U.fmt(Number(r.value), 2) + ' eV'; });
    document.querySelectorAll('#p-energie [data-photon]').forEach(function (b) {
      b.addEventListener('click', function () { r.value = b.dataset.photon; r.dispatchEvent(new Event('input')); });
    });
    U.$('en-einstrahlen').addEventListener('click', function () { einstrahlen(Number(r.value)); });
    U.$('en-zurueck').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-nach]');
      if (!b) return;
      if (b.dataset.nach === 'reset') { st.n = 1; st.frei = false; st.photon = null; text('Das Atom ist zurückgesetzt: Elektron im Grundzustand n = 1.'); zeichne(); return; }
      zurueckfallen(Number(b.dataset.nach));
    });
    r.dispatchEvent(new Event('input'));
    U.elementOptionen(U.$('en-element'), D.IONISIERUNG.length);
    U.$('en-element').value = st.z;
    U.$('en-element').addEventListener('change', function () { st.z = Number(this.value); vergleich(); });
    spektrum();
    zeichne();
    text('Das Elektron ist im <b>Grundzustand</b> (n = 1), der Stufe mit der niedrigsten Energie. Strahle ein Photon ein.');
    vergleich();
  }

  function text(t) { U.$('en-meldung').innerHTML = t; }

  function einstrahlen(E) {
    if (st.frei) { text('Das Atom ist schon ionisiert – es hat kein Elektron mehr. Setze es zurück.'); return; }
    var En = C.wasserstoffNiveau(st.n), treffer = null;
    for (var m = st.n + 1; m <= NMAX; m++) {
      var u = C.uebergang(st.n, m);
      if (Math.abs(u.energie - E) <= TOLERANZ) treffer = { m: m, u: u };
    }
    if (treffer) {
      st.photon = { art: 'Absorption', u: treffer.u, von: st.n, nach: treffer.m };
      st.n = treffer.m;
      text('<b>Absorption:</b> Die Photonenenergie ' + U.fmt(E, 2) + ' eV passt genau zum Sprung von n = ' + st.photon.von + ' nach n = ' + st.n + '. Das Elektron ist jetzt <b>angeregt</b>.');
    } else if (E >= -En) {
      st.photon = { art: 'Ionisation', energie: E };
      st.frei = true;
      text('<b>Ionisation:</b> ' + U.fmt(E, 2) + ' eV reichen aus, um das Elektron aus n = ' + st.n + ' ganz vom Atom zu lösen (nötig: ' + U.fmt(-En, 2) + ' eV). Übrig bleibt ein positives Ion H⁺ (ein Proton). Die überschüssige Energie von ' + U.fmt(E + En, 2) + ' eV trägt das Elektron als Bewegungsenergie davon.');
      if (st.n === 1) root.LK.reach('en-ionisiert');
    } else {
      st.photon = { art: 'durch', energie: E };
      text('<b>Keine Aufnahme:</b> ' + U.fmt(E, 2) + ' eV passen zu keinem Sprung aus n = ' + st.n + '. Das Photon fliegt einfach weiter. Ein Atom nimmt nur Energieportionen auf, die genau zu einem Stufenabstand passen.');
    }
    zeichne();
  }

  function zurueckfallen(m) {
    var u = C.uebergang(st.n, m), f = C.farbeVon(u.wellenlaenge);
    st.photon = { art: 'Emission', u: u, von: st.n, nach: m };
    text('<b>Emission:</b> Das Elektron fällt von n = ' + st.n + ' auf n = ' + m + ' und gibt ein Photon mit ' + U.fmt(u.energie, 2) + ' eV ab. Wellenlänge: λ = hc / E ≈ ' + U.fmt(u.wellenlaenge, 1) + ' nm – ' + u.bereich + (f ? ' (' + f.name + ')' : '') + '.');
    st.n = m;
    if (f) root.LK.reach('en-sichtbar');
    zeichne();
  }

  function zeichne() {
    var svgEl = U.$('en-svg');
    U.leeren(svgEl);
    s('line', { x1: 40, y1: y(0.6), x2: 40, y2: y(-14), class: 'axis' }, svgEl);
    s('text', { x: 44, y: 20, class: 'val', text: 'Energie E in eV' }, svgEl);
    s('line', { x1: 60, y1: y(0), x2: 320, y2: y(0), class: 'grenze' }, svgEl);
    s('text', { x: 325, y: y(0) - 2, class: 'val', text: '0 eV' }, svgEl);
    s('text', { x: 62, y: y(0) - 5, class: 'val', text: 'Elektron frei (n = ∞)' }, svgEl);
    for (var n = 1; n <= NMAX; n++) {
      var E = C.wasserstoffNiveau(n), yy = y(E);
      s('line', { x1: 60, y1: yy, x2: 320, y2: yy, class: 'niveau' + (n === st.n && !st.frei ? ' aktiv' : '') }, svgEl);
      if (n <= 3) {
        s('text', { x: 62, y: yy + 15, class: 'lbl', text: 'n = ' + n }, svgEl);
        s('text', { x: 325, y: yy + (n === 3 ? 12 : 4), class: 'val', text: U.fmt(E, 2) + ' eV' }, svgEl);
      }
    }
    s('text', { x: 325, y: y(-0.85) + 2, class: 'val', text: 'n = 4 … 6' }, svgEl);
    // Photon
    if (st.photon && st.photon.u) {
      var f = C.farbeVon(st.photon.u.wellenlaenge), y1 = y(C.wasserstoffNiveau(st.photon.von)), y2 = y(C.wasserstoffNiveau(st.photon.nach));
      s('line', { x1: 200, y1: y1, x2: 200, y2: y2, class: 'sprung', 'marker-end': null }, svgEl);
      var welle = 'M ' + (st.photon.art === 'Emission' ? '210 ' : '120 ') + ((y1 + y2) / 2);
      for (var k = 1; k <= 8; k++) welle += ' q 4 ' + (k % 2 ? -8 : 8) + ' 8 0';
      s('path', { d: welle, class: 'photon', style: f ? 'stroke:' + f.hex : null }, svgEl);
      s('text', { x: st.photon.art === 'Emission' ? 210 : 100, y: (y1 + y2) / 2 + 22, class: 'val', text: (st.photon.art === 'Emission' ? 'Photon raus' : 'Photon rein') + ' · ' + U.fmt(st.photon.u.energie, 2) + ' eV' }, svgEl);
    }
    // Elektron
    var ye = st.frei ? y(0) - 22 : y(C.wasserstoffNiveau(st.n));
    s('circle', { cx: st.frei ? 290 : 200, cy: ye, r: 7, class: 't-e' }, svgEl);
    if (st.frei) s('text', { x: 230, y: ye + 4, class: 'val', text: 'e⁻ →' }, svgEl);
    svgEl.setAttribute('aria-label', 'Energiestufen des Wasserstoffatoms. ' + (st.frei ? 'Das Atom ist ionisiert.' : 'Das Elektron ist auf Stufe n = ' + st.n + ' mit ' + U.fmt(C.wasserstoffNiveau(st.n), 2) + ' eV.'));

    var b = '';
    for (var m = 1; m < st.n && !st.frei; m++) {
      var u = C.uebergang(st.n, m);
      b += '<button type="button" data-nach="' + m + '">n = ' + m + ' <span class="small muted">(' + U.fmt(u.wellenlaenge, 0) + ' nm)</span></button>';
    }
    if (st.frei || st.n === 1) b += '<span class="small muted">' + (st.frei ? 'Kein Elektron mehr da.' : 'Schon im Grundzustand.') + '</span>';
    b += '<button type="button" data-nach="reset">Zurücksetzen</button>';
    U.$('en-zurueck').innerHTML = b;

    var ph = st.photon && st.photon.u;
    U.$('en-readouts').innerHTML =
      U.readout(st.frei ? 'H⁺' : 'n = ' + st.n, st.frei ? 'Ion (ionisiert)' : (st.n === 1 ? 'Grundzustand' : 'angeregter Zustand')) +
      U.readout(st.frei ? '–' : U.fmt(C.wasserstoffNiveau(st.n), 2) + ' eV', 'Energie Eₙ (berechnet)') +
      U.readout(ph ? U.fmt(ph.wellenlaenge, 1) + ' nm' : '–', 'Wellenlänge des Photons') +
      U.readout(ph ? esc(ph.bereich.split(' ')[0]) : '–', 'Spektralbereich');
  }

  function spektrum() {
    var svgEl = U.$('en-spektrum'), x = function (nm) { return 10 + (nm - 380) / 400 * 380; };
    var defs = s('defs', {}, svgEl), gr = s('linearGradient', { id: 'spektrum-verlauf' }, defs);
    [[380, '#5b2a9c'], [440, '#2f3fe0'], [490, '#1aa3b8'], [530, '#2f9a3f'], [575, '#e0d020'], [600, '#e8801c'], [650, '#d8322b'], [780, '#5a0f0f']].forEach(function (p) {
      s('stop', { offset: ((p[0] - 380) / 400 * 100) + '%', 'stop-color': p[1] }, gr);
    });
    s('rect', { x: 10, y: 10, width: 380, height: 34, fill: 'url(#spektrum-verlauf)', rx: 4, class: 'spektrum-band' }, svgEl);
    var zeilen = [];
    for (var n = 3; n <= 6; n++) {
      var u = C.uebergang(n, 2);
      s('line', { x1: x(u.wellenlaenge), y1: 6, x2: x(u.wellenlaenge), y2: 48, class: 'linie-h' }, svgEl);
      zeilen.push('<tr><td>Wasserstoff, n = ' + n + ' → 2</td><td>' + U.fmt(u.wellenlaenge, 1) + ' nm</td><td><span class="wertart">berechnet (Bohr)</span></td></tr>');
    }
    D.SPEKTRALLINIEN.forEach(function (l) {
      l.wellenlaengen.forEach(function (w) { if (l.element === 'Na') s('line', { x1: x(w), y1: 6, x2: x(w), y2: 48, class: 'linie-na' }, svgEl); });
      zeilen.push('<tr><td>' + esc(l.name) + '</td><td>' + l.wellenlaengen.map(function (w) { return U.fmt(w, 1); }).join(' / ') + ' nm</td><td><span class="wertart">gemessen, NIST</span></td></tr>');
    });
    [400, 500, 600, 700].forEach(function (nm) { s('text', { x: x(nm), y: 64, 'text-anchor': 'middle', class: 'val', text: nm + ' nm' }, svgEl); });
    s('text', { x: 10, y: 84, class: 'val', text: '— Wasserstoff (oben)   ┆ Natrium (unten)' }, svgEl);
    U.$('en-linien').innerHTML = '<table class="daten"><tbody>' + zeilen.join('') + '</tbody></table>' +
      '<p class="muted">Jedes Element hat seine eigenen Linien – wie ein Fingerabdruck. Leuchtet ein Gas, sendet es genau diese Farben aus (Emission); schickt man weißes Licht hindurch, fehlen genau diese Farben (Absorption). Die berechneten Wasserstoffwerte gelten im Vakuum; in Luft gemessen sind sie etwa 0,2 nm kleiner (Hα: 656,3 nm).</p>';
  }

  function vergleich() {
    var svgEl = U.$('en-ie');
    U.leeren(svgEl);
    var werte = D.IONISIERUNG, bw = 360 / werte.length, h = function (v) { return v / 25 * 170; };
    s('line', { x1: 30, y1: 190, x2: 392, y2: 190, class: 'axis' }, svgEl);
    [5, 10, 15, 20, 25].forEach(function (v) {
      s('line', { x1: 30, y1: 190 - h(v), x2: 392, y2: 190 - h(v), class: 'gridline' }, svgEl);
      s('text', { x: 26, y: 194 - h(v), 'text-anchor': 'end', class: 'val', text: v }, svgEl);
    });
    s('text', { x: 4, y: 12, class: 'val', text: 'E in eV' }, svgEl);
    werte.forEach(function (v, i) {
      var z = i + 1, e = C.element(z);
      var r = s('rect', { x: 32 + i * bw, y: 190 - h(v), width: bw - 2, height: h(v), class: 'balken k-' + e.kategorie + (z === st.z ? ' aktiv' : ''), 'data-z': z }, svgEl);
      s('title', { text: e.name + ': ' + U.fmt(v, 2) + ' eV' }, r);
      if ([2, 10, 18, 36].indexOf(z) >= 0) s('text', { x: 32 + i * bw + bw / 2 - 1, y: 202, 'text-anchor': 'middle', class: 'val mini', text: e.symbol }, svgEl);
      if ([3, 11, 19].indexOf(z) >= 0) s('text', { x: 32 + i * bw + bw / 2 - 1, y: 212, 'text-anchor': 'middle', class: 'val mini', text: e.symbol }, svgEl);
    });
    s('text', { x: 211, y: 230, 'text-anchor': 'middle', class: 'val', text: 'Ordnungszahl 1 bis 36 · Quelle: NIST (gemessen)' }, svgEl);
    svgEl.onclick = function (ev) { var b = ev.target.closest('[data-z]'); if (b) { st.z = Number(b.dataset.z); U.$('en-element').value = st.z; vergleich(); } };

    var e = C.element(st.z), k = C.konfiguration(st.z);
    var t = '<b>' + esc(e.name) + '</b>: ' + U.fmt(e.ionisierung, 2) + ' eV, Konfiguration ' + esc(k.kurz) + ', Schalen ' + k.schalen.join(', ') + '. ';
    var g = e.gruppe;
    if (st.z === 1) t += 'Wasserstoff kann ein Elektron abgeben (H⁺) oder – mit Metallen – eines aufnehmen (H⁻).';
    else if (g === 18) t += 'Edelgas: Die Außenschale ist voll besetzt. Die Ionisierungsenergie ist besonders hoch, Edelgase bilden praktisch keine Ionen.';
    else if (g === 1 || g === 2 || g === 13) { var q = g === 13 ? 3 : g; t += 'Faustregel: Gibt ' + q + ' Außenelektron' + (q > 1 ? 'en' : '') + ' ab → ' + esc(e.symbol) + C.hoch((q > 1 ? q : '') + '+') + ' mit Edelgaskonfiguration.' + (st.z === 5 ? ' (Bor bildet allerdings keine einfachen B³⁺-Ionen, sondern Atombindungen.)' : ''); }
    else if (g >= 15 && g <= 17) { var a = 18 - g; t += 'Faustregel: Nimmt ' + a + ' Elektron' + (a > 1 ? 'en' : '') + ' auf → ' + esc(e.symbol) + C.hoch((a > 1 ? a : '') + '-') + ' mit Edelgaskonfiguration (in Salzen mit Metallen).'; }
    else if (g === 14) t += 'Gruppe 14: bildet in der Regel Atombindungen statt einfacher Ionen.';
    else t += 'Übergangsmetall: Es kann Ionen mit verschiedenen Ladungen bilden (z. B. Fe²⁺ und Fe³⁺). Die einfache Edelgasregel gilt hier nicht.';
    t += '<br><span class="small muted">Die Faustregeln gelten für Hauptgruppenelemente in einfachen Salzen. Die Ionisierungsenergie zeigt, wie viel Energie nötig ist, um das erste Elektron aus einem einzelnen Atom zu entfernen.</span>';
    U.$('en-ion').innerHTML = t;
  }

  U.ansichten.energie = {
    init: init,
    uebernehmen: function (d) { if (d.z && d.z <= D.IONISIERUNG.length) { st.z = d.z; U.$('en-element').value = d.z; vergleich(); } },
  };
})(window);
