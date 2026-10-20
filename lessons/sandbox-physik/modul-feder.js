// Physik-Labor · Simulation „Federpendel“ (Rechnung in feder.js)
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, FE = PL.feder;
  var VW = 360, VH = 380, DECKE = 30, RUHE = 214, XM = 170, KB = 64, KH = 46, FENSTER = 10;

  var M = {
    titel: 'Federpendel',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M20 4 H52"/><path d="M36 4 V9 L28 12 L44 16 L28 20 L44 24 L28 28 L36 31 V33"/><rect x="27" y="33" width="18" height="12" rx="2" fill="currentColor" stroke="none"/><path d="M58 18 V42 M54 22 L58 18 L62 22 M54 38 L58 42 L62 38" stroke-width="1.8"/></svg>',
  };
  var P = FE.param({ m: 0.5, D: 20, b: 0, y0: -0.1 });
  var z, reihe, lauf, st, mw, diag, B, S = {}, E = {}, ansicht = 'y', letztesDiagramm = 0, ppm = 1, sk, balken = {};

  function zuruecksetzen() {
    z = FE.neu(P);
    ppm = 120 / Math.max(Math.abs(P.y0), 0.05);
    reihe.leeren(); aufzeichnen(true);
    zeichneSkala(); modellText(); hinweiseSetzen();
  }
  function aufzeichnen(erzwingen) {
    var e = FE.energie(z, P);
    reihe.add({ t: z.t, y: z.y, v: z.v, ek: e.kin, ep: e.pot, eg: e.ges }, erzwingen);
  }
  function schritt(dt) {
    FE.schritt(z, P, dt);
    aufzeichnen(false);
    reihe.vergessen(z.t - FENSTER - 1);
    return false;
  }
  function geaendert() {
    FE.parameterGeaendert(z, P);
    aufzeichnen(true); modellText(); hinweiseSetzen(); zeichne();
  }

  function zeichneSkala() {
    U.leeren(S.skala);
    var A = Math.max(Math.abs(P.y0), 0.05) * 1.15;
    sk = PL.skala(-A * 100, A * 100, 6);                      // Einteilung in cm
    var x = VW - 54;
    U.svg('line', { x1: x, y1: RUHE - A * ppm, x2: x, y2: RUHE + A * ppm, class: 'axis' }, S.skala);
    sk.werte.forEach(function (cm) {
      var y = RUHE - cm / 100 * ppm;
      if (Math.abs(cm / 100) > A + 1e-9) return;
      U.svg('line', { x1: x - 4, y1: y, x2: x + 4, y2: y, class: 'axis' }, S.skala);
      U.svg('text', { x: x + 8, y: y + 4, class: 'val', text: (cm > 0 ? '+' : '') + U.fmt(cm, sk.stellen) }, S.skala);
    });
    var t = U.svg('text', { x: x - 6, y: RUHE - A * ppm - 10, class: 'pl-achse-titel' }, S.skala);
    U.svg('tspan', { class: 'gr', text: 'y' }, t); U.svg('tspan', { text: ' in cm' }, t);
    U.svg('line', { x1: 40, y1: RUHE, x2: x, y2: RUHE, class: 'pl-marke' }, S.skala);
    U.svg('text', { x: 40, y: RUHE - 5, class: 'val', text: 'Ruhelage' }, S.skala);
  }
  function feder(yOben, yUnten) {
    var n = 16, w = 15, d = 'M' + XM + ' ' + yOben, len = yUnten - yOben, a = len * 0.08;
    d += ' L' + XM + ' ' + (yOben + a).toFixed(1);
    for (var i = 1; i < n; i++) d += ' L' + (XM + (i % 2 ? w : -w)) + ' ' + (yOben + a + (len - 2 * a) * i / n).toFixed(1);
    d += ' L' + XM + ' ' + (yUnten - a).toFixed(1) + ' L' + XM + ' ' + yUnten.toFixed(1);
    return d;
  }
  function zeichne() {
    var yc = RUHE - z.y * ppm, oben = yc - KH / 2;
    S.feder.setAttribute('d', feder(DECKE, oben));
    S.klotz.setAttribute('y', oben.toFixed(1));
    S.mText.setAttribute('y', (yc + 5).toFixed(1));
    S.mText.textContent = U.fmt(P.m, 2) + ' kg';
    U.leeren(S.pfeile);
    var vmax = Math.abs(P.y0) * FE.omega0(P) || 1;
    if (Math.abs(z.v) / vmax * 60 > 2) {
      U.pfeil(S.pfeile, XM - KB / 2 - 18, yc, XM - KB / 2 - 18, yc - z.v / vmax * 60, 'pl-v');
      var tv = U.svg('text', { x: XM - KB / 2 - 26, y: yc - z.v / vmax * 30 + 4, 'text-anchor': 'end', class: 'pl-beschr pl-v-text' }, S.pfeile);
      U.svg('tspan', { class: 'gr', text: 'v' }, tv);
    }
    var e = FE.energie(z, P), T = FE.periode(P), f = T ? 1 / T : NaN;
    mw.alle({
      y: U.fmt(z.y, 3), v: U.fmt(z.v, 3), a: U.fmt(z.a, 2), t: U.fmt(z.t, 2),
      T: T ? U.fmt(T, 3) : 'keine', Tm: z.periodeGemessen ? U.fmt(z.periodeGemessen, 3) : '–', f: T ? U.fmt(f, 2) : '–',
    });
    var ref = Math.max(z.eStart, e.ges, 1e-12);
    setzeBalken('kin', e.kin, ref); setzeBalken('pot', e.pot, ref); setzeBalken('ges', e.ges, ref);
    setzeBalken('waerme', Math.max(0, z.eStart - e.ges), ref);
    var jetzt = root.performance ? root.performance.now() : Date.now();
    if (lauf.zustand !== 'laeuft' || jetzt - letztesDiagramm > 100) { letztesDiagramm = jetzt; zeichneDiagramm(); }
  }
  function setzeBalken(k, wert, ref) {
    balken[k].i.style.width = Math.max(0, Math.min(100, wert / ref * 100)).toFixed(1) + '%';
    balken[k].w.textContent = U.fmtAuto(wert) + ' J';
  }

  var ACHSEN = {
    y: { y: { name: 'y', einheit: 'm' }, label: 'Auslenkung über der Zeit' },
    v: { y: { name: 'v', einheit: 'm/s' }, label: 'Geschwindigkeit über der Zeit' },
    e: { y: { name: 'E', einheit: 'J' }, label: 'Energie über der Zeit' },
  };
  function zeichneDiagramm() {
    var ab = Math.max(0, z.t - FENSTER), x = [ab, Math.max(FENSTER, z.t)], A = Math.abs(P.y0), serien, y;
    if (ansicht === 'e') {
      serien = [{ punkte: reihe.punkte('ek', ab), art: 'messung', farbe: 1, name: 'Bewegungsenergie' }, { punkte: reihe.punkte('ep', ab), art: 'messung', farbe: 2, name: 'Spann- und Lageenergie' },
        { punkte: reihe.punkte('eg', ab), art: 'messung', farbe: 3, name: 'gesamt' }];
      y = [0, Math.max(z.eStart, 1e-6)];
    } else if (ansicht === 'y') {
      serien = [{ punkte: reihe.punkte('y', ab), art: 'messung', farbe: 1 }];
      y = [-Math.max(A, 0.01), Math.max(A, 0.01)];
    } else {
      var vm = Math.max(A * FE.omega0(P), 0.01);
      serien = [{ punkte: reihe.punkte('v', ab), art: 'messung', farbe: 1 }];
      y = [-vm, vm];
    }
    diag.setze({ serien: serien, x: x, y: y });
  }

  function modellText() {
    var T0 = FE.periodeUngedaempft(P), T = FE.periode(P), art = FE.art(P);
    B.modell.innerHTML = '<h2>Modell und Formeln</h2>' +
      '<p><span class="f">y</span> ist die Auslenkung aus der Ruhelage (positiv nach oben). In der Ruhelage ist die Feder schon um ' +
      '<span class="f">Δl</span> = <span class="f">m</span>·<span class="f">g</span> / <span class="f">D</span> = ' + U.fmt(FE.ruhelageDehnung(P) * 100, 1) + ' cm gedehnt (mit <span class="f">g</span> = 9,81 m/s²).</p>' +
      '<ul class="pl-formeln"><li>rücktreibende Kraft <span class="f">F</span> = −<span class="f">D</span>·<span class="f">y</span> (hookesches Gesetz), Dämpfung −<span class="f">b</span>·<span class="f">v</span></li>' +
      '<li>Periodendauer ohne Dämpfung <span class="f">T</span> = 2π·√(<span class="f">m</span> / <span class="f">D</span>) = ' + U.fmt(T0, 3) + ' s</li>' +
      '<li>Energie <span class="f">E</span> = ½·<span class="f">m</span>·<span class="f">v</span>² + ½·<span class="f">D</span>·<span class="f">y</span>²</li></ul>' +
      '<p class="small">' + (art === 'ungedaempft' ? 'Ungedämpft: Die Energie bleibt erhalten, die Schwingung hört nicht auf.' :
        art === 'gedaempft' ? 'Gedämpft: Die Periodendauer ist mit ' + U.fmt(T, 3) + ' s etwas größer, die Amplitude nimmt ab.' :
        'Die Dämpfung ist so stark, dass keine Schwingung entsteht (' + (art === 'grenzfall' ? 'aperiodischer Grenzfall' : 'Kriechfall') + '): Der Körper kriecht in die Ruhelage zurück.') + '</p>' +
      '<details><summary>Vereinfachungen</summary><p class="small">Masselose Feder, die dem hookeschen Gesetz für alle Auslenkungen folgt. Der zweite Energie-Term fasst Spannenergie der Feder und Lageenergie zusammen, gemessen ab der Ruhelage. ' +
      'Die Dämpfungskraft ist proportional zur Geschwindigkeit. Berechnung in Schritten von höchstens 1 ms (Runge-Kutta-Verfahren). ' +
      'Die Feder ist nicht maßstäblich gezeichnet, die Auslenkung schon (Skala rechts).</p></details>';
  }
  function hinweiseSetzen() {
    var l = [];
    if (P.y0 === 0) l.push({ art: 'warn', text: 'Anfangsauslenkung 0: Der Körper hängt in der Ruhelage und schwingt nicht. Wähle eine Auslenkung.' });
    var art = FE.art(P);
    if (art === 'kriechfall' || art === 'grenzfall') l.push({ art: 'info', text: 'Sehr starke Dämpfung: keine Schwingung, also auch keine Periodendauer.' });
    U.hinweise(B.hinweis, l);
  }

  M.init = function (section) {
    B = U.werkbank(section, { id: 'feder', titel: 'Federpendel',
      einleitung: 'Ein Körper hängt an einer Feder. Ziehe ihn aus der Ruhelage, lass los und untersuche, wovon Periodendauer und Energie abhängen. Masse, Federkonstante und Dämpfung kannst du auch während der Schwingung ändern.' });
    reihe = PL.reihe(0.01, 4000);
    lauf = PL.lauf(PL.takt, { schritt: schritt, zeichne: function () { zeichne(); }, zuruecksetzen: zuruecksetzen, gemeldet: function () { st.zeige(); zeichne(); } });
    st = U.steuerung(B.steuer, lauf, {});
    var svgEl = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', 'aria-label': 'Federpendel mit Skala für die Auslenkung', class: 'pl-szene' }, B.flaeche);
    U.svg('rect', { x: XM - 60, y: DECKE - 14, width: 120, height: 14, class: 'pl-decke' }, svgEl);
    for (var i = 0; i < 8; i++) U.svg('line', { x1: XM - 56 + i * 15, y1: DECKE - 14, x2: XM - 46 + i * 15, y2: DECKE - 24, class: 'axis' }, svgEl);
    S.skala = U.svg('g', {}, svgEl);
    S.feder = U.svg('path', { class: 'pl-feder' }, svgEl);
    S.klotz = U.svg('rect', { x: XM - KB / 2, width: KB, height: KH, rx: 4, class: 'pl-klotz' }, svgEl);
    S.mText = U.svg('text', { x: XM, 'text-anchor': 'middle', class: 'val' }, svgEl);
    S.pfeile = U.svg('g', {}, svgEl);
    U.art(B.art, 'simulation', 'Feder nicht maßstäblich, Auslenkung maßstäblich.');
    mw = U.messwerte(B.messwerte, [
      { id: 'y', name: 'Auslenkung <span class="f">y</span> (+ oben)', einheit: 'm' },
      { id: 'v', name: 'Geschwindigkeit <span class="f">v</span>', einheit: 'm/s' },
      { id: 'a', name: 'Beschleunigung <span class="f">a</span>', einheit: 'm/s²' },
      { id: 'T', name: 'Periodendauer <span class="f">T</span> (berechnet)', einheit: 's' },
      { id: 'Tm', name: 'Periodendauer (gemessen)', einheit: 's' },
      { id: 'f', name: 'Frequenz <span class="f">f</span>', einheit: 'Hz' },
      { id: 't', name: 'Zeit <span class="f">t</span>', einheit: 's' },
    ]);
    var eb = U.html('div', { class: 'pl-energie', 'aria-label': 'Energie' }, B.messwerte);
    [['kin', 'Bewegungsenergie', 'e-kin'], ['pot', 'Spann- + Lageenergie', 'e-pot'], ['ges', 'gesamt', 'e-ges'], ['waerme', 'in Wärme umgewandelt', 'e-waerme']].forEach(function (x) {
      var r = U.html('div', { class: 'pl-energie-zeile ' + x[2] }, eb);
      U.html('span', { text: x[1] }, r);
      var bal = U.html('span', { class: 'balken' }, r);
      balken[x[0]] = { i: U.html('i', {}, bal), w: U.html('span', { class: 'wert' }, r) };
    });

    var g1 = U.gruppe(B.einstellungen);
    E.m = U.regler(g1, { name: 'Masse <span class="f">m</span>', einheit: 'kg', min: 0.05, max: 5, schritt: 0.05, wert: P.m, stellen: 2, beiAenderung: function (w) { P.m = w; geaendert(); } });
    E.D = U.regler(g1, { name: 'Federkonstante <span class="f">D</span>', einheit: 'N/m', min: 1, max: 200, schritt: 1, wert: P.D, stellen: 0, beiAenderung: function (w) { P.D = w; geaendert(); } });
    E.b = U.regler(g1, { name: 'Dämpfung <span class="f">b</span>', einheit: 'kg/s', min: 0, max: 10, schritt: 0.05, wert: P.b, stellen: 2,
      hilfe: '0 = ungedämpft. Größere Werte bremsen stärker.', beiAenderung: function (w) { P.b = w; geaendert(); } });
    E.y0 = U.regler(g1, { name: 'Anfangsauslenkung <span class="f">y</span>₀', einheit: 'm', min: -0.25, max: 0.25, schritt: 0.01, wert: P.y0, stellen: 2,
      hilfe: 'negativ: nach unten gezogen. Eine Änderung setzt den Versuch zurück.', beiAenderung: function (w) { P.y0 = w; lauf.zuruecksetzen(); } });

    var dk = U.html('div', { class: 'pl-diagramm-kopf' }, B.diagramm);
    U.html('h2', { text: 'Diagramm' }, dk);
    var segBox = U.html('div', {}, dk), dBox = U.html('div', {}, B.diagramm);
    function baueDiagramm() {
      U.leeren(dBox);
      var a = ACHSEN[ansicht];
      diag = PL.diagramm(dBox, { x: { name: 't', einheit: 's' }, y: a.y, label: a.label, leerText: 'Starte den Versuch.' });
      zeichneDiagramm();
    }
    U.seg(segBox, [{ wert: 'y', text: 'y(t)' }, { wert: 'v', text: 'v(t)' }, { wert: 'e', text: 'Energie' }], ansicht, function (w) { ansicht = w; baueDiagramm(); }, 'Diagramm wählen');
    U.html('p', { class: 'small muted', text: 'Das Diagramm zeigt die letzten 10 Sekunden.' }, B.diagramm);

    zuruecksetzen();
    baueDiagramm();
    U.aufgaben(B.aufgaben, PL.aufgaben.feder, { titelId: B.lmTitelId, einstellen: M.einstellen });
    zeichne();
  };
  M.einstellen = function (q) {
    ['m', 'D', 'b', 'y0'].forEach(function (key) { if (q[key] !== undefined) { P[key] = q[key]; E[key].setze(q[key], true); } });
    lauf.zuruecksetzen();
    B.flaeche.scrollIntoView({ block: 'center', behavior: U.reduziert ? 'auto' : 'smooth' });
  };
  M.zeigen = function () { zeichne(); };
  M.verstecken = function () { lauf.pause(); };
  PL.module.feder = M;
})(window);
