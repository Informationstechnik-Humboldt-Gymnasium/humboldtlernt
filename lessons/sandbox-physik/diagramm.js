// Physik-Labor · Liniendiagramm in SVG (keine Bibliothek). Achsen mit Größe und Einheit, runde Einteilung (PL.skala),
// Messkurve, berechnete Vergleichskurve (gestrichelt), notierte Messpunkte und Ablesen per Zeiger/Finger.
//
//   var d = PL.diagramm(box, { x: { name: 't', einheit: 's' }, y: { name: 'h', einheit: 'm' }, label: 'Höhe über der Zeit' })
//   d.setze({ serien: [{ punkte: [[x, y], …], art: 'messung' | 'theorie' | 'punkte', name, farbe: 1…3 }], x: [min, max], y: [min, max] })
(function (root) {
  'use strict';
  var PL = root.PL, U = PL.ui;
  var W = 360, H = 226, L = 50, R = 12, T0 = 14, B = 38, T = T0;

  function achsenText(parent, a, x, y, anker, drehen) {
    var t = U.svg('text', { x: x, y: y, 'text-anchor': anker, class: 'pl-achse-titel' }, parent);
    if (drehen) t.setAttribute('transform', 'rotate(-90 ' + x + ' ' + y + ')');
    U.svg('tspan', { class: 'gr', text: a.name }, t);
    if (a.index) U.svg('tspan', { class: 'idx', dy: 3, text: a.index }, t);
    U.svg('tspan', { dy: a.index ? -3 : 0, text: ' in ' + a.einheit }, t);
    return t;
  }

  function diagramm(box, o) {
    var svg = U.svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', class: 'pl-diagramm', 'aria-label': o.label || 'Diagramm' }, box);
    var D = { daten: { serien: [] } }, sx, sy, xs, ys;
    var zeiger = null;

    function px(x) { return L + (x - xs.min) / (xs.max - xs.min) * (W - L - R); }
    function py(y) { return H - B - (y - ys.min) / (ys.max - ys.min) * (H - T - B); }

    D.setze = function (d) { D.daten = d; D.zeichne(); };
    D.zeichne = function () {
      U.leeren(svg);
      var d = D.daten, alle = [];
      var benannt = d.serien.filter(function (s) { return s.name; });
      if (benannt.length < 2) benannt = [];
      // Platz für die Legende oberhalb der Zeichenfläche (Breite grob geschätzt)
      var zeilen = 0, breite = W;
      benannt.forEach(function (s) { var w = 26 + s.name.length * 5.8; if (breite + w > W - L) { zeilen++; breite = 0; } breite += w; });
      T = T0 + zeilen * 15;
      d.serien.forEach(function (s) { s.punkte.forEach(function (p) { alle.push(p); }); });
      var xMin = d.x ? d.x[0] : Infinity, xMax = d.x ? d.x[1] : -Infinity, yMin = d.y ? d.y[0] : Infinity, yMax = d.y ? d.y[1] : -Infinity;
      if (!d.x) alle.forEach(function (p) { xMin = Math.min(xMin, p[0]); xMax = Math.max(xMax, p[0]); });
      if (!d.y) alle.forEach(function (p) { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); });
      if (!isFinite(xMin)) { xMin = 0; xMax = 1; }
      if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
      if (o.yNull !== false) { yMin = Math.min(0, yMin); yMax = Math.max(0, yMax); }
      xs = PL.skala(xMin, xMax, 6); ys = PL.skala(yMin, yMax, 5);
      if (d.x) { xs.min = Math.min(xs.min, d.x[0]); }
      // Gitter und Achsen
      var g = U.svg('g', {}, svg);
      xs.werte.forEach(function (v) {
        var x = px(v);
        U.svg('line', { x1: x, y1: T, x2: x, y2: H - B, class: 'gridline' }, g);
        U.svg('text', { x: x, y: H - B + 14, 'text-anchor': 'middle', class: 'val', text: U.fmt(v, xs.stellen) }, g);
      });
      ys.werte.forEach(function (v) {
        var y = py(v);
        U.svg('line', { x1: L, y1: y, x2: W - R, y2: y, class: 'gridline' }, g);
        U.svg('text', { x: L - 5, y: y + 4, 'text-anchor': 'end', class: 'val', text: U.fmt(v, ys.stellen) }, g);
      });
      U.svg('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, class: 'axis' }, g);
      U.svg('line', { x1: L, y1: T, x2: L, y2: H - B, class: 'axis' }, g);
      if (ys.min < 0 && ys.max > 0) U.svg('line', { x1: L, y1: py(0), x2: W - R, y2: py(0), class: 'pl-nulllinie' }, g);
      achsenText(g, o.x, W - R, H - 6, 'end');
      achsenText(g, o.y, 13, T, 'end', true);
      // Kurven (auf die Zeichenfläche beschnitten)
      var cid = U.id('clip');
      var defs = U.svg('defs', {}, svg), cp = U.svg('clipPath', { id: cid }, defs);
      U.svg('rect', { x: L, y: T - 2, width: W - L - R, height: H - T - B + 4 }, cp);
      var kurven = U.svg('g', { 'clip-path': 'url(#' + cid + ')' }, svg);
      var leer = true;
      d.serien.forEach(function (s) {
        var farbe = 'pl-farbe-' + (s.farbe || 1);
        if (s.art === 'punkte') {
          s.punkte.forEach(function (p) { U.svg('circle', { cx: px(p[0]).toFixed(1), cy: py(p[1]).toFixed(1), r: 3.5, class: 'pl-punkt ' + farbe }, kurven); });
          if (s.punkte.length) leer = false;
          return;
        }
        if (s.punkte.length < 2) return;
        var dd = '';
        for (var i = 0; i < s.punkte.length; i++) dd += (i ? 'L' : 'M') + px(s.punkte[i][0]).toFixed(1) + ' ' + py(s.punkte[i][1]).toFixed(1);
        U.svg('path', { d: dd, class: 'pl-kurve ' + farbe + (s.art === 'theorie' ? ' theorie' : '') }, kurven);
        if (s.art !== 'theorie') leer = false;
      });
      if (leer && o.leerText) U.svg('text', { x: (L + W - R) / 2, y: (T + H - B) / 2, 'text-anchor': 'middle', class: 'val', text: o.leerText }, svg);
      // Legende
      if (benannt.length) {
        var lg = U.svg('g', { class: 'pl-legende' }, svg), lx = L, ly = 12;
        benannt.forEach(function (s) {
          var farbe = 'pl-farbe-' + (s.farbe || 1);
          if (lx > L && lx + 26 + s.name.length * 5.8 > W - R) { lx = L; ly += 15; }
          if (s.art === 'punkte') U.svg('circle', { cx: lx + 7, cy: ly - 4, r: 3.5, class: 'pl-punkt ' + farbe }, lg);
          else U.svg('line', { x1: lx, y1: ly - 4, x2: lx + 14, y2: ly - 4, class: 'pl-kurve ' + farbe + (s.art === 'theorie' ? ' theorie' : '') }, lg);
          var t = U.svg('text', { x: lx + 18, y: ly, class: 'pl-legende-text', text: s.name }, lg);
          lx += 26 + (t.getComputedTextLength ? t.getComputedTextLength() : s.name.length * 6);
        });
      }
      zeiger = U.svg('g', { class: 'pl-zeiger', 'pointer-events': 'none' }, svg);
      zeiger.setAttribute('hidden', '');
    };

    // Ablesen: nächster Messpunkt zur Zeigerposition
    function ablesen(ev) {
      var mess = D.daten.serien.filter(function (s) { return s.art !== 'theorie' && s.punkte.length; });
      if (!mess.length || !zeiger) return;
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
      if (x < L || x > W - R) { zeiger.setAttribute('hidden', ''); return; }
      var xv = xs.min + (x - L) / (W - L - R) * (xs.max - xs.min), best = null, bd = Infinity;
      mess.forEach(function (s) { s.punkte.forEach(function (p) { var dd = Math.abs(p[0] - xv); if (dd < bd) { bd = dd; best = p; } }); });
      if (!best) return;
      U.leeren(zeiger);
      var X = px(best[0]), Y = py(best[1]);
      U.svg('line', { x1: X, y1: T, x2: X, y2: H - B, class: 'pl-zeiger-linie' }, zeiger);
      U.svg('circle', { cx: X, cy: Y, r: 4.5, class: 'pl-zeiger-punkt' }, zeiger);
      var text = o.x.name + (o.x.index || '') + ' = ' + U.fmt(best[0], Math.min(3, xs.stellen + 1)) + ' ' + o.x.einheit + '   ' +
        o.y.name + (o.y.index || '') + ' = ' + U.fmt(best[1], Math.min(3, ys.stellen + 1)) + ' ' + o.y.einheit;
      var tx = Math.min(Math.max(X, L + 110), W - R - 110);
      U.svg('rect', { x: tx - 108, y: T - 12, width: 216, height: 18, rx: 4, class: 'pl-zeiger-kasten' }, zeiger);
      U.svg('text', { x: tx, y: T + 1, 'text-anchor': 'middle', class: 'pl-zeiger-text', text: text }, zeiger);
      zeiger.removeAttribute('hidden');
    }
    svg.addEventListener('pointermove', ablesen);
    svg.addEventListener('pointerdown', ablesen);
    svg.addEventListener('pointerleave', function () { if (zeiger) zeiger.setAttribute('hidden', ''); });
    D.svg = svg;
    D.zeichne();
    return D;
  }

  /**
   * Messreihe: Datensätze { t, … } in festen Zeitabständen. Wird sie zu lang, wird jeder zweite Satz verworfen
   * und der Abstand verdoppelt (die Form der Kurve bleibt erhalten, der Speicher begrenzt).
   */
  function reihe(abstand, max) {
    var R = { saetze: [], abstand: abstand || 0.02, letztes: -Infinity };
    R.leeren = function () { R.saetze = []; R.letztes = -Infinity; R.abstand = abstand || 0.02; };
    R.add = function (satz, erzwingen) {
      if (!erzwingen && satz.t - R.letztes < R.abstand - 1e-9) return;
      R.saetze.push(satz); R.letztes = satz.t;
      if (R.saetze.length > (max || 1500)) {
        var n = R.saetze.length;
        R.saetze = R.saetze.filter(function (p, i) { return i % 2 === 0 || i === n - 1; });
        R.abstand *= 2;
      }
    };
    /** ältere Sätze als ab verwerfen (Diagramm mit Zeitfenster) */
    R.vergessen = function (ab) {
      var i = 0;
      while (i < R.saetze.length && R.saetze[i].t < ab) i++;
      if (i > 0) R.saetze.splice(0, i);
    };
    /** Punkte [t, satz[feld]] für das Diagramm; ab: nur Sätze mit t ≥ ab */
    R.punkte = function (feld, ab) {
      var out = [];
      for (var i = 0; i < R.saetze.length; i++) if (ab === undefined || R.saetze[i].t >= ab) out.push([R.saetze[i].t, R.saetze[i][feld]]);
      return out;
    };
    return R;
  }

  PL.diagramm = diagramm;
  PL.reihe = reihe;
})(window);
