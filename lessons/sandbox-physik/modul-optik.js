// Physik-Labor · „Optik-Labor“: Linsen (Sammel-/Zerstreuungslinse), Bild im ebenen Spiegel, Strahlengang mit Spiegeln
// (Rechnung in optik.js). Statische Konstruktion – keine Animationsschleife.
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui, O = PL.optik;
  var VW = 640, VH = 320;

  var M = {
    titel: 'Optik-Labor',
    icon: '<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 24 H70" stroke-width="1.2"/><path d="M36 4 Q46 24 36 44 Q26 24 36 4 Z"/><path d="M8 24 V12 M5 15 L8 12 L11 15"/><path d="M8 12 L36 12 L64 34" stroke-width="1.6"/><path d="M8 12 L64 36" stroke-width="1.6"/></svg>',
  };
  var MODI = [{ wert: 'linse', text: 'Linsen' }, { wert: 'spiegel', text: 'Ebener Spiegel' }, { wert: 'labor', text: 'Strahlengang mit Spiegeln' }];
  var modus = 'linse';
  var L = { art: 'sammel', f: 10, g: 30, G: 3, haupt: true, weitere: false };
  var SP = { g: 15, G: 4, lot: true };
  var LB = { lampeY: 20, lampeW: 0, lot: true, gewaehlt: 0, spiegel: [{ x: 50, y: 20, laenge: 16, winkel: 45 }, { x: 50, y: 48, laenge: 16, winkel: 45 }] };
  var messungen = [];
  var B, E = {}, S = {}, mwL, mwS, mwB, diag, svgEl, panels = {};

  function f() { return L.art === 'sammel' ? L.f : -L.f; }

  // ================================================================ Linsen
  var XL = 65, sx = (VW - 40) / (2 * XL), sy = sx * 3, AX = VH / 2;
  function lx(x) { return VW / 2 + x * sx; }
  function ly(y) { return AX - y * sy; }
  function linie(g, t, kl) { return U.svg('line', { x1: lx(t.x1).toFixed(1), y1: ly(t.y1).toFixed(1), x2: lx(t.x2).toFixed(1), y2: ly(t.y2).toFixed(1), class: kl }, g); }
  function textIdx(parent, x, y, grund, idx, rest, anker, kl) {
    var t = U.svg('text', { x: x, y: y, 'text-anchor': anker || 'middle', class: kl || 'pl-beschr' }, parent);
    U.svg('tspan', { class: 'gr', text: grund }, t);
    if (idx) U.svg('tspan', { class: 'idx', dy: 3, text: idx }, t);
    if (rest) U.svg('tspan', { dy: idx ? -3 : 0, text: rest }, t);
    return t;
  }
  function zeichneLinse() {
    var ff = f(), bild = O.abbildung(ff, L.g, L.G);
    U.leeren(S.inhalt);
    var g = S.inhalt, cid = U.id('clip');
    var defs = U.svg('defs', {}, g), cp = U.svg('clipPath', { id: cid }, defs);
    U.svg('rect', { x: 0, y: 0, width: VW, height: VH }, cp);
    // Achse mit cm-Einteilung
    U.svg('line', { x1: 0, y1: AX, x2: VW, y2: AX, class: 'pl-achse-optik' }, g);
    for (var c = -60; c <= 60; c += 10) {
      U.svg('line', { x1: lx(c), y1: AX - 3, x2: lx(c), y2: AX + 3, class: 'axis' }, g);
      if (c !== 0 && c % 20 === 0) U.svg('text', { x: lx(c), y: VH - 6, 'text-anchor': 'middle', class: 'val', text: c + ' cm' }, g);
    }
    // Linse: Form zeigt die Art, gebrochen wird in der Linsenebene (dünne Linse)
    var hL = 10.5, yo = ly(hL), yu = ly(-hL), w = 9;
    var d = L.art === 'sammel' ? 'M' + lx(0) + ' ' + yo + ' Q' + (lx(0) + w * 2) + ' ' + AX + ' ' + lx(0) + ' ' + yu + ' Q' + (lx(0) - w * 2) + ' ' + AX + ' ' + lx(0) + ' ' + yo + ' Z'
      : 'M' + (lx(0) - w) + ' ' + yo + ' L' + (lx(0) + w) + ' ' + yo + ' Q' + (lx(0) + 1) + ' ' + AX + ' ' + (lx(0) + w) + ' ' + yu + ' L' + (lx(0) - w) + ' ' + yu + ' Q' + (lx(0) - 1) + ' ' + AX + ' ' + (lx(0) - w) + ' ' + yo + ' Z';
    U.svg('path', { d: d, class: 'pl-linse' }, g);
    U.svg('line', { x1: lx(0), y1: 4, x2: lx(0), y2: VH - 16, class: 'pl-marke' }, g);
    // Brennpunkte und doppelte Brennweite
    [[-L.f, 'F'], [L.f, 'F′'], [-2 * L.f, '2F'], [2 * L.f, '2F′']].forEach(function (p) {
      var xx = ff > 0 ? p[0] : -p[0];
      if (Math.abs(xx) > XL) return;
      U.svg('circle', { cx: lx(xx), cy: AX, r: p[1].indexOf('2') === 0 ? 2.5 : 3.5, class: 'pl-brennpunkt' }, g);
      U.svg('text', { x: lx(xx), y: AX + 17, 'text-anchor': 'middle', class: p[1].indexOf('2') === 0 ? 'val' : 'pl-beschr', text: p[1] }, g);
    });
    // Strahlen
    var gs = U.svg('g', { 'clip-path': 'url(#' + cid + ')' }, g);
    if (L.weitere) {
      [-8, -4.5, -1.5, 1.5, 4.5, 8].forEach(function (yL) {
        O.strahlDurch(ff, L.g, L.G, yL, XL + 10).teile.forEach(function (t) { linie(gs, t, 'pl-strahl s0' + (t.art === 'verlaengert' ? ' verlaengert' : '')); });
      });
    }
    if (L.haupt) {
      O.hauptstrahlen(ff, L.g, L.G, XL + 10).forEach(function (s, i) {
        s.teile.forEach(function (t) { linie(gs, t, 'pl-strahl s' + (i + 1) + (t.art === 'verlaengert' ? ' verlaengert' : '')); });
      });
    }
    // Gegenstand (verschiebbar) und Bild
    S.gegenstand = U.svg('g', { class: 'pl-ziehen', tabindex: 0, role: 'slider', 'aria-label': 'Gegenstand verschieben (Gegenstandsweite)', 'aria-valuemin': 1, 'aria-valuemax': 60, 'aria-valuenow': L.g, 'aria-valuetext': 'g = ' + U.fmt(L.g, 1) + ' cm' }, g);
    U.svg('rect', { x: lx(-L.g) - 16, y: Math.min(ly(L.G), AX) - 10, width: 32, height: Math.abs(ly(L.G) - AX) + 20, class: 'pl-griff' }, S.gegenstand);
    U.pfeil(S.gegenstand, lx(-L.g), AX, lx(-L.g), ly(L.G), 'pl-gegenstand', 10);
    textIdx(S.gegenstand, lx(-L.g), ly(L.G) - 8, 'G', '', '', 'middle');
    ziehbar(S.gegenstand, 'linse', function (xSvg) { E.g.setze(Math.round(Math.max(1, Math.min(60, -(xSvg - VW / 2) / sx)) * 2) / 2); },
      function (schritt) { E.g.setze(Math.max(1, Math.min(60, L.g - schritt))); });
    var draussen = bild.unendlich || Math.abs(bild.b) > XL || Math.abs(bild.B) * sy > AX - 4;
    if (!bild.unendlich && !draussen) {
      U.pfeil(g, lx(bild.b), AX, lx(bild.b), ly(bild.B), 'pl-bild' + (bild.virtuell ? ' virtuell' : ''), 10);
      textIdx(g, lx(bild.b) + 7, (AX + ly(bild.B)) / 2 + 4, 'B', '', bild.virtuell ? ' (virtuell)' : '', 'start');
    }
    // Messwerte
    mwL.alle({
      g: U.fmt(L.g, 1), b: bild.unendlich ? '∞' : U.fmt(bild.b, 1), G: U.fmt(L.G, 1), B: bild.unendlich ? '∞' : U.fmt(bild.B, 2),
      A: bild.unendlich ? '∞' : U.fmt(bild.A, 2),
    });
    var art = bild.unendlich ? 'kein Bild: Strahlen laufen parallel (Bild im Unendlichen)'
      : (bild.reell ? 'reell' : 'virtuell') + ', ' + (bild.aufrecht ? 'aufrecht' : 'umgekehrt') + ', ' +
        (Math.abs(Math.abs(bild.A) - 1) < 0.005 ? 'gleich groß' : Math.abs(bild.A) > 1 ? 'vergrößert' : 'verkleinert');
    S.bildart.textContent = 'Bild: ' + art;
    var h = [];
    if (draussen && !bild.unendlich) h.push({ art: 'info', text: 'Das Bild liegt außerhalb der Zeichnung (b = ' + U.fmt(bild.b, 1) + ' cm, B = ' + U.fmt(bild.B, 1) + ' cm).' });
    if (bild.virtuell) h.push({ art: 'info', text: '<b>Virtuelles Bild:</b> Hinter der Linse laufen die Strahlen auseinander. Nur ihre gedachten Verlängerungen (gestrichelt) schneiden sich – auf der Seite des Gegenstands. Ein Schirm zeigt dort nichts, das Auge sieht das Bild aber. ' +
      (ff > 0 ? 'Das passiert bei der Sammellinse, wenn g < f ist (Lupe).' : 'Eine Zerstreuungslinse erzeugt immer ein virtuelles, verkleinertes Bild.') });
    if (bild.unendlich) h.push({ art: 'info', text: 'Der Gegenstand steht genau im Brennpunkt: Hinter der Linse laufen alle Strahlen parallel, es entsteht kein Bild.' });
    U.hinweise(B.hinweis, h);
    zeichneMessDiagramm();
  }

  function zeichneMessDiagramm() {
    var ff = f(), echt = [], virt = [];
    for (var gg = 0.5; gg <= 60; gg += 0.25) {
      var b = O.abbildung(ff, gg, 1).b;
      if (!isFinite(b) || Math.abs(b) > 150) continue;
      (b > 0 ? echt : virt).push([gg, b]);
    }
    var pts = messungen.filter(function (m) { return m.f === ff && isFinite(m.b); }).map(function (m) { return [m.g, m.b]; });
    var yMin = -40, yMax = 60;
    pts.forEach(function (p) { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); });
    diag.setze({ serien: [
      { punkte: echt, art: 'theorie', farbe: 2, name: 'Linsengleichung (berechnet)' }, { punkte: virt, art: 'theorie', farbe: 2 },
      { punkte: pts, art: 'punkte', farbe: 1, name: 'notierte Messwerte' },
    ], x: [0, 60], y: [Math.max(yMin, -150), Math.min(yMax, 150)] });
    U.leeren(S.tabelleKoerper);
    messungen.forEach(function (m) {
      var tr = U.html('tr', {}, S.tabelleKoerper);
      [m.f > 0 ? 'Sammel' : 'Zerstreu', U.fmt(Math.abs(m.f), 1), U.fmt(m.g, 1), isFinite(m.b) ? U.fmt(m.b, 1) : '∞', isFinite(m.B) ? U.fmt(m.B, 2) : '∞'].forEach(function (t) { U.html('td', { text: t }, tr); });
    });
    S.tabelle.hidden = !messungen.length;
  }

  /** Element mit Zeiger/Finger waagerecht ziehen; mit Pfeiltasten in Schritten verschieben */
  // Die Zeichnung wird bei jeder Änderung neu aufgebaut. Deshalb hört das (bleibende) SVG auf die Zeigerbewegung,
  // und nach einer Tastatureingabe bekommt das neu gezeichnete Element mit demselben Schlüssel den Fokus zurück.
  var ziehen = null;
  function ziehbar(el, schluessel, beiZiehen, beiTaste) {
    el.setAttribute('data-ziehen', schluessel);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      ziehen = beiZiehen;
      try { svgEl.setPointerCapture(e.pointerId); } catch (x) { /* ignorieren */ }
    });
    el.addEventListener('keydown', function (e) {
      var s = { ArrowLeft: -0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowUp: 0.5 }[e.key];
      if (s === undefined) return;
      e.preventDefault();
      beiTaste(e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' || e.key === 'ArrowDown' ? s : 0);
      var neu = svgEl.querySelector('[data-ziehen="' + schluessel + '"]');
      if (neu) neu.focus();
    });
  }
  function ziehenStart() {
    svgEl.addEventListener('pointermove', function (ev) {
      if (!ziehen) return;
      var r = svgEl.getBoundingClientRect();
      ziehen((ev.clientX - r.left) / r.width * VW, (ev.clientY - r.top) / r.height * VH);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { svgEl.addEventListener(t, function () { ziehen = null; }); });
  }

  // ================================================================ Ebener Spiegel
  var XS = 45, ss = (VW - 40) / (2 * XS), AXS = VH / 2 + 60;
  function sxp(x) { return VW / 2 + x * ss; }
  function syp(y) { return AXS - y * ss; }
  function zeichneSpiegel() {
    U.leeren(S.inhalt);
    var g = S.inhalt, bild = O.spiegelbild(SP.g, SP.G);
    U.svg('line', { x1: 0, y1: syp(0), x2: VW, y2: syp(0), class: 'pl-achse-optik' }, g);
    // Spiegel bei x = 0, Rückseite schraffiert
    var oben = 22, unten = -8;
    for (var y = unten; y < oben; y += 2) U.svg('line', { x1: sxp(0), y1: syp(y), x2: sxp(0) + 7, y2: syp(y) - 7, class: 'pl-spiegel-rueck' }, g);
    U.svg('line', { x1: sxp(0), y1: syp(unten), x2: sxp(0), y2: syp(oben), class: 'pl-spiegel' }, g);
    // Strahlen vom Gegenstandspunkt zum Spiegel und zurück; Verlängerungen hinter den Spiegel
    var punkte = [SP.G - 9, SP.G - 4, SP.G + 2].filter(function (ys) { return ys > unten && ys < oben; });
    O.spiegelStrahlen(SP.g, SP.G, punkte, -XS - 5).forEach(function (s, i) {
      s.teile.forEach(function (t) {
        U.svg('line', { x1: sxp(t.x1), y1: syp(t.y1), x2: sxp(t.x2), y2: syp(t.y2), class: 'pl-strahl s' + (i + 1) + (t.art === 'verlaengert' ? ' verlaengert' : '') }, g);
      });
      if (SP.lot && i === 1) {
        var ys = punkte[1], a = Math.atan2(Math.abs(ys - SP.G), SP.g) * 180 / Math.PI;
        U.svg('line', { x1: sxp(0), y1: syp(ys), x2: sxp(-14), y2: syp(ys), class: 'pl-lot' }, g);
        U.svg('text', { x: sxp(-14), y: syp(ys) - 5, 'text-anchor': 'start', class: 'val', text: 'Lot' }, g);
        var r = 40, w1 = Math.atan2(SP.G - ys, -SP.g), w2 = -w1;   // Richtung zum Gegenstand bzw. reflektiert (Weltwinkel)
        bogen(g, sxp(0), syp(ys), r, Math.PI, w1);
        bogen(g, sxp(0), syp(ys), r + 8, Math.PI, w2);
        U.svg('text', { x: sxp(0) + 12, y: syp(ys) + 4, class: 'val', text: 'α = α′ = ' + U.fmt(a, 1) + '°' }, g);
      }
    });
    // Gegenstand (verschiebbar) und Bild
    S.gegenstand = U.svg('g', { class: 'pl-ziehen', tabindex: 0, role: 'slider', 'aria-label': 'Gegenstand verschieben (Abstand zum Spiegel)', 'aria-valuemin': 2, 'aria-valuemax': 40, 'aria-valuenow': SP.g }, g);
    U.svg('rect', { x: sxp(-SP.g) - 16, y: syp(SP.G) - 10, width: 32, height: SP.G * ss + 20, class: 'pl-griff' }, S.gegenstand);
    U.pfeil(S.gegenstand, sxp(-SP.g), syp(0), sxp(-SP.g), syp(SP.G), 'pl-gegenstand', 10);
    textIdx(S.gegenstand, sxp(-SP.g), syp(SP.G) - 8, 'G', '', '', 'middle');
    ziehbar(S.gegenstand, 'spiegel', function (xSvg) { E.sg.setze(Math.round(Math.max(2, Math.min(40, -(xSvg - VW / 2) / ss)) * 2) / 2); },
      function (schritt) { E.sg.setze(Math.max(2, Math.min(40, SP.g - schritt))); });
    U.pfeil(g, sxp(-bild.b), syp(0), sxp(-bild.b), syp(bild.B), 'pl-bild virtuell', 10);
    textIdx(g, sxp(-bild.b), syp(bild.B) - 8, 'B', '', ' (virtuell)', 'middle');
    // Abstände
    U.svg('line', { x1: sxp(-SP.g), y1: syp(-4), x2: sxp(0), y2: syp(-4), class: 'axis' }, g);
    U.svg('line', { x1: sxp(0), y1: syp(-4), x2: sxp(SP.g), y2: syp(-4), class: 'pl-marke' }, g);
    textIdx(g, sxp(-SP.g / 2), syp(-4) + 16, 'g', '', ' = ' + U.fmt(SP.g, 1) + ' cm', 'middle', 'val');
    textIdx(g, sxp(SP.g / 2), syp(-4) + 16, 'b', '', ' = ' + U.fmt(SP.g, 1) + ' cm', 'middle', 'val');
    mwS.alle({ g: U.fmt(SP.g, 1), b: U.fmt(-bild.b, 1), G: U.fmt(SP.G, 1), B: U.fmt(bild.B, 1) });
    U.hinweise(B.hinweis, [{ art: 'info', text: '<b>Virtuelles Bild:</b> Die reflektierten Strahlen laufen auseinander. Für das Auge scheinen sie von einem Punkt hinter dem Spiegel zu kommen (gestrichelt). Dort ist aber kein Licht – ein Schirm hinter dem Spiegel bliebe dunkel.' }]);
  }
  /** Winkelbogen um (cx|cy) von Richtung a1 nach a2 (Weltwinkel, y nach oben) */
  function bogen(g, cx, cy, r, a1, a2) {
    var p = function (a) { return [cx + Math.cos(a) * r, cy - Math.sin(a) * r]; }, s = p(a1), e = p(a2);
    if (a2 < 0) a2 += 2 * Math.PI;
    var gross = Math.abs(a2 - a1) > Math.PI ? 1 : 0, im = a2 > a1 ? 0 : 1;
    U.svg('path', { d: 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + gross + ' ' + im + ' ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1), class: 'pl-lot' }, g);
  }

  // ================================================================ Strahlengang mit Spiegeln
  var BW = 106, BH = 60, bs = VW / BW;
  function bx(x) { return x * bs; }
  function by(y) { return VH - y * bs; }
  function zeichneLabor() {
    U.leeren(S.inhalt);
    var g = S.inhalt;
    for (var x = 10; x < BW; x += 10) U.svg('line', { x1: bx(x), y1: 0, x2: bx(x), y2: VH, class: 'gridline' }, g);
    for (var y = 10; y < BH; y += 10) U.svg('line', { x1: 0, y1: by(y), x2: VW, y2: by(y), class: 'gridline' }, g);
    var r = O.verfolge(4, LB.lampeY, LB.lampeW, LB.spiegel, 20, 300);
    U.svg('polyline', { points: r.punkte.map(function (p) { return bx(p.x).toFixed(1) + ',' + by(p.y).toFixed(1); }).join(' '), class: 'pl-licht' }, g);
    // Spiegel
    LB.spiegel.forEach(function (s, i) {
      var e = O.spiegelEnden(s), gg = U.svg('g', { class: 'pl-ziehen', tabindex: 0, role: 'button', 'aria-label': 'Spiegel ' + (i + 1) + ' verschieben (Pfeiltasten)' }, g);
      U.svg('line', { x1: bx(e.x1), y1: by(e.y1), x2: bx(e.x2), y2: by(e.y2), class: 'pl-griff', 'stroke-width': 22, stroke: 'transparent' }, gg);
      U.svg('line', { x1: bx(e.x1), y1: by(e.y1), x2: bx(e.x2), y2: by(e.y2), class: 'pl-spiegel' + (i === LB.gewaehlt ? ' gewaehlt' : '') }, gg);
      U.svg('text', { x: bx(s.x) + 10, y: by(s.y) - 10, class: 'val', text: String(i + 1) }, gg);
      gg.addEventListener('pointerdown', function () { if (LB.gewaehlt !== i) { LB.gewaehlt = i; reglerLabor(); } });
      ziehbar(gg, 'spiegel-' + i, function (xs, ys) {
        s.x = Math.round(Math.max(0, Math.min(BW, xs / bs))); s.y = Math.round(Math.max(0, Math.min(BH, (VH - ys) / bs)));
        reglerLabor(true); zeichneLabor();
      }, function (dx, dy) { s.x = Math.max(0, Math.min(BW, s.x + dx * 2)); s.y = Math.max(0, Math.min(BH, s.y + dy * 2)); LB.gewaehlt = i; reglerLabor(true); zeichneLabor(); });
    });
    // Lot und Winkel an jeder Reflexion
    if (LB.lot) r.reflexionen.forEach(function (q) {
      var e = O.spiegelEnden(LB.spiegel[q.spiegel]), tx = e.x2 - e.x1, ty = e.y2 - e.y1, l = Math.hypot(tx, ty), nx = -ty / l * 6, ny = tx / l * 6;
      U.svg('line', { x1: bx(q.x - nx), y1: by(q.y - ny), x2: bx(q.x + nx), y2: by(q.y + ny), class: 'pl-lot' }, g);
      U.svg('text', { x: bx(q.x) + 8, y: by(q.y) + 16, class: 'val', text: U.fmt(q.einfall, 1) + '°' }, g);
    });
    // Lampe
    var lg = U.svg('g', { transform: 'translate(' + bx(4) + ' ' + by(LB.lampeY) + ') rotate(' + (-LB.lampeW) + ')' }, g);
    U.svg('rect', { x: -16, y: -9, width: 22, height: 18, rx: 3, class: 'pl-lampe' }, lg);
    U.svg('text', { x: bx(4) - 4, y: by(LB.lampeY) - 14, class: 'val', text: 'Lampe' }, g);
    mwB.alle({ n: String(r.reflexionen.length), w: r.reflexionen.length ? r.reflexionen.map(function (q) { return U.fmt(q.einfall, 1) + '°'; }).join(' · ') : '–' });
    U.hinweise(B.hinweis, [{ art: 'info', text: 'Reflexionsgesetz: Einfallswinkel = Reflexionswinkel, beide gemessen zum Lot (gestrichelt, senkrecht auf dem Spiegel). Ziehe die Spiegel mit dem Finger oder der Maus.' }]);
  }
  function reglerLabor(nurWerte) {
    var s = LB.spiegel[LB.gewaehlt];
    if (!nurWerte) baueSpiegelWahl();
    if (!s) { E.lbBox.hidden = true; return; }
    E.lbBox.hidden = false;
    E.lbx.setze(s.x, true); E.lby.setze(s.y, true); E.lbw.setze(s.winkel, true); E.lbl.setze(s.laenge, true);
    if (!nurWerte) zeichneLabor();
  }
  function baueSpiegelWahl() {
    U.seg(E.wahl, LB.spiegel.map(function (s, i) { return { wert: i, text: 'Spiegel ' + (i + 1) }; }), LB.gewaehlt, function (w) { LB.gewaehlt = Number(w); reglerLabor(); }, 'Spiegel wählen');
    E.plus.disabled = LB.spiegel.length >= 5; E.minus.disabled = !LB.spiegel.length;
  }

  // ================================================================ Aufbau
  function texte() {
    var t = {
      linse: '<h2>Modell und Formeln</h2><ul class="pl-formeln"><li>Linsengleichung: 1/<span class="f">f</span> = 1/<span class="f">g</span> + 1/<span class="f">b</span></li>' +
        '<li>Abbildungsmaßstab: <span class="f">A</span> = <span class="f">B</span>/<span class="f">G</span> = −<span class="f">b</span>/<span class="f">g</span></li></ul>' +
        '<p class="small">Vorzeichen: <span class="f">f</span> &lt; 0 bei der Zerstreuungslinse; <span class="f">b</span> &lt; 0 heißt virtuelles Bild auf der Seite des Gegenstands; <span class="f">A</span> &lt; 0 heißt, das Bild steht auf dem Kopf.</p>' +
        '<p class="small"><b>Hauptstrahlen:</b> <span style="color: var(--p-strahl)">Parallelstrahl</span> → wird zum Brennpunktstrahl · <span style="color: var(--p-strahl2)">Mittelpunktstrahl</span> → geht ungebrochen durch · <span style="color: var(--p-strahl3)">Brennpunktstrahl</span> → wird zum Parallelstrahl. Gestrichelt: gedachte Verlängerungen.</p>' +
        '<details><summary>Vereinfachungen</summary><p class="small">Dünne Linse: Die Brechung wird in der Linsenebene gezeichnet. Achsennahe Strahlen, keine Linsenfehler. ' +
        'In der Zeichnung sind Höhen 3-mal so stark vergrößert wie Abstände – Strahlen bleiben dabei gerade und schneiden sich an denselben Stellen, nur die Winkel wirken steiler.</p></details>',
      spiegel: '<h2>Modell und Formeln</h2><ul class="pl-formeln"><li>Reflexionsgesetz: Einfallswinkel <span class="f">α</span> = Reflexionswinkel <span class="f">α′</span></li>' +
        '<li>Bildweite = Gegenstandsweite, Bildgröße = Gegenstandsgröße</li></ul>' +
        '<p class="small">Das Bild ist virtuell, aufrecht und gleich groß. Vorne und hinten sind vertauscht. Die Zeichnung ist maßstäblich (gleicher Maßstab in beide Richtungen).</p>',
      labor: '<h2>Modell und Formeln</h2><p>Ein Lichtstrahl trifft auf ebene Spiegel. An jedem Spiegel gilt: Einfallswinkel = Reflexionswinkel (zum Lot gemessen).</p>' +
        '<p class="small">Voreingestellt ist ein <b>Periskop</b>: zwei parallele Spiegel unter 45° versetzen den Strahl nach oben. Probiere auch einen Winkelspiegel (zwei Spiegel unter 90°) – er schickt das Licht in die Richtung zurück, aus der es kam.</p>' +
        '<details><summary>Vereinfachungen</summary><p class="small">Strahlenmodell des Lichts; die Spiegel reflektieren vollständig und auf beiden Seiten. Höchstens 20 Reflexionen werden verfolgt.</p></details>',
    };
    B.modell.innerHTML = t[modus];
  }
  function zeichneAlles() {
    if (modus === 'linse') zeichneLinse(); else if (modus === 'spiegel') zeichneSpiegel(); else zeichneLabor();
  }
  function setzeModus(m, still) {
    modus = m;
    U.segSetze(B.unter, m);
    ['linse', 'spiegel', 'labor'].forEach(function (k) { panels[k].hidden = k !== m; });
    B.diagramm.parentNode.hidden = m !== 'linse';
    U.art(B.art, 'schema', m === 'linse' ? 'Abstände maßstäblich, Höhen 3-fach überhöht gezeichnet.' : m === 'spiegel' ? 'Maßstäblich in beide Richtungen.' : 'Maßstäblich, Raster 10 cm.');
    svgEl.setAttribute('aria-label', m === 'linse' ? 'Strahlengang an einer ' + (L.art === 'sammel' ? 'Sammellinse' : 'Zerstreuungslinse') : m === 'spiegel' ? 'Bild am ebenen Spiegel' : 'Lichtstrahl und ebene Spiegel');
    texte(); zeichneAlles();
    if (!still && PL.unterGewechselt) PL.unterGewechselt('optik', m === 'linse' ? null : m);
  }

  M.init = function (section) {
    B = U.werkbank(section, { id: 'optik', titel: 'Optik-Labor', unter: true,
      einleitung: 'Konstruiere Bilder mit Linsen und Spiegeln. Den Gegenstand (blauer Pfeil) kannst du mit dem Finger oder der Maus verschieben, die Werte auch rechts einstellen.' });
    U.seg(B.unter, MODI, modus, function (w) { setzeModus(w); }, 'Bereich wählen');
    B.unter.classList.remove('seg');
    svgEl = U.svg('svg', { viewBox: '0 0 ' + VW + ' ' + VH, role: 'img', class: 'pl-szene' }, B.flaeche);
    S.inhalt = U.svg('g', {}, svgEl);
    ziehenStart();
    S.bildart = U.html('p', { class: 'pl-bildart', role: 'status' }, B.flaeche);

    // --- Linse
    var pl = panels.linse = U.html('div', {}, B.einstellungen);
    var artBox = U.html('div', { class: 'pl-knoepfe' }, pl);
    U.seg(artBox, [{ wert: 'sammel', text: 'Sammellinse' }, { wert: 'zerstreu', text: 'Zerstreuungslinse' }], L.art, function (w) { L.art = w; setzeModus('linse', true); }, 'Linsenart');
    E.f = U.regler(pl, { name: 'Brennweite |<span class="f">f</span>|', einheit: 'cm', min: 2, max: 25, schritt: 0.5, wert: L.f, stellen: 1, beiAenderung: function (w) { L.f = w; zeichneLinse(); } });
    E.g = U.regler(pl, { name: 'Gegenstandsweite <span class="f">g</span>', einheit: 'cm', min: 1, max: 60, schritt: 0.5, wert: L.g, stellen: 1, beiAenderung: function (w) { L.g = w; zeichneLinse(); } });
    E.G = U.regler(pl, { name: 'Gegenstandsgröße <span class="f">G</span>', einheit: 'cm', min: 0.5, max: 5, schritt: 0.1, wert: L.G, stellen: 1, beiAenderung: function (w) { L.G = w; zeichneLinse(); } });
    var an = U.gruppe(pl, 'Anzeige');
    U.schalter(an, { text: 'Hauptstrahlen', an: L.haupt, beiAenderung: function (v) { L.haupt = v; zeichneLinse(); } });
    U.schalter(an, { text: 'weitere Strahlen', an: L.weitere, beiAenderung: function (v) { L.weitere = v; zeichneLinse(); } });

    // --- Spiegel
    var ps = panels.spiegel = U.html('div', {}, B.einstellungen);
    E.sg = U.regler(ps, { name: 'Gegenstandsweite <span class="f">g</span>', einheit: 'cm', min: 2, max: 40, schritt: 0.5, wert: SP.g, stellen: 1, beiAenderung: function (w) { SP.g = w; zeichneSpiegel(); } });
    E.sG = U.regler(ps, { name: 'Gegenstandsgröße <span class="f">G</span>', einheit: 'cm', min: 1, max: 10, schritt: 0.5, wert: SP.G, stellen: 1, beiAenderung: function (w) { SP.G = w; zeichneSpiegel(); } });
    U.schalter(U.gruppe(ps, 'Anzeige'), { text: 'Lot und Winkel', an: SP.lot, beiAenderung: function (v) { SP.lot = v; zeichneSpiegel(); } });

    // --- Labor
    var pb = panels.labor = U.html('div', {}, B.einstellungen);
    var lampe = U.gruppe(pb, 'Lampe');
    U.regler(lampe, { name: 'Höhe', einheit: 'cm', min: 2, max: 58, schritt: 1, wert: LB.lampeY, stellen: 0, beiAenderung: function (w) { LB.lampeY = w; zeichneLabor(); } });
    U.regler(lampe, { name: 'Richtung', einheit: '°', min: -80, max: 80, schritt: 1, wert: LB.lampeW, stellen: 0, hilfe: '0° = waagerecht nach rechts', beiAenderung: function (w) { LB.lampeW = w; zeichneLabor(); } });
    var sg = U.gruppe(pb, 'Spiegel');
    E.wahl = U.html('div', { class: 'pl-knoepfe' }, sg);
    var kn = U.html('div', { class: 'pl-knoepfe' }, sg);
    E.plus = U.html('button', { type: 'button', class: 'pl-klein', text: '+ Spiegel hinzufügen' }, kn);
    E.minus = U.html('button', { type: 'button', class: 'pl-klein', text: '− gewählten entfernen' }, kn);
    E.plus.addEventListener('click', function () {
      if (LB.spiegel.length >= 5) return;
      LB.spiegel.push({ x: 80, y: 30, laenge: 16, winkel: -45 }); LB.gewaehlt = LB.spiegel.length - 1; reglerLabor();
    });
    E.minus.addEventListener('click', function () {
      LB.spiegel.splice(LB.gewaehlt, 1); LB.gewaehlt = Math.max(0, Math.min(LB.gewaehlt, LB.spiegel.length - 1)); reglerLabor();
    });
    E.lbBox = U.html('div', {}, sg);
    function lbSetze(k) { return function (w) { var s = LB.spiegel[LB.gewaehlt]; if (s) { s[k] = w; zeichneLabor(); } }; }
    E.lbx = U.regler(E.lbBox, { name: 'Lage waagerecht', einheit: 'cm', min: 0, max: BW, schritt: 1, wert: 50, stellen: 0, beiAenderung: lbSetze('x') });
    E.lby = U.regler(E.lbBox, { name: 'Lage senkrecht', einheit: 'cm', min: 0, max: BH, schritt: 1, wert: 20, stellen: 0, beiAenderung: lbSetze('y') });
    E.lbw = U.regler(E.lbBox, { name: 'Neigung', einheit: '°', min: -90, max: 90, schritt: 1, wert: 45, stellen: 0, beiAenderung: lbSetze('winkel') });
    E.lbl = U.regler(E.lbBox, { name: 'Länge', einheit: 'cm', min: 4, max: 40, schritt: 1, wert: 16, stellen: 0, beiAenderung: lbSetze('laenge') });
    U.schalter(U.gruppe(pb, 'Anzeige'), { text: 'Lot und Winkel', an: LB.lot, beiAenderung: function (v) { LB.lot = v; zeichneLabor(); } });

    // Messwerte unter der Zeichnung (je Bereich)
    mwL = U.messwerte(U.html('div', { 'data-modus': 'linse' }, B.messwerte), [
      { id: 'g', name: 'Gegenstandsweite <span class="f">g</span>', einheit: 'cm' }, { id: 'b', name: 'Bildweite <span class="f">b</span>', einheit: 'cm' },
      { id: 'G', name: 'Gegenstandsgröße <span class="f">G</span>', einheit: 'cm' }, { id: 'B', name: 'Bildgröße <span class="f">B</span>', einheit: 'cm' },
      { id: 'A', name: 'Abbildungsmaßstab <span class="f">A</span>', einheit: '' },
    ]);
    mwS = U.messwerte(U.html('div', { 'data-modus': 'spiegel' }, B.messwerte), [
      { id: 'g', name: 'Gegenstandsweite <span class="f">g</span>', einheit: 'cm' }, { id: 'b', name: 'Bild hinter dem Spiegel', einheit: 'cm' },
      { id: 'G', name: 'Gegenstandsgröße <span class="f">G</span>', einheit: 'cm' }, { id: 'B', name: 'Bildgröße <span class="f">B</span>', einheit: 'cm' },
    ]);
    mwB = U.messwerte(U.html('div', { 'data-modus': 'labor' }, B.messwerte), [
      { id: 'n', name: 'Reflexionen', einheit: '' }, { id: 'w', name: 'Einfallswinkel (zum Lot)', einheit: '' },
    ]);
    panels.mwL = B.messwerte.querySelector('[data-modus=linse]'); panels.mwS = B.messwerte.querySelector('[data-modus=spiegel]'); panels.mwB = B.messwerte.querySelector('[data-modus=labor]');
    // Messwerte gehören zum jeweiligen Bereich
    var alt = setzeModus;
    setzeModus = function (m, still) {
      alt(m, still);
      panels.mwL.hidden = m !== 'linse'; panels.mwS.hidden = m !== 'spiegel'; panels.mwB.hidden = m !== 'labor';
      S.bildart.hidden = m !== 'linse';
    };

    // Messreihe b(g)
    var dk = U.html('div', { class: 'pl-diagramm-kopf' }, B.diagramm);
    U.html('h2', { text: 'Messreihe: Bildweite und Gegenstandsweite' }, dk);
    var kn2 = U.html('div', { class: 'pl-knoepfe' }, B.diagramm);
    var notieren = U.html('button', { type: 'button', class: 'primary', text: '＋ Messwert notieren' }, kn2);
    var leeren = U.html('button', { type: 'button', text: 'Tabelle leeren' }, kn2);
    notieren.addEventListener('click', function () {
      var bild = O.abbildung(f(), L.g, L.G);
      messungen.push({ f: f(), g: L.g, b: bild.unendlich ? Infinity : bild.b, B: bild.unendlich ? Infinity : bild.B });
      if (messungen.length > 30) messungen.shift();
      zeichneMessDiagramm();
    });
    leeren.addEventListener('click', function () { messungen = []; zeichneMessDiagramm(); });
    diag = PL.diagramm(U.html('div', {}, B.diagramm), { x: { name: 'g', einheit: 'cm' }, y: { name: 'b', einheit: 'cm' }, label: 'Bildweite über der Gegenstandsweite' });
    S.tabelle = U.html('table', { class: 'pl-tabelle' }, B.diagramm);
    S.tabelle.innerHTML = '<thead><tr><th>Linse</th><th>|f| in cm</th><th>g in cm</th><th>b in cm</th><th>B in cm</th></tr></thead>';
    S.tabelleKoerper = U.html('tbody', {}, S.tabelle);
    U.html('p', { class: 'small muted', text: 'Im Diagramm erscheinen die Messwerte der aktuell eingestellten Linse. Negative Bildweiten gehören zu virtuellen Bildern.' }, B.diagramm);

    setzeModus(modus, true);
    U.aufgaben(B.aufgaben, PL.aufgaben.optik, { titelId: B.lmTitelId, einstellen: M.einstellen });
  };
  M.einstellen = function (q) {
    if (q.modus === 'spiegel') {
      if (q.g !== undefined) { SP.g = q.g; E.sg.setze(q.g, true); }
      if (q.G !== undefined) { SP.G = q.G; E.sG.setze(q.G, true); }
      setzeModus('spiegel');
    } else {
      L.art = q.f < 0 ? 'zerstreu' : 'sammel';
      U.segSetze(panels.linse.querySelector('.seg'), L.art);
      if (q.f !== undefined) { L.f = Math.abs(q.f); E.f.setze(L.f, true); }
      if (q.g !== undefined) { L.g = q.g; E.g.setze(q.g, true); }
      if (q.G !== undefined) { L.G = q.G; E.G.setze(q.G, true); }
      setzeModus('linse');
    }
    B.flaeche.scrollIntoView({ block: 'center', behavior: U.reduziert ? 'auto' : 'smooth' });
  };
  M.zeigen = function (unter) {
    var m = MODI.some(function (x) { return x.wert === unter; }) ? unter : 'linse';
    setzeModus(m, true);
    if (m === 'labor') reglerLabor();
    return m === 'linse' ? null : m;
  };
  M.verstecken = function () { /* keine Animation */ };
  PL.module.optik = M;
})(window);
