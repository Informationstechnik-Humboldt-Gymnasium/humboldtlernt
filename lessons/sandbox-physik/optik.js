// Physik-Labor · Geometrische Optik: dünne Linsen, ebener Spiegel, Strahlengang mit Spiegeln
// (ohne DOM, getestet in test/physiklabor.test.mjs)
//
// Koordinaten in cm. Linse bzw. Spiegel bei x = 0, optische Achse y = 0, Gegenstand links bei x = −g.
// Linsengleichung (dünne Linse):  1/f = 1/g + 1/b   →   b = f·g / (g − f)
// Abbildungsmaßstab:              A = B/G = −b/g   (A < 0: Bild steht auf dem Kopf)
// Vorzeichen: f > 0 Sammellinse, f < 0 Zerstreuungslinse; b > 0 reelles Bild rechts der Linse,
// b < 0 virtuelles Bild auf der Seite des Gegenstands (die Strahlen scheinen nur von dort zu kommen).
// Vereinfachungen: dünne Linse, achsennahe Strahlen (paraxial), keine Linsenfehler.
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});

  /** Bild eines Gegenstands der Höhe G im Abstand g vor einer dünnen Linse mit Brennweite f */
  function abbildung(f, g, G) {
    if (Math.abs(g - f) < 1e-9) return { b: Infinity, B: Infinity, A: Infinity, unendlich: true, reell: false, virtuell: false, aufrecht: null };
    var b = f * g / (g - f), A = -b / g;
    return { b: b, B: A * G, A: A, unendlich: false, reell: b > 0, virtuell: b < 0, aufrecht: A > 0 };
  }
  /** Ebener Spiegel: Bild genauso weit hinter dem Spiegel, gleich groß, aufrecht, virtuell */
  function spiegelbild(g, G) { return { b: -g, B: G, A: 1, virtuell: true, reell: false, aufrecht: true }; }

  function strahlBis(x1, y1, dx, dy, xEnde) {
    // verlängert den Strahl von (x1|y1) in Richtung (dx|dy) bis x = xEnde
    var t = (xEnde - x1) / dx;
    return { x: xEnde, y: y1 + dy * t };
  }

  /**
   * Die drei Hauptstrahlen vom Gegenstandspunkt (−g | G) aus.
   * Jeder Strahl: { name, teile: [{ x1, y1, x2, y2, art }] } mit art 'echt' (Licht) oder 'verlaengert'
   * (gedachte Verlängerung zum virtuellen Bild bzw. zum Brennpunkt). xR: rechter Rand der Zeichnung.
   */
  function hauptstrahlen(f, g, G, xR) {
    var bild = abbildung(f, g, G), S = [], xo = -g;
    function teil(x1, y1, x2, y2, art) { return { x1: x1, y1: y1, x2: x2, y2: y2, art: art || 'echt' }; }
    function rueck(x0, y0, dx, dy) {
      // gedachte Verlängerung eines auslaufenden Strahls nach hinten bis zum virtuellen Bild
      if (!bild.virtuell) return null;
      var e = strahlBis(x0, y0, dx, dy, bild.b);
      return teil(x0, y0, e.x, e.y, 'verlaengert');
    }
    // 1 Parallelstrahl → wird zum Brennpunktstrahl (Sammellinse: durch F' bei x = f; Zerstreuungslinse: scheint von F' bei x = f zu kommen)
    var p = { name: 'Parallelstrahl', teile: [teil(xo, G, 0, G)] };
    var dx1 = f > 0 ? f : -f, dy1 = f > 0 ? -G : G, e1 = strahlBis(0, G, dx1, dy1, xR);
    p.teile.push(teil(0, G, e1.x, e1.y));
    if (f < 0) p.teile.push(teil(0, G, f, 0, 'verlaengert'));
    else { var r1 = rueck(0, G, dx1, dy1); if (r1) p.teile.push(r1); }
    S.push(p);
    // 2 Mittelpunktstrahl → geht ungebrochen durch die Linsenmitte
    var m = { name: 'Mittelpunktstrahl', teile: [] }, e2 = strahlBis(xo, G, g, -G, xR);
    m.teile.push(teil(xo, G, e2.x, e2.y));
    var r2 = rueck(0, 0, g, -G); if (r2) m.teile.push(r2);
    S.push(m);
    // 3 Brennpunktstrahl → wird zum Parallelstrahl. Er zielt auf den Brennpunkt F auf der Gegenstandsseite (x = −f)
    //   bzw. bei der Zerstreuungslinse auf F jenseits der Linse (x = −f > 0). Trifft die Linse in der Höhe B.
    if (!bild.unendlich) {
      var yL = bild.B, b3 = { name: 'Brennpunktstrahl', teile: [teil(xo, G, 0, yL), teil(0, yL, xR, yL)] };
      if (f > 0 && g < f) b3.teile.push(teil(-f, 0, xo, G, 'verlaengert'));     // scheint von F zu kommen
      if (f < 0) b3.teile.push(teil(0, yL, -f, 0, 'verlaengert'));               // zielte auf F hinter der Linse
      var r3 = rueck(0, yL, 1, 0); if (r3) b3.teile.push(r3);
      S.push(b3);
    }
    return S;
  }

  /** Beliebiger Strahl vom Gegenstandspunkt durch die Linse in der Höhe yL (dünne Linse: alle treffen das Bild) */
  function strahlDurch(f, g, G, yL, xR) {
    var bild = abbildung(f, g, G), teile = [{ x1: -g, y1: G, x2: 0, y2: yL, art: 'echt' }], dx, dy;
    if (bild.unendlich) { dx = g; dy = -G; }                       // alle Strahlen laufen parallel zum Mittelpunktstrahl
    else if (bild.reell) { dx = bild.b; dy = bild.B - yL; }
    else { dx = -bild.b; dy = yL - bild.B; }
    var e = strahlBis(0, yL, dx, dy, xR);
    teile.push({ x1: 0, y1: yL, x2: e.x, y2: e.y, art: 'echt' });
    if (bild.virtuell) teile.push({ x1: 0, y1: yL, x2: bild.b, y2: bild.B, art: 'verlaengert' });
    return { name: 'Strahl', teile: teile };
  }

  /** Strahlen am ebenen Spiegel (bei x = 0, senkrecht) vom Gegenstandspunkt (−g | G) zu den Spiegelpunkten yS */
  function spiegelStrahlen(g, G, yS, xL) {
    return yS.map(function (ys) {
      var dx = g, dy = ys - G;                                  // einfallend
      var e = strahlBis(0, ys, -dx, dy, xL);                    // reflektiert: x-Richtung kehrt um
      return { name: 'Strahl', teile: [
        { x1: -g, y1: G, x2: 0, y2: ys, art: 'echt' },
        { x1: 0, y1: ys, x2: e.x, y2: e.y, art: 'echt' },
        { x1: 0, y1: ys, x2: g, y2: G, art: 'verlaengert' },
      ] };
    });
  }

  // ---------------------------------------------------------------- Strahlengang mit ebenen Spiegeln
  /** Spiegel: { x, y, laenge, winkel } (Mitte, Länge, Winkel in Grad gegen die Waagerechte) */
  function spiegelEnden(s) {
    var w = s.winkel * Math.PI / 180, hx = Math.cos(w) * s.laenge / 2, hy = Math.sin(w) * s.laenge / 2;
    return { x1: s.x - hx, y1: s.y - hy, x2: s.x + hx, y2: s.y + hy };
  }
  /** Schnitt des Strahls (p + t·d, t > 0) mit der Strecke a–b; gibt t und Parameter u ∈ [0, 1] zurück */
  function schnitt(px, py, dx, dy, ax, ay, bx, by) {
    var ex = bx - ax, ey = by - ay, nenner = dx * ey - dy * ex;
    if (Math.abs(nenner) < 1e-12) return null;
    var t = ((ax - px) * ey - (ay - py) * ex) / nenner, u = ((ax - px) * dy - (ay - py) * dx) / nenner;
    if (t <= 1e-9 || u < 0 || u > 1) return null;
    return { t: t, u: u };
  }
  /**
   * Lichtstrahl von (x | y) in Richtung winkel (Grad) durch eine Anordnung ebener Spiegel verfolgen.
   * Reflexionsgesetz: Einfallswinkel = Reflexionswinkel (gemessen zum Lot). Der Strahl endet nach
   * maxReflexionen oder am Rand (Abstand weit). Gibt { punkte, reflexionen: [{ spiegel, einfall }] } zurück.
   */
  function verfolge(x, y, winkel, spiegel, maxReflexionen, weit) {
    var w = winkel * Math.PI / 180, dx = Math.cos(w), dy = Math.sin(w), pts = [{ x: x, y: y }], refl = [], zuletzt = -1;
    maxReflexionen = maxReflexionen === undefined ? 20 : maxReflexionen; weit = weit || 1000;
    for (var n = 0; n <= maxReflexionen; n++) {
      var best = null, bi = -1;
      for (var i = 0; i < spiegel.length; i++) {
        if (i === zuletzt) continue;
        var e = spiegelEnden(spiegel[i]), s = schnitt(x, y, dx, dy, e.x1, e.y1, e.x2, e.y2);
        if (s && (!best || s.t < best.t)) { best = s; bi = i; }
      }
      if (!best || n === maxReflexionen) { pts.push({ x: x + dx * weit, y: y + dy * weit }); break; }
      x += dx * best.t; y += dy * best.t; pts.push({ x: x, y: y });
      var en = spiegelEnden(spiegel[bi]), tx = en.x2 - en.x1, ty = en.y2 - en.y1, l = Math.hypot(tx, ty), nx = -ty / l, ny = tx / l;
      var dn = dx * nx + dy * ny;
      refl.push({ spiegel: bi, x: x, y: y, einfall: Math.acos(Math.min(1, Math.abs(dn))) * 180 / Math.PI });
      dx -= 2 * dn * nx; dy -= 2 * dn * ny;
      zuletzt = bi;
    }
    return { punkte: pts, reflexionen: refl };
  }

  PL.optik = {
    abbildung: abbildung, spiegelbild: spiegelbild, hauptstrahlen: hauptstrahlen, strahlDurch: strahlDurch,
    spiegelStrahlen: spiegelStrahlen, spiegelEnden: spiegelEnden, verfolge: verfolge,
  };
})(typeof window !== 'undefined' ? window : this);
