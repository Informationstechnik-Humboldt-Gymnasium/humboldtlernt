// Physik-Labor · Simulation „Kräfte und Reibung“ (Rechnung in reibung.js)
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, RB = PL.reibung;
  var VW = 480, VH = 300, BODEN = 212, KB = 96, KH = 62, PPM = 70, RES_Y = 58;

  var M = {
    titel: 'Kräfte und Reibung',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 40 H68"/><path d="M8 44 l4 -4 M18 44 l4 -4 M28 44 l4 -4 M38 44 l4 -4 M48 44 l4 -4 M58 44 l4 -4" stroke-width="1.6"/><rect x="22" y="20" width="22" height="20" rx="2"/><path d="M44 30 H64 M59 25 L64 30 L59 35"/><path d="M22 37 H8 M13 33 L8 37 L13 41" stroke-width="2"/></svg>',
  };
  var P = RB.param({ m: 5, F: 0, muH: 0.5, muG: 0.3, g: 9.81 });
  var z, reihe, lauf, st, mw, diag, B, S = {}, E = {}, ansicht = 'kraft', letztesDiagramm = 0;

  function zuruecksetzen() {
    z = RB.neu();
    reihe.leeren(); aufzeichnen(true);
    modellText();
  }
  function aufzeichnen(erzwingen) {
    var k = RB.kraefte(z, P);
    reihe.add({ t: z.t, v: z.v, s: z.s, F: P.F, FR: Math.abs(k.FR) }, erzwingen);
  }
  function schritt(dt) {
    var vorher = RB.kraefte(z, P).haftet;
    RB.schritt(z, P, dt);
    aufzeichnen(RB.kraefte(z, P).haftet !== vorher);
    return false;
  }

  function index(parent, grund, idx, rest) {
    U.svg('tspan', { class: 'gr', text: grund }, parent);
    if (idx) U.svg('tspan', { class: 'idx', dy: 3, text: idx }, parent);
    U.svg('tspan', { dy: idx ? -3 : 0, text: rest }, parent);
  }
  function zeichne() {
    var k = RB.kraefte(z, P);
    // Kamera folgt dem Körper, sobald er weiter als 2 m gerutscht ist
    var kam = Math.max(0, z.x - 2.2), x0 = 110 + (z.x - kam) * PPM, cx = x0 + KB / 2, cy = BODEN - KH / 2;
    U.leeren(S.boden);
    U.svg('rect', { x: 0, y: BODEN, width: VW, height: 22, class: 'pl-boden-flaeche' }, S.boden);
    U.svg('line', { x1: 0, y1: BODEN, x2: VW, y2: BODEN, class: 'pl-boden-linie' }, S.boden);
    for (var m = Math.floor(kam - 2); m <= kam + VW / PPM; m++) {
      var x = 110 + (m - kam) * PPM;
      if (x < -20 || x > VW + 20 || m < 0) continue;
      U.svg('line', { x1: x, y1: BODEN, x2: x, y2: BODEN + 8, class: 'axis' }, S.boden);
      U.svg('text', { x: x, y: BODEN + 20, 'text-anchor': 'middle', class: 'val', text: m + ' m' }, S.boden);
    }
    S.klotz.setAttribute('x', x0.toFixed(1));
    S.mText.setAttribute('x', cx.toFixed(1));
    S.mText.textContent = U.fmt(P.m, P.m < 1 ? 2 : 1) + ' kg';
    // Kräfte am Schwerpunkt, gemeinsamer Maßstab
    U.leeren(S.kraefte);
    var kf = 78 / Math.max(k.FG, Math.abs(P.F), Math.abs(k.FR), Math.abs(k.Fres), 1e-9);
    // Startpunkt (sx|sy), Länge (dx|dy); die Beschriftung steht hinter der Pfeilspitze, außerhalb des Körpers
    function kraft(sx, sy, dx, dy, kl, idx, wert) {
      if (Math.hypot(dx, dy) < 1) return;
      U.pfeil(S.kraefte, sx, sy, sx + dx, sy + dy, kl);
      var waag = Math.abs(dx) > Math.abs(dy), tx = waag ? (dx > 0 ? Math.max(sx + dx, x0 + KB) + 6 : Math.min(sx + dx, x0) - 6) : sx + dx + 8, ty = sy + dy + (waag ? 4 : (dy > 0 ? 2 : 8));
      var t = U.svg('text', { x: tx.toFixed(1), y: ty.toFixed(1), 'text-anchor': waag && dx < 0 ? 'end' : 'start', class: 'pl-beschr ' + kl }, S.kraefte);
      index(t, 'F', idx, ' = ' + U.fmt(wert, 1) + ' N');
    }
    kraft(cx, cy, 0, k.FG * kf, 'pf-g', 'G', k.FG);
    kraft(cx, cy, 0, -k.FN * kf, 'pf-n', 'N', k.FN);
    kraft(cx, cy - 9, P.F * kf, 0, 'pf-z', 'Zug', Math.abs(P.F));
    kraft(cx, cy + 9, k.FR * kf, 0, 'pf-r', 'R', Math.abs(k.FR));
    kraft(cx, RES_Y, k.Fres * kf, 0, 'pf-res', 'res', Math.abs(k.Fres));
    S.res0.toggleAttribute('hidden', k.Fres !== 0);
    S.res0.setAttribute('x', cx.toFixed(1));
    U.leeren(S.res0);
    index(S.res0, 'F', 'res', ' = 0 N – Kräfte im Gleichgewicht');

    var grenze = RB.haftGrenze(P);
    mw.alle({
      Fres: U.fmt(k.Fres, 2), a: U.fmt(z.a, 2), v: U.fmt(z.v, 2), s: U.fmt(z.s, 2), t: U.fmt(z.t, 1),
      FR: U.fmt(Math.abs(k.FR), 2), FH: U.fmt(grenze, 2),
    });
    mw.markiere('FH', k.haftet && Math.abs(P.F) > 0.8 * grenze);
    S.chip.textContent = k.haftet ? 'haftet (Haftreibung)' : 'gleitet (Gleitreibung)';
    S.chip.className = 'pl-chip ' + (k.haftet ? 'haftet' : 'gleitet');
    var jetzt = root.performance ? root.performance.now() : Date.now();
    if (lauf.zustand !== 'laeuft' || jetzt - letztesDiagramm > 120) { letztesDiagramm = jetzt; zeichneDiagramm(); }
  }

  var ACHSEN = {
    kraft: { y: { name: 'F', einheit: 'N' }, label: 'Zugkraft und Reibungskraft über der Zeit' },
    v: { y: { name: 'v', einheit: 'm/s' }, label: 'Geschwindigkeit über der Zeit' },
    s: { y: { name: 's', einheit: 'm' }, label: 'Weg über der Zeit' },
  };
  function zeichneDiagramm() {
    var xMax = Math.max(5, z.t), serien;
    if (ansicht === 'kraft') serien = [{ punkte: reihe.punkte('F'), art: 'messung', farbe: 1, name: 'Zugkraft F' }, { punkte: reihe.punkte('FR'), art: 'messung', farbe: 2, name: 'Reibungskraft (Betrag)' }];
    else serien = [{ punkte: reihe.punkte(ansicht), art: 'messung', farbe: 1 }];
    diag.setze({ serien: serien, x: [0, xMax] });
  }

  function modellText() {
    B.modell.innerHTML = '<h2>Modell und Formeln</h2>' +
      '<ul class="pl-formeln"><li>Gewichtskraft <span class="f">F</span><sub>G</sub> = <span class="f">m</span>·<span class="f">g</span>, auf der waagerechten Fläche ist die Normalkraft <span class="f">F</span><sub>N</sub> = <span class="f">F</span><sub>G</sub></li>' +
      '<li>Haftreibung: höchstens <span class="f">F</span><sub>H,max</sub> = <span class="f">μ</span><sub>H</sub>·<span class="f">F</span><sub>N</sub>. Solange die Zugkraft kleiner ist, ist die Haftreibung genauso groß wie sie – der Körper bleibt liegen.</li>' +
      '<li>Gleitreibung: <span class="f">F</span><sub>R</sub> = <span class="f">μ</span><sub>G</sub>·<span class="f">F</span><sub>N</sub>, entgegen der Bewegung</li>' +
      '<li><span class="f">F</span><sub>res</sub> = <span class="f">F</span><sub>Zug</sub> − <span class="f">F</span><sub>R</sub>, <span class="f">a</span> = <span class="f">F</span><sub>res</sub> / <span class="f">m</span></li></ul>' +
      '<p class="small">Mit den aktuellen Werten: <span class="f">F</span><sub>N</sub> = ' + U.fmt(RB.normalkraft(P), 2) + ' N · <span class="f">F</span><sub>H,max</sub> = ' + U.fmt(RB.haftGrenze(P), 2) +
      ' N · <span class="f">F</span><sub>R</sub> beim Gleiten = ' + U.fmt(RB.gleitKraft(P), 2) + ' N.</p>' +
      '<details><summary>Vereinfachungen und Grenzen</summary><p class="small">Die Reibungszahlen sind konstant – in Wirklichkeit hängen sie von Material, Oberfläche, Feuchtigkeit und etwas von der Geschwindigkeit ab. ' +
      'Die Zugkraft wirkt waagerecht. Kein Luftwiderstand, der Körper kippt nicht. Alle Kräfte sind am Schwerpunkt angreifend gezeichnet; die resultierende Kraft steht darüber. ' +
      'Die Pfeillängen haben einen gemeinsamen Maßstab, der sich der größten Kraft anpasst.</p></details>';
  }
  function pruefeMu() {
    var l = [];
    if (P.muG > P.muH) l.push({ art: 'warn', text: 'Die Gleitreibungszahl kann nicht größer sein als die Haftreibungszahl. Im Modell wird μ_G = μ_H = ' + U.fmt(P.muH, 2) + ' verwendet.' });
    if (P.muH === 0) l.push({ art: 'info', text: 'μ = 0: reibungsfreie Fläche. Schon die kleinste Kraft beschleunigt den Körper.' });
    U.hinweise(B.hinweis, l);
  }

  M.init = function (section) {
    B = U.werkbank(section, { id: 'reibung', titel: 'Kräfte und Reibung',
      einleitung: 'Ein Körper liegt auf einer waagerechten Fläche und wird mit der Kraft <span class="f">F</span> gezogen. Starte die Zeit, verändere die Zugkraft während des Versuchs und beobachte die Kraftpfeile.' });
    reihe = PL.reihe(0.04);
    lauf = PL.lauf(PL.takt, { schritt: schritt, zeichne: function () { zeichne(); }, zuruecksetzen: zuruecksetzen, gemeldet: function () { st.zeige(); zeichne(); } });
    st = U.steuerung(B.steuer, lauf, {});
    S.chip = U.html('span', { class: 'pl-chip haftet', role: 'status' }, B.steuer.querySelector('.pl-steuerung'));
    var svgEl = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': 'Körper auf einer Fläche mit Kraftpfeilen', class: 'pl-szene' }, B.flaeche);
    S.boden = U.svg('g', {}, svgEl);
    S.klotz = U.svg('rect', { y: BODEN - KH, width: KB, height: KH, rx: 4, class: 'pl-klotz', opacity: 0.85 }, svgEl);
    S.mText = U.svg('text', { y: BODEN - KH + 14, 'text-anchor': 'middle', class: 'val' }, svgEl);
    S.kraefte = U.svg('g', {}, svgEl);
    S.res0 = U.svg('text', { y: RES_Y + 4, 'text-anchor': 'middle', class: 'pl-beschr pf-res' }, svgEl);
    U.art(B.art, 'simulation', 'Kräfte am Schwerpunkt gezeichnet; Pfeillänge ∝ Betrag der Kraft.');
    var leg = U.html('p', { class: 'pl-legende-pfeile' }, B.art.parentNode);
    B.art.parentNode.insertBefore(leg, B.art);
    leg.innerHTML = '<span style="color: var(--p-fg)">Gewichtskraft</span><span style="color: var(--p-fn)">Normalkraft</span><span style="color: var(--p-fz)">Zugkraft</span>' +
      '<span style="color: var(--p-fr)">Reibungskraft</span><span style="color: var(--p-fres)">resultierende Kraft</span>';
    mw = U.messwerte(B.messwerte, [
      { id: 'Fres', name: 'resultierende Kraft <span class="f">F</span><sub>res</sub>', einheit: 'N' },
      { id: 'a', name: 'Beschleunigung <span class="f">a</span>', einheit: 'm/s²' },
      { id: 'v', name: 'Geschwindigkeit <span class="f">v</span>', einheit: 'm/s' },
      { id: 's', name: 'Weg <span class="f">s</span>', einheit: 'm' },
      { id: 'FR', name: 'Reibungskraft <span class="f">F</span><sub>R</sub>', einheit: 'N' },
      { id: 'FH', name: 'max. Haftreibung <span class="f">F</span><sub>H,max</sub>', einheit: 'N' },
      { id: 't', name: 'Zeit <span class="f">t</span>', einheit: 's' },
    ]);

    // Einstellungen wirken sofort, auch während der Versuch läuft
    var g1 = U.gruppe(B.einstellungen);
    E.F = U.regler(g1, { name: 'Zugkraft <span class="f">F</span>', einheit: 'N', min: 0, max: 200, schritt: 0.5, wert: P.F, stellen: 1,
      hilfe: 'Wirkt sofort – du kannst sie während des Versuchs verändern.', beiAenderung: function (w) { P.F = w; aufzeichnen(true); zeichne(); } });
    var fk = U.html('div', { class: 'pl-knoepfe' }, g1);
    U.html('button', { type: 'button', class: 'pl-klein', text: 'Kraft loslassen (F = 0)' }, fk).addEventListener('click', function () { E.F.setze(0); });
    E.m = U.regler(g1, { name: 'Masse <span class="f">m</span>', einheit: 'kg', min: 0.1, max: 50, schritt: 0.1, wert: P.m, stellen: 1, beiAenderung: function (w) { P.m = w; modellText(); aufzeichnen(true); zeichne(); } });
    var g2 = U.gruppe(B.einstellungen, 'Reibung');
    E.muH = U.regler(g2, { name: 'Haftreibungszahl <span class="f">μ</span><sub>H</sub>', einheit: '', min: 0, max: 1.2, schritt: 0.01, wert: P.muH, stellen: 2,
      beiAenderung: function (w) { P.muH = w; pruefeMu(); modellText(); aufzeichnen(true); zeichne(); } });
    E.muG = U.regler(g2, { name: 'Gleitreibungszahl <span class="f">μ</span><sub>G</sub>', einheit: '', min: 0, max: 1.2, schritt: 0.01, wert: P.muG, stellen: 2,
      hilfe: 'Gleitreibung ist meist kleiner als Haftreibung. Die Werte hängen stark von den Oberflächen ab.',
      beiAenderung: function (w) { P.muG = w; pruefeMu(); modellText(); aufzeichnen(true); zeichne(); } });
    E.g = U.gravitation(g2, P.g, function (w) { P.g = w; modellText(); aufzeichnen(true); zeichne(); });

    var dk = U.html('div', { class: 'pl-diagramm-kopf' }, B.diagramm);
    U.html('h2', { text: 'Diagramm' }, dk);
    var segBox = U.html('div', {}, dk), dBox = U.html('div', {}, B.diagramm);
    function baueDiagramm() {
      U.leeren(dBox);
      var a = ACHSEN[ansicht];
      diag = PL.diagramm(dBox, { x: { name: 't', einheit: 's' }, y: a.y, label: a.label, leerText: 'Starte die Zeit.' });
      zeichneDiagramm();
    }
    U.seg(segBox, [{ wert: 'kraft', text: 'Kräfte' }, { wert: 'v', text: 'v(t)' }, { wert: 's', text: 's(t)' }], ansicht, function (w) { ansicht = w; baueDiagramm(); }, 'Diagramm wählen');
    U.html('p', { class: 'small muted', text: 'Im Kräfte-Diagramm siehst du: Die Haftreibung wächst mit der Zugkraft mit – bis der Körper losrutscht. Dann springt sie auf die kleinere Gleitreibung.' }, B.diagramm);

    zuruecksetzen();
    pruefeMu();
    baueDiagramm();
    U.aufgaben(B.aufgaben, PL.aufgaben.reibung, { titelId: B.lmTitelId, einstellen: M.einstellen });
    zeichne();
  };
  M.einstellen = function (q) {
    ['m', 'F', 'muH', 'muG'].forEach(function (key) { if (q[key] !== undefined) { P[key] = q[key]; E[key].setze(q[key], true); } });
    if (q.g !== undefined) { P.g = q.g; E.g.setze(q.g, true); }
    pruefeMu();
    lauf.zuruecksetzen();
    B.flaeche.scrollIntoView({ block: 'center', behavior: U.reduziert ? 'auto' : 'smooth' });
  };
  M.zeigen = function () { zeichne(); };
  M.verstecken = function () { lauf.pause(); };
  PL.module.reibung = M;
})(window);
