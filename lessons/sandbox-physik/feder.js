// Physik-Labor · Senkrechtes Federpendel (ohne DOM, getestet in test/physiklabor.test.mjs)
//
// y = Auslenkung aus der Ruhelage (positiv nach oben). In der Ruhelage ist die Feder um Δl = m·g / D gedehnt;
// Gewichtskraft und Federkraft heben sich dort auf. Für die Auslenkung gilt dann
//   m·y'' = −D·y − b·y'      (b: Dämpfungskonstante, Reibung proportional zur Geschwindigkeit)
// Ohne Dämpfung: Periodendauer T = 2π·√(m / D), unabhängig von der Auslenkung.
// Energie: E = ½·m·v² + ½·D·y². Der zweite Term fasst Spannenergie der Feder und Lageenergie zusammen
// (gemessen ab der Ruhelage). Die Dämpfung wandelt Energie in innere Energie (Wärme) um.
// Numerik: Runge-Kutta 4. Ordnung mit höchstens 1 ms bzw. T/200 Schrittweite.
// Vereinfachungen: masselose Feder, lineares Kraftgesetz (Hooke) für alle Auslenkungen, Bewegung nur senkrecht.
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});

  function param(p) {
    p = p || {};
    return { m: p.m === undefined ? 0.5 : p.m, D: p.D === undefined ? 20 : p.D, b: p.b || 0, y0: p.y0 === undefined ? -0.1 : p.y0, g: p.g === undefined ? 9.81 : p.g };
  }
  function omega0(p) { return Math.sqrt(p.D / p.m); }
  function abklingen(p) { return p.b / (2 * p.m); }
  function periodeUngedaempft(p) { p = param(p); return 2 * Math.PI * Math.sqrt(p.m / p.D); }
  /** Periodendauer der gedämpften Schwingung; null, wenn keine Schwingung mehr entsteht (Kriechfall/Grenzfall) */
  function periode(p) {
    p = param(p);
    var w0 = omega0(p), d = abklingen(p);
    if (d >= w0) return null;
    return 2 * Math.PI / Math.sqrt(w0 * w0 - d * d);
  }
  function art(p) {
    p = param(p);
    var w0 = omega0(p), d = abklingen(p);
    if (d === 0) return 'ungedaempft';
    if (Math.abs(d - w0) < 1e-9 * w0) return 'grenzfall';
    return d < w0 ? 'gedaempft' : 'kriechfall';
  }
  function ruhelageDehnung(p) { p = param(p); return p.m * p.g / p.D; }
  function energie(z, p) {
    var ek = 0.5 * p.m * z.v * z.v, ep = 0.5 * p.D * z.y * z.y;
    return { kin: ek, pot: ep, ges: ek + ep };
  }
  /** Analytische Lösung für schwache Dämpfung und Start aus der Ruhe (v₀ = 0) – zum Prüfen der Numerik */
  function analytisch(p, t) {
    p = param(p);
    var w0 = omega0(p), d = abklingen(p);
    if (d >= w0) return null;
    var wd = Math.sqrt(w0 * w0 - d * d), e = Math.exp(-d * t);
    return e * (p.y0 * Math.cos(wd * t) + d * p.y0 / wd * Math.sin(wd * t));
  }

  function beschl(p, y, v) { return (-p.D * y - p.b * v) / p.m; }
  function neu(p) {
    p = param(p);
    var z = { t: 0, y: p.y0, v: 0, a: beschl(p, p.y0, 0), letzterDurchgang: null, periodeGemessen: null };
    z.eStart = energie(z, p).ges;
    return z;
  }
  /** Nach einer Änderung von m, D oder b: Bezug für Energieverlust und Periodenmessung neu setzen */
  function parameterGeaendert(z, p) {
    p = param(p);
    z.eStart = energie(z, p).ges; z.letzterDurchgang = null; z.periodeGemessen = null; z.a = beschl(p, z.y, z.v);
  }
  function schritt(z, p, dt) {
    p = param(p);
    var h = Math.min(0.001, periodeUngedaempft(p) / 200), rest = dt;
    while (rest > 1e-12) {
      var d = Math.min(h, rest), y = z.y, v = z.v;
      var k1v = beschl(p, y, v), k1y = v;
      var k2v = beschl(p, y + k1y * d / 2, v + k1v * d / 2), k2y = v + k1v * d / 2;
      var k3v = beschl(p, y + k2y * d / 2, v + k2v * d / 2), k3y = v + k2v * d / 2;
      var k4v = beschl(p, y + k3y * d, v + k3v * d), k4y = v + k3v * d;
      var yn = y + d / 6 * (k1y + 2 * k2y + 2 * k3y + k4y), vn = v + d / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      // Periodendauer messen: Zeit zwischen zwei Durchgängen durch die Ruhelage nach oben
      if (y < 0 && yn >= 0) {
        var tx = z.t + d * (-y) / (yn - y);
        if (z.letzterDurchgang !== null) z.periodeGemessen = tx - z.letzterDurchgang;
        z.letzterDurchgang = tx;
      }
      z.y = yn; z.v = vn; z.t += d; rest -= d;
    }
    z.a = beschl(p, z.y, z.v);
    return false;
  }

  PL.feder = {
    param: param, omega0: omega0, abklingen: abklingen, periode: periode, periodeUngedaempft: periodeUngedaempft, art: art,
    ruhelageDehnung: ruhelageDehnung, energie: energie, analytisch: analytisch, neu: neu, parameterGeaendert: parameterGeaendert, schritt: schritt,
  };
})(typeof window !== 'undefined' ? window : this);
