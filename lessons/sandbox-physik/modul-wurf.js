// Physik-Labor · Simulation „Wurfbewegung“ (Rechnung in wurf.js)
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, W = PL.wurf;
  var VW = 480, VH = 300, L = 46, R = 14, T = 18, RU = 34;

  var M = {
    titel: 'Wurfbewegung',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 44 H66 M6 44 V4"/><path d="M8 40 Q30 -4 58 42" stroke-dasharray="4 4"/><circle cx="38" cy="14" r="4" fill="currentColor" stroke="none"/><path d="M38 14 L50 12" stroke-width="2"/></svg>',
  };
  var P = W.param({ v0: 12, winkel: 45, h0: 0, g: 9.81 });
  var z, reihe, lauf, st, mw, diag, B, S = {}, E = {}, ansicht = 'v', vergleich = [], letztesDiagramm = 0;
  var anzeige = { bahn: false, spur: true, pfeil: true, komp: false };
  var k = 1, sicht = { x: 1, y: 1 }, schritt0 = 1;

  // ---------------------------------------------------------------- Maßstab (gleich für x und y, damit Winkel stimmen)
  function massstab() {
    var xmax = Math.max(W.wurfweite(P), 1), ymax = Math.max(W.maxHoehe(P), P.h0, 0.5);
    vergleich.forEach(function (v) { xmax = Math.max(xmax, v.w); ymax = Math.max(ymax, v.H); });
    xmax *= 1.06; ymax *= 1.1;
    k = Math.min((VW - L - R) / xmax, (VH - T - RU) / ymax);
    sicht = { x: (VW - L - R) / k, y: (VH - T - RU) / k };
    schritt0 = PL.skala(0, Math.max(sicht.x, sicht.y), 8).schritt;
  }
  function px(x) { return L + x * k; }
  function py(y) { return VH - RU - y * k; }
  function pfad(punkte) { return punkte.map(function (p, i) { return (i ? 'L' : 'M') + px(p.x).toFixed(1) + ' ' + py(p.y).toFixed(1); }).join(''); }

  function zeichneHintergrund() {
    massstab();
    U.leeren(S.hg);
    var stellen = PL.skala(0, schritt0 * 4, 4).stellen;
    for (var x = 0; x <= sicht.x + 1e-9; x += schritt0) {
      U.svg('line', { x1: px(x), y1: T, x2: px(x), y2: py(0), class: 'gridline' }, S.hg);
      U.svg('text', { x: px(x), y: VH - RU + 14, 'text-anchor': 'middle', class: 'val', text: U.fmt(x, stellen) }, S.hg);
    }
    for (var y = 0; y <= sicht.y + 1e-9; y += schritt0) {
      U.svg('line', { x1: L, y1: py(y), x2: VW - R, y2: py(y), class: 'gridline' }, S.hg);
      U.svg('text', { x: L - 5, y: py(y) + 4, 'text-anchor': 'end', class: 'val', text: U.fmt(y, stellen) }, S.hg);
    }
    U.svg('rect', { x: L, y: py(0), width: VW - L - R, height: 6, class: 'pl-boden-flaeche' }, S.hg);
    U.svg('line', { x1: L, y1: py(0), x2: VW - R, y2: py(0), class: 'pl-boden-linie' }, S.hg);
    U.svg('line', { x1: L, y1: T, x2: L, y2: py(0), class: 'axis' }, S.hg);
    var tx = U.svg('text', { x: VW - R, y: VH - 6, 'text-anchor': 'end', class: 'pl-achse-titel' }, S.hg);
    U.svg('tspan', { class: 'gr', text: 'x' }, tx); U.svg('tspan', { text: ' in m' }, tx);
    var ty = U.svg('text', { x: L + 6, y: T - 4, class: 'pl-achse-titel' }, S.hg);
    U.svg('tspan', { class: 'gr', text: 'y' }, ty); U.svg('tspan', { text: ' in m' }, ty);
    // Vergleichsbahnen
    vergleich.forEach(function (v) {
      U.svg('path', { d: pfad(v.punkte), class: 'pl-kurve pl-farbe-3 theorie' }, S.hg);
      U.svg('text', { x: px(v.w), y: py(0) - 6, 'text-anchor': 'middle', class: 'val', text: U.fmt(v.winkel, 0) + '°' }, S.hg);
    });
    // Abwurfpunkt und Abwurfhöhe
    if (P.h0 > 0) {
      U.svg('line', { x1: px(0) + 3, y1: py(0), x2: px(0) + 3, y2: py(P.h0), class: 'pl-marke' }, S.hg);
      var th = U.svg('text', { x: px(0) + 8, y: (py(0) + py(P.h0)) / 2 + 4, class: 'pl-beschr' }, S.hg);
      U.svg('tspan', { class: 'gr', text: 'h' }, th); U.svg('tspan', { class: 'idx', dy: 3, text: '0' }, th);
    }
    U.svg('circle', { cx: px(0), cy: py(P.h0), r: 4, class: 'pl-punkt pl-farbe-1' }, S.hg);
    // berechnete Bahn (optional)
    S.vorschau = U.svg('path', { d: pfad(W.bahn(P, 80)), class: 'pl-kurve pl-farbe-2 theorie' }, S.hg);
    S.vorschau.toggleAttribute('hidden', !anzeige.bahn);
  }

  function zuruecksetzen() {
    z = W.neu(P);
    reihe.leeren(); reihe.add({ t: 0, x: z.x, y: z.y, vx: z.vx, vy: z.vy }, true);
    zeichneHintergrund(); modellText(); hinweiseSetzen();
  }
  function schritt(dt) {
    var fertig = W.schritt(z, P, dt);
    reihe.add({ t: z.t, x: z.x, y: z.y, vx: z.vx, vy: z.vy }, fertig);
    if (fertig && z.t > 0) {
      vergleich.push({ winkel: P.winkel, v0: P.v0, h0: P.h0, w: z.x, H: z.yMax, punkte: W.bahn(P, 60) });
      if (vergleich.length > 5) vergleich.shift();
      E.loeschen.disabled = false;
    }
    return fertig;
  }

  function zeichne() {
    S.spur.setAttribute('d', anzeige.spur ? pfad(reihe.saetze) : '');
    S.koerper.setAttribute('transform', 'translate(' + px(z.x).toFixed(1) + ' ' + (py(z.y) - 6).toFixed(1) + ')');
    U.leeren(S.pfeile);
    if (!z.gelandet || z.t === 0) {
      var kv = 55 / Math.max(P.v0, Math.abs(W.komponenten(P).vy - P.g * W.flugzeit(P)), 1), x0 = px(z.x), y0 = py(z.y) - 6;
      if (anzeige.komp) {
        U.pfeil(S.pfeile, x0, y0, x0 + z.vx * kv, y0, 'pl-v duenn', 7);
        U.pfeil(S.pfeile, x0, y0, x0, y0 - z.vy * kv, 'pl-v duenn', 7);
      }
      if (anzeige.pfeil && Math.hypot(z.vx, z.vy) * kv > 2) {
        U.pfeil(S.pfeile, x0, y0, x0 + z.vx * kv, y0 - z.vy * kv, 'pl-v');
        var tv = U.svg('text', { x: x0 + z.vx * kv + 4, y: y0 - z.vy * kv - 4, class: 'pl-beschr pl-v-text' }, S.pfeile);
        U.svg('tspan', { class: 'gr', text: 'v' }, tv);
      }
    }
    var gelandet = z.gelandet && z.t > 0;
    S.lande.toggleAttribute('hidden', !gelandet);
    if (gelandet) {
      S.landePunkt.setAttribute('cx', px(z.x)); S.landePunkt.setAttribute('cy', py(0));
      S.landeText.setAttribute('x', Math.min(px(z.x), VW - R - 40)); S.landeText.setAttribute('y', py(0) - 24);
      S.landeText.textContent = 'w = ' + U.fmt(z.x, 2) + ' m';
    }
    mw.alle({
      x: U.fmt(z.x, 2), y: U.fmt(z.y, 2), vx: U.fmt(z.vx, 2), vy: U.fmt(z.vy, 2), t: U.fmt(z.t, 2),
      h: U.fmt(z.yMax, 2), w: gelandet ? U.fmt(z.x, 2) : '–',
    });
    st.setzeZusatz(gelandet ? 'gelandet nach ' + U.fmt(z.t, 2) + ' s' : '');
    var jetzt = root.performance ? root.performance.now() : Date.now();
    if (lauf.zustand !== 'laeuft' || jetzt - letztesDiagramm > 100 || z.gelandet) { letztesDiagramm = jetzt; zeichneDiagramm(); }
  }

  var ACHSEN = {
    x: { y: { name: 'x', einheit: 'm' }, label: 'waagerechte Position über der Zeit' },
    y: { y: { name: 'y', einheit: 'm' }, label: 'Höhe über der Zeit' },
    v: { y: { name: 'v', einheit: 'm/s' }, label: 'Geschwindigkeitskomponenten über der Zeit' },
  };
  function zeichneDiagramm() {
    var Tf = Math.max(W.flugzeit(P), 0.1), c = W.komponenten(P), serien, y;
    if (ansicht === 'v') {
      serien = [{ punkte: reihe.punkte('vx'), art: 'messung', farbe: 1, name: 'waagerecht (vₓ)' }, { punkte: reihe.punkte('vy'), art: 'messung', farbe: 2, name: 'senkrecht (v nach oben positiv)' }];
      y = [Math.min(0, c.vy - P.g * Tf), Math.max(c.vx, c.vy, 0)];
    } else {
      serien = [{ punkte: reihe.punkte(ansicht), art: 'messung', farbe: 1 }];
      y = ansicht === 'x' ? [0, Math.max(W.wurfweite(P), 0.1)] : [0, Math.max(W.maxHoehe(P), 0.1)];
    }
    diag.setze({ serien: serien, x: [0, Tf], y: y });
  }

  function modellText() {
    var c = W.komponenten(P);
    B.modell.innerHTML = '<h2>Modell und Formeln</h2>' +
      '<p>Abwurf im Punkt (0 | <span class="f">h</span>₀) unter dem Winkel <span class="f">α</span>. Die beiden Teilbewegungen überlagern sich, ohne sich zu stören:</p>' +
      '<ul class="pl-formeln"><li>waagerecht gleichförmig: <span class="f">x</span> = <span class="f">v</span>₀·cos <span class="f">α</span>·<span class="f">t</span></li>' +
      '<li>senkrecht beschleunigt: <span class="f">y</span> = <span class="f">h</span>₀ + <span class="f">v</span>₀·sin <span class="f">α</span>·<span class="f">t</span> − ½·<span class="f">g</span>·<span class="f">t</span>²</li>' +
      '<li><span class="f">v</span><sub>x</sub> = <span class="f">v</span>₀·cos <span class="f">α</span> (konstant), <span class="f">v</span><sub>y</sub> = <span class="f">v</span>₀·sin <span class="f">α</span> − <span class="f">g</span>·<span class="f">t</span></li></ul>' +
      '<p class="small">Berechnet: <span class="f">v</span><sub>x</sub> = ' + U.fmt(c.vx, 2) + ' m/s, <span class="f">v</span><sub>y</sub>(0) = ' + U.fmt(c.vy, 2) + ' m/s · Flugzeit ' + U.fmt(W.flugzeit(P), 2) +
      ' s · Wurfweite ' + U.fmt(W.wurfweite(P), 2) + ' m · größte Höhe ' + U.fmt(W.maxHoehe(P), 2) + ' m.</p>' +
      '<details><summary>Vereinfachungen</summary><p class="small">Kein Luftwiderstand (echte Bälle fliegen weniger weit, der beste Winkel liegt dann meist unter 45°), konstantes <span class="f">g</span>, ' +
      'punktförmiger Körper. Die Zeichnung hat in <span class="f">x</span>- und <span class="f">y</span>-Richtung denselben Maßstab, damit die Winkel stimmen; der Körper ist größer gezeichnet.</p></details>';
  }
  function hinweiseSetzen() {
    var l = [];
    if (W.flugzeit(P) === 0) l.push({ art: 'warn', text: 'Mit diesen Werten hebt der Körper nicht ab: Er liegt am Boden und wird nicht nach oben geworfen. Wähle eine Abwurfhöhe oder einen Winkel über 0°.' });
    else if (P.v0 === 0) l.push({ art: 'info', text: 'v₀ = 0: Der Körper fällt senkrecht nach unten (freier Fall).' });
    else if (P.winkel === 0) l.push({ art: 'info', text: 'α = 0°: waagerechter Wurf.' });
    else if (P.winkel === 90) l.push({ art: 'info', text: 'α = 90°: senkrechter Wurf nach oben.' });
    U.hinweise(B.hinweis, l);
  }

  M.init = function (section) {
    B = U.werkbank(section, { id: 'wurf', titel: 'Wurfbewegung',
      einleitung: 'Ein Körper wird mit der Geschwindigkeit <span class="f">v</span>₀ unter dem Winkel <span class="f">α</span> abgeworfen. Verändere Winkel, Geschwindigkeit, Abwurfhöhe und Ortsfaktor und vergleiche die Flugbahnen.' });
    reihe = PL.reihe(0.02);
    lauf = PL.lauf(PL.takt, { schritt: schritt, zeichne: function () { zeichne(); }, zuruecksetzen: zuruecksetzen, gemeldet: function () { st.zeige(); zeichneHintergrund(); zeichne(); } });
    st = U.steuerung(B.steuer, lauf, { ende: true });
    var svgEl = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': 'Flugbahn im Koordinatensystem', class: 'pl-szene' }, B.flaeche);
    S.hg = U.svg('g', {}, svgEl);
    S.spur = U.svg('path', { class: 'pl-kurve pl-farbe-1' }, svgEl);
    S.lande = U.svg('g', {}, svgEl);
    S.landePunkt = U.svg('circle', { r: 5, class: 'pl-punkt pl-farbe-2' }, S.lande);
    S.landeText = U.svg('text', { 'text-anchor': 'middle', class: 'pl-beschr' }, S.lande);
    S.pfeile = U.svg('g', {}, svgEl);
    S.koerper = U.svg('g', {}, svgEl);
    U.svg('circle', { r: 6, class: 'pl-kugel' }, S.koerper);
    U.art(B.art, 'simulation', 'Gleicher Maßstab in beiden Richtungen; der Körper ist nicht maßstäblich.');
    mw = U.messwerte(B.messwerte, [
      { id: 'x', name: 'waagerecht <span class="f">x</span>', einheit: 'm' },
      { id: 'y', name: 'Höhe <span class="f">y</span>', einheit: 'm' },
      { id: 'vx', name: '<span class="f">v</span><sub>x</sub> (waagerecht)', einheit: 'm/s' },
      { id: 'vy', name: '<span class="f">v</span><sub>y</sub> (+ nach oben)', einheit: 'm/s' },
      { id: 't', name: 'Flugzeit <span class="f">t</span>', einheit: 's' },
      { id: 'h', name: 'max. Höhe (gemessen)', einheit: 'm' },
      { id: 'w', name: 'Wurfweite <span class="f">w</span>', einheit: 'm' },
    ]);

    var neu = function () { lauf.zuruecksetzen(); };
    var g1 = U.gruppe(B.einstellungen);
    E.v0 = U.regler(g1, { name: 'Abwurfgeschwindigkeit <span class="f">v</span>₀', einheit: 'm/s', min: 0, max: 40, schritt: 0.5, wert: P.v0, stellen: 1, beiAenderung: function (w) { P.v0 = w; neu(); } });
    var wBox = U.html('div', { class: 'pl-knoepfe' }, g1);
    E.winkel = U.regler(g1, { name: 'Abwurfwinkel <span class="f">α</span>', einheit: '°', min: 0, max: 90, schritt: 1, wert: P.winkel, stellen: 0,
      hilfe: '0° = waagerechter Wurf, 90° = senkrecht nach oben', beiAenderung: function (w) { P.winkel = w; U.segSetze(wBox, w); neu(); } });
    g1.insertBefore(wBox, E.winkel.el.nextSibling);
    U.seg(wBox, [{ wert: 0, text: 'waagerecht' }, { wert: 30, text: '30°' }, { wert: 45, text: '45°' }, { wert: 60, text: '60°' }], P.winkel, function (w) { E.winkel.setze(w); }, 'Winkel wählen');
    E.h0 = U.regler(g1, { name: 'Abwurfhöhe <span class="f">h</span>₀', einheit: 'm', min: 0, max: 50, schritt: 0.5, wert: P.h0, stellen: 1, beiAenderung: function (w) { P.h0 = w; neu(); } });
    E.g = U.gravitation(g1, P.g, function (w) { P.g = w; neu(); });
    var g3 = U.gruppe(B.einstellungen, 'Anzeige');
    U.schalter(g3, { text: 'berechnete Bahn', an: anzeige.bahn, beiAenderung: function (an) { anzeige.bahn = an; S.vorschau.toggleAttribute('hidden', !an); } });
    U.schalter(g3, { text: 'Spur', an: anzeige.spur, beiAenderung: function (an) { anzeige.spur = an; zeichne(); } });
    U.schalter(g3, { text: 'Geschwindigkeitspfeil', an: anzeige.pfeil, beiAenderung: function (an) { anzeige.pfeil = an; zeichne(); } });
    U.schalter(g3, { text: 'Komponenten', an: anzeige.komp, beiAenderung: function (an) { anzeige.komp = an; zeichne(); } });
    var g4 = U.gruppe(B.einstellungen, 'Vergleich');
    U.html('p', { class: 'small muted', text: 'Nach jeder Landung bleibt die Bahn gestrichelt stehen (höchstens fünf), beschriftet mit dem Winkel.' }, g4);
    E.loeschen = U.html('button', { type: 'button', text: 'Vergleichsbahnen löschen' }, g4);
    E.loeschen.disabled = true;
    E.loeschen.addEventListener('click', function () { vergleich = []; E.loeschen.disabled = true; zeichneHintergrund(); zeichne(); });

    var dk = U.html('div', { class: 'pl-diagramm-kopf' }, B.diagramm);
    U.html('h2', { text: 'Diagramm' }, dk);
    var segBox = U.html('div', {}, dk), dBox = U.html('div', {}, B.diagramm);
    function baueDiagramm() {
      U.leeren(dBox);
      var a = ACHSEN[ansicht];
      diag = PL.diagramm(dBox, { x: { name: 't', einheit: 's' }, y: a.y, label: a.label, leerText: 'Starte den Versuch.' });
      zeichneDiagramm();
    }
    U.seg(segBox, [{ wert: 'x', text: 'x(t)' }, { wert: 'y', text: 'y(t)' }, { wert: 'v', text: 'v(t)' }], ansicht, function (w) { ansicht = w; baueDiagramm(); }, 'Diagramm wählen');
    U.html('p', { class: 'small muted', text: 'Im v-t-Diagramm: Die waagerechte Geschwindigkeit bleibt konstant, die senkrechte nimmt gleichmäßig ab – beide Bewegungen sind unabhängig.' }, B.diagramm);

    zuruecksetzen();
    baueDiagramm();
    U.aufgaben(B.aufgaben, PL.aufgaben.wurf, { titelId: B.lmTitelId, einstellen: M.einstellen });
    zeichne();
  };
  M.einstellen = function (q) {
    ['v0', 'winkel', 'h0'].forEach(function (key) { if (q[key] !== undefined) { P[key] = q[key]; E[key].setze(q[key], true); } });
    U.segSetze(E.winkel.el.nextSibling, P.winkel);
    if (q.g !== undefined) { P.g = q.g; E.g.setze(q.g, true); }
    lauf.zuruecksetzen();
    B.flaeche.scrollIntoView({ block: 'center', behavior: U.reduziert ? 'auto' : 'smooth' });
  };
  M.zeigen = function () { zeichne(); };
  M.verstecken = function () { lauf.pause(); };
  PL.module.wurf = M;
})(window);
