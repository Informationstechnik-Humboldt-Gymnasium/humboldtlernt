// Physik-Labor · Freier Fall und senkrechter Wurf (ohne DOM, getestet in test/physiklabor.test.mjs)
//
// Koordinate h: Höhe über dem Boden, positive Richtung nach oben.
// Ohne Luftwiderstand (konstantes Schwerefeld) gelten exakt
//   h(t) = h₀ + v₀·t − ½·g·t²     v(t) = v₀ − g·t     a(t) = −g
// Mit Luftwiderstand wirkt zusätzlich F_L = ½·ρ·c_w·A·v² entgegen der Bewegung. Dafür gibt es
// keine einfache Formel für h(t); die Bewegung wird numerisch berechnet (Runge-Kutta 4. Ordnung,
// Zeitschritt 2 ms). Annahmen: ρ_Luft = 1,2 kg/m³ (etwa 20 °C, Meereshöhe), c_w und A konstant.
(function (root) {
  'use strict';
  var PL = root.PL || (root.PL = {});
  var RHO = 1.2, DT = 0.002;

  function param(p) {
    p = p || {};
    return {
      h0: p.h0 === undefined ? 20 : p.h0, v0: p.v0 || 0, g: p.g === undefined ? 9.81 : p.g,
      luft: !!p.luft, m: p.m === undefined ? 1 : p.m, cw: p.cw === undefined ? 0.47 : p.cw, A: p.A === undefined ? 0.01 : p.A,
    };
  }
  /** Faktor k in a = −g − k·v·|v| (Einheit 1/m) */
  function k(p) { return p.luft ? 0.5 * RHO * p.cw * p.A / p.m : 0; }
  function beschleunigung(p, v) { return -p.g - k(p) * v * Math.abs(v); }
  /** Grenzgeschwindigkeit (Betrag) beim Fallen mit Luftwiderstand, sonst Infinity */
  function grenzgeschwindigkeit(p) { var kk = k(p); return kk > 0 ? Math.sqrt(p.g / kk) : Infinity; }

  // ---------------------------------------------------------------- ideal (ohne Luftwiderstand)
  function aufprallZeit(h0, v0, g) {
    if (h0 <= 0 && v0 <= 0) return 0;
    return (v0 + Math.sqrt(v0 * v0 + 2 * g * h0)) / g;
  }
  function hoehe(h0, v0, g, t) { return h0 + v0 * t - 0.5 * g * t * t; }
  /** zurückgelegter Weg (nicht Verschiebung): steigt der Körper erst, zählt der Weg nach oben mit */
  function strecke(h0, v0, g, t) {
    var h = hoehe(h0, v0, g, t);
    if (v0 <= 0) return h0 - h;
    var tt = v0 / g;
    if (t <= tt) return h - h0;
    var top = h0 + v0 * v0 / (2 * g);
    return (top - h0) + (top - h);
  }
  function maxHoehe(h0, v0, g) { return v0 > 0 ? h0 + v0 * v0 / (2 * g) : h0; }
  /** Zustand zur Zeit t (ideal); nach dem Aufprall bleiben die Werte des Aufprallmoments stehen */
  function ideal(p, t) {
    var T = aufprallZeit(p.h0, p.v0, p.g), tc = Math.min(t, T);
    return {
      t: tc, h: Math.max(0, hoehe(p.h0, p.v0, p.g, tc)), v: p.v0 - p.g * tc, a: -p.g,
      s: strecke(p.h0, p.v0, p.g, tc), gelandet: t >= T,
    };
  }

  // ---------------------------------------------------------------- Simulation
  function neu(p) {
    p = param(p);
    var z = { t: 0, h: p.h0, v: p.v0, a: beschleunigung(p, p.v0), s: 0, hMax: p.h0, gelandet: p.h0 <= 0 && p.v0 <= 0 };
    if (z.gelandet) z.h = 0;
    return z;
  }
  function rk4(p, h, v, dt) {
    var a1 = beschleunigung(p, v), v1 = v;
    var a2 = beschleunigung(p, v + a1 * dt / 2), v2 = v + a1 * dt / 2;
    var a3 = beschleunigung(p, v + a2 * dt / 2), v3 = v + a2 * dt / 2;
    var a4 = beschleunigung(p, v + a3 * dt), v4 = v + a3 * dt;
    return { h: h + dt / 6 * (v1 + 2 * v2 + 2 * v3 + v4), v: v + dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4) };
  }
  /** Zustand z um dt Sekunden weiterrechnen. Gibt true zurück, sobald der Körper aufschlägt. */
  function schritt(z, p, dt) {
    p = param(p);
    if (z.gelandet) return true;
    if (!p.luft) {
      var w = ideal(p, z.t + dt);
      z.t = w.t; z.h = w.h; z.v = w.v; z.a = w.a; z.s = w.s; z.gelandet = w.gelandet;
      z.hMax = Math.max(z.hMax, z.h);
      if (z.gelandet) z.h = 0;
      return z.gelandet;
    }
    var rest = dt;
    while (rest > 1e-12) {
      var d = Math.min(DT, rest), n = rk4(p, z.h, z.v, d);
      if (n.h <= 0 && n.v < 0) {
        // Aufprall innerhalb dieses Schritts: Zeitpunkt durch Halbieren eingrenzen
        var lo = 0, hi = d;
        for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (rk4(p, z.h, z.v, mid).h > 0) lo = mid; else hi = mid; }
        n = rk4(p, z.h, z.v, hi);
        z.s += Math.abs(z.h); z.t += hi; z.h = 0; z.v = n.v; z.a = beschleunigung(p, z.v); z.gelandet = true;
        return true;
      }
      z.s += Math.abs(n.h - z.h);
      z.h = n.h; z.v = n.v; z.t += d; rest -= d;
      z.hMax = Math.max(z.hMax, z.h);
    }
    z.a = beschleunigung(p, z.v);
    return false;
  }

  PL.fall = {
    RHO: RHO, param: param, k: k, beschleunigung: beschleunigung, grenzgeschwindigkeit: grenzgeschwindigkeit,
    aufprallZeit: aufprallZeit, hoehe: hoehe, strecke: strecke, maxHoehe: maxHoehe, ideal: ideal, neu: neu, schritt: schritt,
  };
})(typeof window !== 'undefined' ? window : this);
