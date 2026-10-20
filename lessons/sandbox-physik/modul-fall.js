// Physik-Labor · Simulation „Freier Fall“ (Rechnung in fall.js)
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, F = PL.fall;
  var VW = 360, VH = 330, BODEN = 300, OBEN = 26, XK = 200;

  var M = {
    titel: 'Freier Fall',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 44 H64"/><circle cx="36" cy="8" r="3" fill="currentColor" stroke="none" opacity=".35"/><circle cx="36" cy="16" r="3" fill="currentColor" stroke="none" opacity=".55"/><circle cx="36" cy="28" r="3.4" fill="currentColor" stroke="none" opacity=".8"/><circle cx="36" cy="40" r="3.8" fill="currentColor" stroke="none"/><path d="M50 10 V34 M46 30 L50 35 L54 30"/></svg>',
  };
  var P = F.param({ h0: 20, v0: 0, g: 9.81, luft: false, m: 0.5, cw: 0.47, A: 0.05 });
  var z, reihe, strobo, strobeDt = 0.2, naechsterBlitz = 0, V, B, lauf, st, mw, diag, ansicht = 'h', E = {}, S = {}, spurAn = true, letztesDiagramm = 0;

  // ---------------------------------------------------------------- Vorschau: Achsenbereiche vorab berechnen
  function vorschau() {
    var q = F.neu(P), n = 0, vMin = q.v, vMax = q.v, aMin = q.a, aMax = q.a, hMax = q.h;
    while (!F.schritt(q, P, 0.01) && n++ < 100000) {
      vMin = Math.min(vMin, q.v); vMax = Math.max(vMax, q.v); aMin = Math.min(aMin, q.a); aMax = Math.max(aMax, q.a); hMax = Math.max(hMax, q.h);
    }
    vMin = Math.min(vMin, q.v); vMax = Math.max(vMax, q.v);
    var T = q.t, Ti = F.aufprallZeit(P.h0, P.v0, P.g);
    if (P.luft) { vMin = Math.min(vMin, P.v0 - P.g * Ti); aMin = Math.min(aMin, -P.g); aMax = Math.max(aMax, 0); }
    return { T: T, Tideal: Ti, hMax: Math.max(hMax, P.luft ? F.maxHoehe(P.h0, P.v0, P.g) : 0), vMin: vMin, vMax: vMax, aMin: aMin, aMax: aMax, s: q.s, vEnde: q.v };
  }

  // ---------------------------------------------------------------- Ablauf
  function zuruecksetzen() {
    z = F.neu(P);
    V = vorschau();
    reihe.leeren(); reihe.add({ t: 0, h: z.h, v: z.v, a: z.a }, true);
    strobeDt = Math.max(0.05, PL.skala(0, Math.max(V.T, 0.1), 12).schritt);
    strobo = [{ t: 0, h: z.h }]; naechsterBlitz = strobeDt;
    zeichneSkala();
    modellText();
    hinweiseSetzen();
  }
  function schritt(dt) {
    var rest = dt, fertig = false;
    while (rest > 1e-12 && !fertig) {
      var d = Math.min(rest, naechsterBlitz - z.t);
      if (d <= 1e-12) d = rest;
      fertig = F.schritt(z, P, d);
      rest -= d;
      if (!fertig && Math.abs(z.t - naechsterBlitz) < 1e-9) { strobo.push({ t: z.t, h: z.h }); naechsterBlitz += strobeDt; }
      reihe.add({ t: z.t, h: z.h, v: z.v, a: z.a }, fertig);
    }
    return fertig;
  }

  // ---------------------------------------------------------------- Zeichnung
  var sk, svgEl;
  function hy(h) { return BODEN - h / sk.max * (BODEN - OBEN); }
  function zeichneSkala() {
    var top = Math.max(V.hMax, P.h0, 1);
    sk = PL.skala(0, top, 6);
    U.leeren(S.skala);
    U.svg('line', { x1: 64, y1: hy(0), x2: 64, y2: hy(sk.max), class: 'axis' }, S.skala);
    sk.werte.forEach(function (v) {
      var y = hy(v);
      U.svg('line', { x1: 58, y1: y, x2: 64, y2: y, class: 'axis' }, S.skala);
      U.svg('line', { x1: 66, y1: y, x2: VW - 12, y2: y, class: 'gridline' }, S.skala);
      U.svg('text', { x: 54, y: y + 4, 'text-anchor': 'end', class: 'val', text: U.fmt(v, sk.stellen) }, S.skala);
    });
    var t = U.svg('text', { x: 14, y: OBEN - 10, class: 'pl-achse-titel' }, S.skala);
    U.svg('tspan', { class: 'gr', text: 'h' }, t); U.svg('tspan', { text: ' in m' }, t);
    // Starthöhe
    U.svg('line', { x1: 66, y1: hy(P.h0), x2: XK + 40, y2: hy(P.h0), class: 'pl-marke' }, S.skala);
    var tt = U.svg('text', { x: XK + 46, y: hy(P.h0) + 4, class: 'pl-beschr' }, S.skala);
    U.svg('tspan', { class: 'gr', text: 'h' }, tt); U.svg('tspan', { class: 'idx', dy: 3, text: '0' }, tt); U.svg('tspan', { dy: -3, text: ' = ' + U.fmt(P.h0, 1) + ' m' }, tt);
  }
  function zeichne() {
    S.koerper.setAttribute('transform', 'translate(' + XK + ' ' + (hy(z.h) - 9).toFixed(1) + ')');
    // Stroboskop-Spur
    U.leeren(S.spur);
    if (spurAn) strobo.forEach(function (p, i) { if (i < strobo.length) U.svg('circle', { cx: XK - 34, cy: (hy(p.h) - 9).toFixed(1), r: 5, class: 'pl-strobo' }, S.spur); });
    // Geschwindigkeitspfeil (Länge ∝ v)
    U.leeren(S.vpfeil);
    var vMaxBetrag = Math.max(Math.abs(V.vMin), Math.abs(V.vMax), 0.1), l = z.v / vMaxBetrag * 70;
    if (!z.gelandet && Math.abs(l) > 2) {
      var y0 = hy(z.h) - 9;
      U.pfeil(S.vpfeil, XK + 22, y0, XK + 22, y0 - l, 'pl-v');
      var tv = U.svg('text', { x: XK + 30, y: y0 - l / 2 + 4, class: 'pl-beschr pl-v-text' }, S.vpfeil);
      U.svg('tspan', { class: 'gr', text: 'v' }, tv);
    }
    S.aufprall.toggleAttribute('hidden', !(z.gelandet && reihe.saetze.length > 1));
    S.amBoden.toggleAttribute('hidden', !(z.gelandet && reihe.saetze.length <= 1));
    mw.alle({
      h: U.fmt(z.h, 2), t: U.fmt(z.t, 2), v: U.fmt(z.v, 2), a: U.fmt(z.a, 2), s: U.fmt(z.s, 2),
    });
    st.setzeZusatz(z.gelandet && z.t > 0 ? 'Aufprall nach ' + U.fmt(z.t, 2) + ' s mit ' + U.fmt(Math.abs(z.v), 2) + ' m/s' : '');
    var jetzt = root.performance ? root.performance.now() : Date.now();
    if (lauf.zustand !== 'laeuft' || jetzt - letztesDiagramm > 100 || z.gelandet) { letztesDiagramm = jetzt; zeichneDiagramm(); }
  }
  var ACHSEN = {
    h: { name: 'h', einheit: 'm', label: 'Höhe über der Zeit' },
    v: { name: 'v', einheit: 'm/s', label: 'Geschwindigkeit über der Zeit' },
    a: { name: 'a', einheit: 'm/s²', label: 'Beschleunigung über der Zeit' },
  };
  function zeichneDiagramm() {
    var serien = [{ punkte: reihe.punkte(ansicht), art: 'messung', farbe: 1, name: 'Simulation mit Luftwiderstand' }];
    var xMax = Math.max(V.T, 0.1);
    if (P.luft) {
      // berechnete Vergleichskurve ohne Luftwiderstand
      var Ti = V.Tideal, pts = [];
      for (var i = 0; i <= 80; i++) { var w = F.ideal(P, Ti * i / 80); pts.push([w.t, ansicht === 'h' ? w.h : ansicht === 'v' ? w.v : -P.g]); }
      serien.push({ punkte: pts, art: 'theorie', farbe: 2, name: 'ohne Luftwiderstand (berechnet)' });
      xMax = Math.max(xMax, Ti);
    }
    var y = ansicht === 'h' ? [0, Math.max(V.hMax, P.h0)] : ansicht === 'v' ? [V.vMin, V.vMax] : [Math.min(V.aMin, -P.g), Math.max(V.aMax, 0)];
    diag.setze({ serien: serien, x: [0, xMax], y: y });
  }

  // ---------------------------------------------------------------- Texte
  function modellText() {
    var Ti = F.aufprallZeit(P.h0, P.v0, P.g), vi = P.v0 - P.g * Ti;
    var h = '<h2>Modell und Formeln</h2>' +
      '<p>Koordinate <span class="f">h</span> nach oben. Ohne Luftwiderstand gilt in einem gleichmäßigen Schwerefeld:</p>' +
      '<ul class="pl-formeln"><li><span class="f">h</span>(<span class="f">t</span>) = <span class="f">h</span>₀ + <span class="f">v</span>₀·<span class="f">t</span> − ½·<span class="f">g</span>·<span class="f">t</span>²</li>' +
      '<li><span class="f">v</span>(<span class="f">t</span>) = <span class="f">v</span>₀ − <span class="f">g</span>·<span class="f">t</span></li><li><span class="f">a</span> = −<span class="f">g</span></li></ul>' +
      '<p class="small">Berechnet ohne Luftwiderstand: Fallzeit ' + U.fmt(Ti, 2) + ' s · Aufprallgeschwindigkeit ' + U.fmt(Math.abs(vi), 2) + ' m/s · höchster Punkt ' + U.fmt(F.maxHoehe(P.h0, P.v0, P.g), 2) + ' m.</p>';
    if (P.luft) {
      h += '<p><b>Mit Luftwiderstand</b> wirkt zusätzlich <span class="f">F</span><sub>L</sub> = ½·<span class="f">ρ</span>·<span class="f">c</span><sub>w</sub>·<span class="f">A</span>·<span class="f">v</span>² gegen die Bewegung. ' +
        'Dann gelten die Formeln oben <b>nicht</b> mehr. Die Simulation rechnet in Schritten von 2 ms (Runge-Kutta-Verfahren).</p>' +
        '<p class="small">Annahmen: <span class="f">ρ</span><sub>Luft</sub> = 1,2 kg/m³ (etwa 20 °C, Meereshöhe), <span class="f">c</span><sub>w</sub> und <span class="f">A</span> bleiben gleich. ' +
        'Grenzgeschwindigkeit <span class="f">v</span><sub>G</sub> = √(<span class="f">m</span>·<span class="f">g</span> / (½·<span class="f">ρ</span>·<span class="f">c</span><sub>w</sub>·<span class="f">A</span>)) = ' + U.fmt(F.grenzgeschwindigkeit(P), 1) + ' m/s.</p>';
    }
    h += '<details><summary>Vereinfachungen</summary><p class="small">Punktförmiger Körper, konstantes <span class="f">g</span> (gilt für Höhen, die klein gegen den Erdradius sind), keine Drehung, kein Wind. ' +
      'Der Körper ist größer gezeichnet, als er im Maßstab wäre. Die Stroboskop-Punkte zeigen die Lage in gleichen Zeitabständen.</p></details>';
    B.modell.innerHTML = h;
  }
  function hinweiseSetzen() {
    var l = [];
    if (P.h0 <= 0 && P.v0 <= 0) l.push({ art: 'warn', text: 'Der Körper liegt schon am Boden. Wähle eine Fallhöhe über 0 m oder eine Anfangsgeschwindigkeit nach oben (v₀ > 0).' });
    if (P.v0 > 0) l.push({ art: 'info', text: 'v₀ > 0: Der Körper wird zuerst nach oben geworfen (senkrechter Wurf), kehrt um und fällt dann.' });
    if (P.v0 < 0) l.push({ art: 'info', text: 'v₀ < 0: Der Körper wird nach unten geworfen.' });
    if (P.luft) l.push({ art: 'info', text: 'Luftwiderstand ist eingeschaltet – numerisches Modell. Grenzgeschwindigkeit ≈ ' + U.fmt(F.grenzgeschwindigkeit(P), 1) + ' m/s.' });
    U.hinweise(B.hinweis, l);
    if (S.spurText) S.spurText.textContent = 'Stroboskop: ein Punkt alle ' + U.fmt(strobeDt, strobeDt < 0.1 ? 2 : 1) + ' s';
  }

  // ---------------------------------------------------------------- Aufbau
  M.init = function (section) {
    B = U.werkbank(section, { id: 'fall', titel: 'Freier Fall',
      einleitung: 'Ein Körper fällt aus der Höhe <span class="f">h</span>₀. Stelle Höhe, Anfangsgeschwindigkeit und Ortsfaktor ein, starte den Versuch und verfolge die Messwerte und Diagramme.' });
    reihe = PL.reihe(0.02);
    lauf = PL.lauf(PL.takt, { schritt: schritt, zeichne: function () { zeichne(); }, zuruecksetzen: zuruecksetzen, gemeldet: function () { st.zeige(); zeichne(); } });
    st = U.steuerung(B.steuer, lauf, { ende: true });

    svgEl = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': 'Fallender Körper mit Höhenskala', class: 'pl-szene' }, B.flaeche);
    S.skala = U.svg('g', {}, svgEl);
    var boden = U.svg('g', { class: 'pl-boden' }, svgEl);
    U.svg('rect', { x: 66, y: BODEN, width: VW - 78, height: 14, class: 'pl-boden-flaeche' }, boden);
    U.svg('line', { x1: 66, y1: BODEN, x2: VW - 12, y2: BODEN, class: 'pl-boden-linie' }, boden);
    S.spur = U.svg('g', {}, svgEl);
    S.spurText = U.svg('text', { x: XK - 34, y: VH - 4, 'text-anchor': 'middle', class: 'val' }, svgEl);
    S.vpfeil = U.svg('g', {}, svgEl);
    S.koerper = U.svg('g', {}, svgEl);
    U.svg('circle', { cx: 0, cy: 0, r: 9, class: 'pl-kugel' }, S.koerper);
    S.aufprall = U.svg('text', { x: XK, y: BODEN - 26, 'text-anchor': 'middle', class: 'pl-beschr pl-aufprall', text: 'Aufprall' }, svgEl);
    S.amBoden = U.svg('text', { x: XK, y: BODEN - 26, 'text-anchor': 'middle', class: 'pl-beschr', text: 'liegt am Boden' }, svgEl);
    U.art(B.art, 'simulation', 'Körper nicht maßstäblich.');
    mw = U.messwerte(B.messwerte, [
      { id: 'h', name: 'Höhe <span class="f">h</span>', einheit: 'm' },
      { id: 't', name: 'Zeit <span class="f">t</span>', einheit: 's' },
      { id: 'v', name: 'Geschwindigkeit <span class="f">v</span> (+ nach oben)', einheit: 'm/s' },
      { id: 'a', name: 'Beschleunigung <span class="f">a</span>', einheit: 'm/s²' },
      { id: 's', name: 'zurückgelegter Weg <span class="f">s</span>', einheit: 'm' },
    ]);

    // Einstellungen
    var neu = function () { lauf.zuruecksetzen(); };
    var g1 = U.gruppe(B.einstellungen);
    E.h0 = U.regler(g1, { name: 'Fallhöhe <span class="f">h</span>₀', einheit: 'm', min: 0, max: 200, schritt: 0.5, wert: P.h0, stellen: 1, beiAenderung: function (w) { P.h0 = w; neu(); } });
    E.v0 = U.regler(g1, { name: 'Anfangsgeschwindigkeit <span class="f">v</span>₀', einheit: 'm/s', min: -30, max: 30, schritt: 0.5, wert: P.v0, stellen: 1,
      hilfe: 'positiv: nach oben geworfen, negativ: nach unten geworfen', beiAenderung: function (w) { P.v0 = w; neu(); } });
    E.g = U.gravitation(g1, P.g, function (w) { P.g = w; neu(); });
    var g2 = U.gruppe(B.einstellungen, 'Erweitert');
    var luftBox = U.html('div', {}, g2);
    E.luft = U.schalter(g2, { text: 'Luftwiderstand', an: P.luft, beiAenderung: function (an) { P.luft = an; luftBox.hidden = !an; neu(); } });
    g2.appendChild(luftBox);
    luftBox.hidden = !P.luft;
    E.m = U.regler(luftBox, { name: 'Masse <span class="f">m</span>', einheit: 'kg', min: 0.01, max: 20, schritt: 0.01, wert: P.m, stellen: 2, beiAenderung: function (w) { P.m = w; neu(); } });
    E.cw = U.regler(luftBox, { name: 'Luftwiderstandsbeiwert <span class="f">c</span><sub>w</sub>', einheit: '', min: 0.05, max: 1.5, schritt: 0.01, wert: P.cw, stellen: 2,
      hilfe: 'Kugel etwa 0,45 (hängt von der Geschwindigkeit ab)', beiAenderung: function (w) { P.cw = w; neu(); } });
    E.A = U.regler(luftBox, { name: 'Querschnittsfläche <span class="f">A</span>', einheit: 'm²', min: 0.001, max: 1, schritt: 0.001, wert: P.A, stellen: 3, beiAenderung: function (w) { P.A = w; neu(); } });
    var g3 = U.gruppe(B.einstellungen, 'Anzeige');
    U.schalter(g3, { text: 'Stroboskop-Spur', an: spurAn, beiAenderung: function (an) { spurAn = an; zeichne(); } });

    // Diagramm
    var dk = U.html('div', { class: 'pl-diagramm-kopf' }, B.diagramm);
    U.html('h2', { text: 'Diagramm' }, dk);
    var segBox = U.html('div', {}, dk);
    var dBox = U.html('div', {}, B.diagramm);
    function baueDiagramm() {
      U.leeren(dBox);
      var a = ACHSEN[ansicht];
      diag = PL.diagramm(dBox, { x: { name: 't', einheit: 's' }, y: a, label: a.label, leerText: 'Starte den Versuch.' });
      zeichneDiagramm();
    }
    U.seg(segBox, [{ wert: 'h', text: 'h(t)' }, { wert: 'v', text: 'v(t)' }, { wert: 'a', text: 'a(t)' }], ansicht, function (w) { ansicht = w; baueDiagramm(); }, 'Diagramm wählen');
    U.html('p', { class: 'small muted', text: 'Tippe oder zeige auf das Diagramm, um Messwerte abzulesen.' }, B.diagramm);

    zuruecksetzen();
    baueDiagramm();
    U.aufgaben(B.aufgaben, PL.aufgaben.fall, { titelId: B.lmTitelId, einstellen: M.einstellen });
    zeichne();
  };
  /** Parameter setzen (Lernmodus) */
  M.einstellen = function (q) {
    if (q.h0 !== undefined) { P.h0 = q.h0; E.h0.setze(q.h0, true); }
    if (q.v0 !== undefined) { P.v0 = q.v0; E.v0.setze(q.v0, true); }
    if (q.g !== undefined) { P.g = q.g; E.g.setze(q.g, true); }
    ['m', 'cw', 'A'].forEach(function (k) { if (q[k] !== undefined) { P[k] = q[k]; E[k].setze(q[k], true); } });
    if (q.luft !== undefined) E.luft.setze(q.luft);
    lauf.zuruecksetzen();
    B.flaeche.scrollIntoView({ block: 'center', behavior: U.reduziert ? 'auto' : 'smooth' });
  };
  M.zeigen = function () { zeichne(); };
  M.verstecken = function () { lauf.pause(); };
  M.lauf = function () { return lauf; };
  PL.module.fall = M;
})(window);
