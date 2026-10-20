// Physik-Labor · Kräfte und Reibung auf einer waagerechten Fläche (ohne DOM, getestet in test/physiklabor.test.mjs)
//
// Modell (Coulomb-Reibung):
//   Gewichtskraft F_G = m·g (nach unten), Normalkraft F_N = F_G (nach oben, waagerechte Fläche).
//   Ruht der Körper, hält die Haftreibung die Zugkraft F genau aus, solange |F| ≤ μ_H·F_N.
//   Gleitet er, wirkt die Gleitreibung F_R = μ_G·F_N entgegen der Bewegungsrichtung.
//   Resultierende Kraft F_res = F + F_R, Beschleunigung a = F_res / m (2. newtonsches Gesetz).
// Vereinfachungen: Reibungszahlen konstant (unabhängig von Geschwindigkeit und Auflagefläche), kein Luftwiderstand,
// starrer Körper, Zugkraft waagerecht. Zwischen den Kraftänderungen ist a konstant – deshalb wird exakt gerechnet.
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});

  function param(p) {
    p = p || {};
    var q = { m: p.m === undefined ? 5 : p.m, F: p.F || 0, muH: p.muH === undefined ? 0.5 : p.muH, muG: p.muG === undefined ? 0.3 : p.muG, g: p.g === undefined ? 9.81 : p.g };
    if (q.muG > q.muH) q.muG = q.muH;   // Gleitreibung ist nie größer als die maximale Haftreibung
    return q;
  }
  function normalkraft(p) { return p.m * p.g; }
  function haftGrenze(p) { p = param(p); return p.muH * normalkraft(p); }
  function gleitKraft(p) { p = param(p); return p.muG * normalkraft(p); }
  function sgn(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

  /** Alle Kräfte im Zustand z (Vorzeichen: + nach rechts bzw. oben) */
  function kraefte(z, p) {
    p = param(p);
    var FG = normalkraft(p), FN = FG, FR, haftet;
    if (z.v === 0) {
      if (Math.abs(p.F) <= p.muH * FN) { FR = -p.F; haftet = true; }
      else { FR = -sgn(p.F) * p.muG * FN; haftet = false; }
    } else { FR = -sgn(z.v) * p.muG * FN; haftet = false; }
    var Fres = p.F + FR;
    if (Math.abs(Fres) < 1e-12) Fres = 0;
    return { FG: FG, FN: FN, F: p.F, FR: FR, Fres: Fres, a: Fres / p.m, haftet: haftet };
  }

  function neu() { return { t: 0, x: 0, v: 0, s: 0, a: 0 }; }
  /** Zustand um dt weiterrechnen. Kommt der Körper zum Stillstand, wird dort neu entschieden (Haften oder Gleiten). */
  function schritt(z, p, dt) {
    p = param(p);
    var rest = dt;
    for (var n = 0; n < 6 && rest > 1e-12; n++) {
      var k = kraefte(z, p), a = k.a;
      if (k.haftet) { z.t += rest; z.a = 0; rest = 0; break; }
      if (z.v !== 0 && sgn(a) === -sgn(z.v)) {
        var tStop = -z.v / a;
        if (tStop <= rest) {
          var dx = z.v * tStop + 0.5 * a * tStop * tStop;
          z.x += dx; z.s += Math.abs(dx); z.v = 0; z.t += tStop; rest -= tStop;
          continue;
        }
      }
      var d = z.v * rest + 0.5 * a * rest * rest;
      z.x += d; z.s += Math.abs(d); z.v += a * rest; z.t += rest; z.a = a; rest = 0;
    }
    z.a = kraefte(z, p).a;
    return false;
  }

  PL.reibung = { param: param, normalkraft: normalkraft, haftGrenze: haftGrenze, gleitKraft: gleitKraft, kraefte: kraefte, neu: neu, schritt: schritt };
})(typeof window !== 'undefined' ? window : this);
